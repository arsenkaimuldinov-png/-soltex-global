/**
 * Database tests (Phase B). Need a provisioned PostgreSQL 17 (apps/api/db/provision.sql) and:
 *   MIGRATION_DATABASE_URL  role soltex_migrate
 *   DATABASE_URL            role soltex_app
 *   BACKUP_DATABASE_URL     role soltex_backup
 * Skipped when DATABASE_URL is not set (unit runs without a database). CI always sets them.
 *
 * WARNING: resets all content tables of the target database. Never point it at production.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { ContentStore } from '@soltex/core/content';
import { connect } from './client.ts';
import { exportStore } from '../content/export.ts';
import { ImportError, importStore } from '../content/import.ts';
import { SEED_FILES, readSeedDir, serialize } from '../content/seed-files.ts';

const SEED_DIR = path.resolve(import.meta.dirname, '../../../web/src/content/seed');

/** Every content table of Phase B (reset before the round-trip tests). */
const CONTENT_TABLES = [
  'media', 'media_translations', 'technologies', 'technology_translations', 'technology_projects',
  'projects', 'project_translations', 'project_gallery', 'products', 'product_translations',
  'epcm_stages', 'epcm_stage_translations', 'patents', 'patent_translations', 'videos', 'video_translations',
  'pages', 'page_translations', 'page_media', 'page_list_items', 'page_list_item_translations',
  'settings', 'settings_translations', 'metrics', 'metric_translations', 'offices', 'office_translations', 'redirects',
];
const enabled = !!process.env.DATABASE_URL && !!process.env.MIGRATION_DATABASE_URL;

/** Reject if `query` succeeds; return the PostgreSQL error code otherwise. */
async function denied(client: pg.PoolClient | pg.Pool, query: string): Promise<string> {
  try {
    await client.query(query);
  } catch (e) {
    return (e as { code?: string }).code ?? 'error';
  }
  assert.fail(`expected to be refused: ${query}`);
}

describe('content database', { skip: !enabled && 'DATABASE_URL / MIGRATION_DATABASE_URL not set' }, () => {
  let owner: ReturnType<typeof connect>;
  let app: ReturnType<typeof connect>;

  before(async () => {
    owner = connect(process.env.MIGRATION_DATABASE_URL!, 2);
    app = connect(process.env.DATABASE_URL!, 4);
    await migrate(owner.db, { migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle') });
    // Reset content (owner may truncate; the app role may not). Users, sessions and the
    // append-only audit log (Phase C) are not content and are never truncated.
    await owner.pool.query(`TRUNCATE ${CONTENT_TABLES.map((t) => `"${t}"`).join(', ')}`);
  });

  after(async () => {
    await owner?.close();
    await app?.close();
  });

  const seedText = () => Object.fromEntries(Object.values(SEED_FILES).map((f) => [f, fs.readFileSync(path.join(SEED_DIR, f), 'utf8')]));
  const exportText = (store: ContentStore) =>
    Object.fromEntries(Object.entries(SEED_FILES).map(([k, f]) => [f, serialize(store[k as keyof ContentStore])]));
  const rowCounts = async () => {
    const out: Record<string, number> = {};
    for (const t of CONTENT_TABLES) out[t] = Number((await owner.pool.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n);
    return out;
  };

  test('seed → database → export is byte-identical to the seed files', async () => {
    const report = await app.db.transaction((tx) => importStore(tx, readSeedDir(SEED_DIR)));
    assert.deepEqual(report.notInStore, {});
    const exported = await app.db.transaction((tx) => exportStore(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    const expected = seedText();
    for (const [file, text] of Object.entries(exportText(exported))) assert.equal(text, expected[file], `${file} differs after the round trip`);
  });

  test('import is idempotent: a second run changes no row count and no exported byte', async () => {
    const before = await rowCounts();
    await app.db.transaction((tx) => importStore(tx, readSeedDir(SEED_DIR)));
    assert.deepEqual(await rowCounts(), before);
    const exported = await app.db.transaction((tx) => exportStore(tx));
    assert.deepEqual(exportText(exported), seedText());
  });

  test('a failing import rolls back completely', async () => {
    const before = await rowCounts();
    const store = readSeedDir(SEED_DIR);
    store.projects[0]!.title.en = 'CHANGED — must be rolled back';
    store.products[store.products.length - 1]!.relatedProjectId = 'project-does-not-exist';
    await assert.rejects(app.db.transaction((tx) => importStore(tx, store)), ImportError);
    assert.deepEqual(await rowCounts(), before);
    const exported = await app.db.transaction((tx) => exportStore(tx));
    assert.deepEqual(exportText(exported), seedText());
  });

  test('import rejects invalid list content (Zod JSONB schemas)', async () => {
    const store = readSeedDir(SEED_DIR);
    (store.projects[0]!.specs as unknown[]).push({ label: store.projects[0]!.title }); // value missing
    await assert.rejects(app.db.transaction((tx) => importStore(tx, store)), ImportError);
  });

  test('application role cannot change the schema or reference data', async () => {
    const c = await app.pool.connect();
    try {
      assert.equal(await denied(c, 'CREATE TABLE evil (id int)'), '42501');
      assert.equal(await denied(c, 'ALTER TABLE projects ADD COLUMN evil int'), '42501');
      assert.equal(await denied(c, 'DROP TABLE redirects'), '42501');
      assert.equal(await denied(c, 'TRUNCATE redirects'), '42501');
      assert.equal(await denied(c, "INSERT INTO locales (code, position) VALUES ('xx', 99)"), '42501');
      assert.equal(await denied(c, "UPDATE locales SET position = position"), '42501');
      assert.equal(await denied(c, 'CREATE SCHEMA evil'), '42501');
      // Audit log (Phase C): append-only for the application role.
      assert.equal(await denied(c, "UPDATE audit_events SET action = 'x'"), '42501');
      assert.equal(await denied(c, 'DELETE FROM audit_events'), '42501');
      assert.equal(await denied(c, 'TRUNCATE audit_events'), '42501');
      // …but it can read and write content (inside a transaction that is rolled back).
      await c.query('BEGIN');
      await c.query("UPDATE project_translations SET title = title || '' WHERE locale = 'en'");
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  test('migration role owns the schema; the audit log refuses UPDATE/DELETE/TRUNCATE even for it', async () => {
    const r = await owner.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'soltex_migrate'`);
    assert.equal(r.rows[0]!.n, 0);
    const c = await owner.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO audit_events (action, result) VALUES ('test.trigger', 'success')`);
      await c.query('SAVEPOINT s');
      assert.equal(await denied(c, `UPDATE audit_events SET action = 'x' WHERE action = 'test.trigger'`), '42501');
      await c.query('ROLLBACK TO SAVEPOINT s');
      assert.equal(await denied(c, `DELETE FROM audit_events WHERE action = 'test.trigger'`), '42501');
      await c.query('ROLLBACK TO SAVEPOINT s');
      assert.equal(await denied(c, 'TRUNCATE audit_events'), '42501');
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  test('backup role is read-only', { skip: !process.env.BACKUP_DATABASE_URL && 'BACKUP_DATABASE_URL not set' }, async () => {
    const b = new pg.Pool({ connectionString: process.env.BACKUP_DATABASE_URL, max: 1 });
    try {
      const r = await b.query('SELECT count(*)::int AS n FROM projects');
      assert.ok(r.rows[0].n > 0);
      assert.equal(await denied(b, "UPDATE projects SET status = 'draft'"), '42501');
      assert.equal(await denied(b, 'CREATE TABLE evil (id int)'), '42501');
      assert.equal(await denied(b, "INSERT INTO audit_events (action, result) VALUES ('x', 'success')"), '42501');
      assert.equal((await b.query('SELECT count(*)::int AS n FROM users')).rows[0].n >= 0, true);
    } finally {
      await b.end();
    }
  });

  test('redirect targets are internal paths only (open-redirect guard)', async () => {
    const c = await app.pool.connect();
    try {
      await c.query('BEGIN');
      for (const [from, to] of [
        ['/old', 'https://evil.example/'],
        ['/old', '//evil.example'],
        ['/old', '/\\evil.example'],
        ['/old', 'javascript:alert(1)'],
        ['/old', '/a\r\nLocation: https://evil.example'],
        ['https://x', '/new'],
        ['/same', '/same'],
      ]) {
        await c.query('SAVEPOINT s');
        assert.equal(await denied(c, `INSERT INTO redirects (id, key, from_path, to_path) VALUES (gen_random_uuid(), 'k', ${pg.escapeLiteral(from!)}, ${pg.escapeLiteral(to!)})`), '23514', `${from} → ${to}`);
        await c.query('ROLLBACK TO SAVEPOINT s');
      }
      await c.query(`INSERT INTO redirects (id, key, from_path, to_path) VALUES (gen_random_uuid(), 'ok', '/old-page', '/ru/projects')`);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });

  test('referenced content cannot be deleted; slugs are unique per language', async () => {
    const c = await app.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SAVEPOINT s');
      assert.equal(await denied(c, `DELETE FROM technologies WHERE key = 'technology-pectin'`), '23503');
      await c.query('ROLLBACK TO SAVEPOINT s');
      assert.equal(
        await denied(c, `UPDATE project_translations SET slug = 'solbar-ningbo' WHERE locale = 'en' AND slug = 'solbar-israel'`),
        '23505'
      );
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });
});
