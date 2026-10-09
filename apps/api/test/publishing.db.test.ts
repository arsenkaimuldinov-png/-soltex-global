/**
 * Publishing (Phase G): revisions (write, compare, restore), record publish / unpublish, release
 * snapshots, the build worker (lock, failures, lost workers), immutable artifacts, atomic
 * activation, failed activation, rollback, stale releases, preview access and the translation
 * policy at publication. Every release root is a temporary directory: the tests never touch a real
 * public release.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { and, desc, eq, sql } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';
import { importStore } from '../src/content/import.ts';
import { readSeedDir } from '../src/content/seed-files.ts';
import { currentLink, readCurrent, releaseDir, removeDir } from '../src/publishing/artifacts.ts';
import { BuildFailure, siteBuilder, type Builder } from '../src/publishing/builder.ts';
import { activateRelease } from '../src/publishing/releases.ts';
import { reconcileActive, recoverStale, runNextJob } from '../src/publishing/worker.ts';
import { createPreviewServer } from '../src/preview/server.ts';
import { closeTestDb, DB_ENABLED, makeApp, problem, signedIn, type TestApp } from './helpers.ts';

const SEED = path.resolve(import.meta.dirname, '../../web/src/content/seed');
const CONTENT_TABLES = [
  'media', 'media_translations', 'technologies', 'technology_translations', 'technology_projects',
  'projects', 'project_translations', 'project_gallery', 'products', 'product_translations',
  'epcm_stages', 'epcm_stage_translations', 'patents', 'patent_translations', 'videos', 'video_translations',
  'pages', 'page_translations', 'page_media', 'page_list_items', 'page_list_item_translations',
  'settings', 'settings_translations', 'metrics', 'metric_translations', 'offices', 'office_translations', 'redirects',
  'content_revisions', 'preview_grants', 'release_events', 'releases', 'content_snapshots',
];
const LOCALES = ['ru', 'zh', 'tr', 'ar', 'es'];

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;

async function resetToSeed(t: TestApp) {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
  await mig.close();
  await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
}

/**
 * A fast builder for state-machine tests: writes a small but complete site (every file the artifact
 * validation requires) from the snapshot, or fails / waits on demand.
 */
function fakeBuilder(opts: { fail?: 'content' | 'build'; gate?: Promise<void>; calls?: string[]; missingPage?: boolean } = {}): Builder {
  return {
    async build({ root, key, store }) {
      opts.calls?.push(key);
      await opts.gate;
      if (opts.fail === 'content') throw new BuildFailure({ step: 'content', message: 'Проверка содержимого не пройдена', errors: ['project-x: empty English text'] });
      if (opts.fail) throw new BuildFailure({ step: 'build', message: 'Ошибка сборки сайта', errors: [] });
      const dist = path.join(root, 'build', key, 'dist');
      const write = (p: string, body: string) => {
        fs.mkdirSync(path.dirname(path.join(dist, p)), { recursive: true });
        fs.writeFileSync(path.join(dist, p), body);
      };
      write('index.html', `<html>${key}</html>`);
      write('404.html', '<html>404</html>');
      write('sitemap.xml', '<urlset/>');
      for (const l of LOCALES) {
        write(`${l}.html`, `<html>${l}</html>`);
        write(`${l}/404.html`, '<html>404</html>');
      }
      for (const coll of ['projects', 'technologies', 'products'] as const)
        for (const r of store[coll] as Array<{ slug: string; status: string }>) {
          if (opts.missingPage && coll === 'projects') continue;
          write(`${coll}/${r.slug}.html`, r.slug);
          for (const l of LOCALES) write(`${l}/${coll}/${r.slug}.html`, r.slug);
        }
      return { distDir: dist, warnings: [], log: '' };
    },
    cleanup(root, key) {
      fs.rmSync(path.join(root, 'build', key), { recursive: true, force: true });
    },
  };
}

describe('publishing: revisions, releases, preview', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let root: string;
  let owner: Signed, cm: Signed, editor: Signed, seo: Signed, marketer: Signed;
  const ids: Record<string, Record<string, string>> = {};

  async function refreshIds() {
    for (const col of ['projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos']) {
      const res = await cm.c.req('GET', `/api/v1/content/${col}?limit=100`);
      ids[col] = Object.fromEntries((res.json().items as Json[]).map((i) => [i.key, i.id]));
    }
    ids.pages = Object.fromEntries(((await cm.c.req('GET', '/api/v1/content/pages')).json().items as Json[]).map((i) => [i.key, i.id]));
  }

  before(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-releases-'));
    t = await makeApp({ RELEASES_DIR: root, PREVIEW_ORIGIN: 'http://preview.soltex.test' });
    await resetToSeed(t);
    [owner, cm, editor, seo, marketer] = [await signedIn(t, 'owner'), await signedIn(t, 'content_manager'), await signedIn(t, 'editor'), await signedIn(t, 'seo_specialist'), await signedIn(t, 'marketer')];
    await refreshIds();
  });
  after(async () => {
    await resetToSeed(t);
    await t.app.close();
    await closeTestDb();
    removeDir(root);
  });

  const get = async (who: Signed, url: string) => {
    const res = await who.c.req('GET', url);
    assert.equal(res.statusCode, 200, res.body);
    return { body: res.json() as Json, etag: String(res.headers.etag) };
  };
  const post = (who: Signed, url: string, body?: unknown, ifMatch?: string) => who.c.req('POST', url, body, ifMatch ? { 'if-match': ifMatch } : {});
  const userRow = async (who: Signed) => (await t.deps.db!.select().from(s.users).where(eq(s.users.id, who.user.id)))[0]!;
  const revisions = async (type: string, id: string) => (await get(cm, `/api/v1/revisions?type=${type}&entity=${id}&limit=100`)).body;
  const releaseRow = async (id: string) => (await t.deps.db!.select().from(s.releases).where(eq(s.releases.id, id)))[0]!;
  const client = { requestId: 'test', ipHash: 'x', userAgent: null };

  // -------------------------------------------------------------------------
  // Revisions
  // -------------------------------------------------------------------------

  test('every record has a baseline revision after the import; history needs content.read', async () => {
    const all = (await get(cm, '/api/v1/revisions?limit=100')).body;
    assert.equal(all.total, 14 + 8 + 6 + 6 + 8 + 6 + 2);
    assert.ok(all.items.every((i: Json) => i.kind === 'baseline' && i.number === 1 && i.current));
    for (const who of [editor, seo, marketer]) assert.equal((await who.c.req('GET', '/api/v1/revisions')).statusCode, 200);
    const anon = await t.app.inject({ method: 'GET', url: '/api/v1/revisions' });
    assert.equal(anon.statusCode, 401);
  });

  test('a content change writes one revision in its transaction; failed changes write none', async () => {
    const id = ids.projects!['project-solbar-ningbo']!;
    const rec = await get(cm, `/api/v1/content/projects/${id}`);
    const res = await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { overview: `${rec.body.fields.overview} Revised.` }, { 'if-match': rec.etag });
    assert.equal(res.statusCode, 200, res.body);
    let h = await revisions('projects', id);
    assert.deepEqual(h.items.map((i: Json) => [i.number, i.kind, i.current]), [[2, 'update', true], [1, 'baseline', false]]);
    assert.deepEqual(h.items[0].fields, ['overview']);
    assert.equal(h.items[0].author.id, cm.user.id);
    // Stale If-Match → 409, no revision.
    assert.equal(problem(await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { overview: 'x' }, { 'if-match': rec.etag })).status, 409);
    // Validation error → 400, no revision.
    assert.equal(problem(await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { title: '' }, { 'if-match': `"${(res.json() as Json).version}"` })).status, 400);
    // Field-level refusal → 403, no revision.
    assert.equal(problem(await editor.c.req('PATCH', `/api/v1/content/projects/${id}`, { seoMetaTitle: 'x' }, { 'if-match': `"${(res.json() as Json).version}"` })).status, 403);
    h = await revisions('projects', id);
    assert.equal(h.total, 2);
    // A translation save is a translation revision with its language.
    const tr = await get(editor, `/api/v1/content/projects/${id}/translations/ru`);
    assert.equal((await editor.c.req('PATCH', `/api/v1/content/projects/${id}/translations/ru`, { fields: { title: 'Солбар Нинбо (ред.)' } }, { 'if-match': tr.etag })).statusCode, 200);
    h = await revisions('projects', id);
    assert.deepEqual([h.items[0].kind, h.items[0].locale, h.items[0].number], ['translation', 'ru', 3]);
    // Revisions are append-only, even for the owner role.
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await assert.rejects(mig.pool.query(`UPDATE content_revisions SET title = 'x'`), /append-only/);
    await assert.rejects(mig.pool.query(`DELETE FROM content_revisions`), /append-only/);
    await mig.close();
    const app = t.deps.db!;
    await assert.rejects(app.execute(sql`DELETE FROM content_revisions`), (e: Error & { cause?: Error }) => /permission denied|append-only/.test(e.cause?.message ?? e.message));
  });

  test('compare: field by field and language by language; view shows labelled values, not JSON', async () => {
    const id = ids.projects!['project-solbar-ningbo']!;
    const cmp = (await get(cm, `/api/v1/content/projects/${id}/revisions/1/compare`)).body;
    assert.deepEqual([cmp.from, cmp.to], [1, 3]);
    const fields = new Set(cmp.entries.map((e: Json) => `${e.field}:${e.locale}`));
    assert.ok(fields.has('overview:en'));
    assert.ok(fields.has('title:ru'));
    assert.ok(fields.has('translationStatus:ru'), 'the ru approval changed to in progress');
    const ov = cmp.entries.find((e: Json) => e.field === 'overview' && e.locale === 'en');
    assert.ok(String(ov.after).endsWith('Revised.') && !String(ov.before).endsWith('Revised.'));
    const one = (await get(cm, `/api/v1/content/projects/${id}/revisions/1`)).body;
    assert.equal(one.revision.number, 1);
    assert.ok(one.values.some((v: Json) => v.path === 'title' && v.locale === 'en' && v.value === 'SOLBAR NINGBO'));
    assert.equal(problem(await cm.c.req('GET', `/api/v1/content/projects/${id}/revisions/99`)).status, 404);
  });

  test('restore: a new working version from an old revision; status and slug kept; translations reviewed again; permissions', async () => {
    const id = ids.projects!['project-solbar-ningbo']!;
    const before = await get(cm, `/api/v1/content/projects/${id}`);
    assert.equal(problem(await marketer.c.req('POST', `/api/v1/content/projects/${id}/revisions/1/restore`, undefined, { 'if-match': before.etag })).status, 403);
    assert.equal(problem(await editor.c.req('POST', `/api/v1/content/projects/${id}/revisions/1/restore`, undefined, { 'if-match': '"1"' })).status, 409, 'stale version');
    assert.equal(problem(await editor.c.req('POST', `/api/v1/content/projects/${id}/revisions/1/restore`)).status, 428);
    const res = await editor.c.req('POST', `/api/v1/content/projects/${id}/revisions/1/restore`, undefined, { 'if-match': before.etag });
    assert.equal(res.statusCode, 200, res.body);
    const r = res.json() as Json;
    assert.equal(r.revision, 4);
    assert.ok(r.fields.includes('overview'));
    const afterRec = (await get(cm, `/api/v1/content/projects/${id}`)).body;
    assert.ok(!afterRec.fields.overview.endsWith('Revised.'), 'old English text is back');
    assert.equal(afterRec.status, before.body.status);
    assert.equal(afterRec.fields.slug, before.body.fields.slug);
    assert.equal(afterRec.version, before.body.version + 1);
    const h = await revisions('projects', id);
    assert.deepEqual([h.items[0].kind, h.items[0].restoredFrom, h.items[0].current], ['restore', 1, true]);
    assert.equal(h.items.length, 4, 'history is never rewritten');
    // The source text changed back → approved translations are outdated (need review); ru text is the old one again.
    const zh = (await get(cm, `/api/v1/content/projects/${id}/translations/zh`)).body;
    assert.equal(zh.state, 'outdated');
    const ru = (await get(cm, `/api/v1/content/projects/${id}/translations/ru`)).body;
    assert.equal(ru.fields.find((f: Json) => f.name === 'title').target, readSeedDir(SEED).projects.find((p) => p.id === 'project-solbar-ningbo')!.title.ru);
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(and(eq(s.auditEvents.action, 'revision.restore'), eq(s.auditEvents.resourceId, id))).orderBy(desc(s.auditEvents.id)).limit(1);
    assert.equal(audit!.result, 'success');
    // A revision that differs in SEO data cannot be restored by an Editor (field-level rule).
    const cur = await get(cm, `/api/v1/content/projects/${id}`);
    assert.equal((await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { seoMetaTitle: 'Ningbo SEO title' }, { 'if-match': cur.etag })).statusCode, 200);
    const cur2 = await get(cm, `/api/v1/content/projects/${id}`);
    const denied = problem(await editor.c.req('POST', `/api/v1/content/projects/${id}/revisions/4/restore`, undefined, { 'if-match': cur2.etag }));
    assert.equal(denied.status, 403);
    assert.deepEqual((denied.body as Json).errors, [{ field: 'seo', message: 'not_allowed' }]);
    assert.equal((await revisions('projects', id)).total, 5);
    // Restoring the current version changes nothing.
    assert.equal(problem(await cm.c.req('POST', `/api/v1/content/projects/${id}/revisions/5/restore`, undefined, { 'if-match': cur2.etag })).body.code, 'invalid_transition');
  });

  test('publish / unpublish a record: content.publish; blocked while English texts are empty; revisions', async () => {
    const c = await cm.c.req('POST', '/api/v1/content/epcm-stages', { title: 'E2E stage' });
    assert.equal(c.statusCode, 201, c.body);
    const rec = c.json() as Json;
    assert.equal(problem(await editor.c.req('POST', `/api/v1/content/epcm-stages/${rec.id}/publish`, undefined, { 'if-match': `"${rec.version}"` })).status, 403);
    const blocked = problem(await post(cm, `/api/v1/content/epcm-stages/${rec.id}/publish`, undefined, `"${rec.version}"`));
    assert.equal(blocked.status, 400);
    assert.ok((blocked.body as Json).errors.some((e: Json) => e.field === 'focus' && e.message === 'required'));
    const filled = await cm.c.req('PATCH', `/api/v1/content/epcm-stages/${rec.id}`, { focus: 'Focus', description: 'Description', deliverables: [{ value: 'One', from: null }] }, { 'if-match': `"${rec.version}"` });
    assert.equal(filled.statusCode, 200, filled.body);
    const ok = await post(cm, `/api/v1/content/epcm-stages/${rec.id}/publish`, undefined, `"${(filled.json() as Json).version}"`);
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal((ok.json() as Json).status, 'published');
    assert.equal((await revisions('epcm-stages', rec.id)).items[0].kind, 'publish');
    const un = await post(cm, `/api/v1/content/epcm-stages/${rec.id}/unpublish`, undefined, `"${(ok.json() as Json).version}"`);
    assert.equal((un.json() as Json).status, 'draft');
    assert.equal(problem(await post(cm, `/api/v1/content/epcm-stages/${rec.id}/unpublish`, undefined, `"${(un.json() as Json).version}"`)).body.code, 'invalid_transition');
  });

  // -------------------------------------------------------------------------
  // Releases
  // -------------------------------------------------------------------------

  let r1 = '';

  test('release candidate: snapshot of the published records only; permissions', async () => {
    assert.equal(problem(await post(editor, '/api/v1/releases', {})).status, 403);
    assert.equal(problem(await post(marketer, '/api/v1/releases', {})).status, 403);
    assert.equal(problem(await post(marketer, '/api/v1/previews', {})).status, 403);
    const res = await post(cm, '/api/v1/releases', { note: 'First CMS release' });
    assert.equal(res.statusCode, 201, res.body);
    const rel = res.json() as Json;
    r1 = rel.id;
    assert.equal(rel.status, 'queued');
    assert.match(rel.key, /^R-\d{8}-\d{6}-[0-9a-f]{6}$/);
    assert.equal(rel.snapshot.counts.pages, 12, 'draft pages (privacy, terms) are not in a release');
    assert.equal(rel.snapshot.counts['epcm-stages'], 8, 'the unpublished E2E stage is not in the release');
    assert.equal(rel.snapshot.records, 12 + 8 + 6 + 6 + 8 + 6 + 2);
    // Translation policy is recorded: after the restore every ningbo translation is outdated (older approved text shown).
    const ningbo = rel.translations.attention.filter((a: Json) => a.key === 'project-solbar-ningbo');
    assert.deepEqual(ningbo.map((a: Json) => `${a.locale}:${a.state}`).sort(), ['ar:outdated', 'es:outdated', 'ru:outdated', 'tr:outdated', 'zh:outdated']);
    assert.ok(rel.validation.warnings.some((w: string) => w.startsWith('translation_outdated:zh')));
    assert.equal(rel.changes.length, rel.snapshot.records, 'no release is active yet: everything is new');
    // The snapshot is immutable.
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await assert.rejects(mig.pool.query(`UPDATE content_snapshots SET sha256 = 'x'`), /append-only/);
    await assert.rejects(mig.pool.query(`UPDATE releases SET snapshot_id = gen_random_uuid() WHERE id = $1`, [r1]), /immutable/);
    await mig.close();
  });

  test('worker: builds the snapshot into an immutable artifact; nothing goes live by building', async () => {
    const res = await runNextJob(t.deps, fakeBuilder());
    assert.deepEqual(res, { outcome: 'done', key: (await releaseRow(r1)).key, status: 'ready' });
    const row = await releaseRow(r1);
    assert.equal(row.status, 'ready');
    assert.ok(row.artifactSha256 && row.artifactFiles! > 10 && row.buildStartedAt && row.buildFinishedAt);
    const dir = releaseDir(root, row.key);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8')) as Json;
    assert.equal(manifest.release_id, row.key);
    assert.equal(manifest.artifact_checksum, `sha256:${row.artifactSha256}`);
    assert.equal(fs.statSync(path.join(dir, 'index.html')).mode & 0o222, 0, 'artifact files are read-only');
    assert.equal(fs.statSync(dir).mode & 0o222, 0, 'artifact directory is read-only');
    assert.ok(!fs.existsSync(path.join(root, 'build', row.key)), 'workspace removed');
    assert.equal(readCurrent(root), null, 'building never activates');
    assert.equal((await runNextJob(t.deps, fakeBuilder())).outcome, 'idle');
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await assert.rejects(mig.pool.query(`UPDATE releases SET artifact_sha256 = 'x' WHERE id = $1`, [r1]), /immutable/);
    await mig.close();
  });

  test('preview build: drafts included, never activatable', async () => {
    const res = await post(editor, '/api/v1/previews', {});
    assert.equal(res.statusCode, 201, res.body);
    const p = res.json() as Json;
    assert.equal(p.kind, 'preview');
    assert.equal(p.snapshot.counts.pages, 14, 'drafts are shown in a preview');
    assert.equal((await runNextJob(t.deps, fakeBuilder())).outcome, 'done');
    const d = (await get(cm, `/api/v1/releases/${p.id}`));
    assert.equal(d.body.status, 'ready');
    assert.equal(problem(await post(cm, `/api/v1/releases/${p.id}/activate`, undefined, d.etag)).body.code, 'invalid_transition');
  });

  test('publish: atomic switch of the served artifact; duplicate requests are refused safely', async () => {
    const d = await get(cm, `/api/v1/releases/${r1}`);
    assert.equal(problem(await post(editor, `/api/v1/releases/${r1}/activate`, undefined, d.etag)).status, 403);
    assert.equal(problem(await post(cm, `/api/v1/releases/${r1}/activate`)).status, 428);
    const [a, b] = await Promise.all([post(cm, `/api/v1/releases/${r1}/activate`, undefined, d.etag), post(owner, `/api/v1/releases/${r1}/activate`, undefined, d.etag)]);
    const codes = [a.statusCode, b.statusCode].sort();
    assert.deepEqual(codes, [200, 409], `${a.body} ${b.body}`);
    const row = await releaseRow(r1);
    assert.equal(row.status, 'active');
    assert.equal(readCurrent(root), row.key);
    assert.equal(fs.readlinkSync(currentLink(root)), path.join('releases', row.key));
    assert.equal(row.activatedBy && [cm.user.id, owner.user.id].includes(row.activatedBy), true);
    const events = await t.deps.db!.select().from(s.releaseEvents).where(eq(s.releaseEvents.releaseId, r1));
    assert.deepEqual(events.map((e) => e.event), ['created', 'build_started', 'build_finished', 'build_succeeded', 'activated']);
    const ov = (await get(cm, '/api/v1/publishing/overview')).body;
    assert.equal(ov.active.id, r1);
    assert.equal(ov.currentOnDisk, row.key);
    assert.deepEqual(ov.pending, [], 'everything published is live');
    // An edit is pending; restoring the live text makes the record equal to the live one again.
    const pid = ids.projects!['project-solbar-ningbo']!;
    const rec = await get(cm, `/api/v1/content/projects/${pid}`);
    assert.equal((await cm.c.req('PATCH', `/api/v1/content/projects/${pid}`, { years: 'pending check' }, { 'if-match': rec.etag })).statusCode, 200);
    assert.deepEqual((await get(cm, '/api/v1/publishing/overview')).body.pending.map((p: Json) => p.key), ['project-solbar-ningbo']);
    const before = (await revisions('projects', pid)).items[1].number;
    const cur = await get(cm, `/api/v1/content/projects/${pid}`);
    assert.equal((await cm.c.req('POST', `/api/v1/content/projects/${pid}/revisions/${before}/restore`, undefined, { 'if-match': cur.etag })).statusCode, 200);
    assert.deepEqual((await get(cm, '/api/v1/publishing/overview')).body.pending, [], 'same content as live: nothing pending');
  });

  let r2 = '';

  test('a failed build leaves the live release untouched; retry needs system.deploy', async () => {
    const id = ids.projects!['project-solbar-israel']!;
    const rec = await get(cm, `/api/v1/content/projects/${id}`);
    assert.equal((await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { years: '2010–2012' }, { 'if-match': rec.etag })).statusCode, 200);
    const ov = (await get(cm, '/api/v1/publishing/overview')).body;
    assert.deepEqual(ov.pending.map((p: Json) => p.key), ['project-solbar-israel'], 'the edit is not live');
    r2 = ((await post(cm, '/api/v1/releases', {})).json() as Json).id;
    const live = readCurrent(root);
    assert.equal((await runNextJob(t.deps, fakeBuilder({ fail: 'content' }))).outcome, 'done');
    const d = (await get(cm, `/api/v1/releases/${r2}`)).body;
    assert.equal(d.status, 'failed');
    assert.deepEqual(d.failure, { step: 'content', message: 'Проверка содержимого не пройдена' });
    assert.deepEqual(d.validation.errors, ['project-x: empty English text']);
    assert.equal(readCurrent(root), live);
    assert.equal((await releaseRow(r1)).status, 'active');
    assert.ok(!fs.existsSync(releaseDir(root, d.key)));
    assert.equal(problem(await post(editor, `/api/v1/releases/${r2}/retry`)).status, 403, 'editor has no system.deploy');
    assert.equal(problem(await post(cm, `/api/v1/releases/${r2}/activate`, undefined, `"${d.version}"`)).body.code, 'invalid_transition');
    const retry = await post(cm, `/api/v1/releases/${r2}/retry`);
    assert.equal(retry.statusCode, 201, retry.body);
    r2 = (retry.json() as Json).id;
    // Artifact validation failure (a published project without its page) is also a failed build.
    assert.equal((await runNextJob(t.deps, fakeBuilder({ missingPage: true }))).outcome, 'done');
    const v = (await get(owner, `/api/v1/releases/${r2}`)).body;
    assert.equal(v.status, 'failed');
    assert.ok(v.validation.errors.some((e: string) => e.startsWith('missing_page:projects/')));
    r2 = ((await post(owner, `/api/v1/releases/${r2}/retry`)).json() as Json).id;
    assert.equal((await runNextJob(t.deps, fakeBuilder())).outcome, 'done');
    assert.equal((await releaseRow(r2)).status, 'ready');
  });

  test('failed activation keeps the previous release live (corrupted artifact; database failure after the switch)', async () => {
    const live = readCurrent(root);
    const row = await releaseRow(r2);
    const file = path.join(releaseDir(root, row.key), 'index.html');
    fs.chmodSync(releaseDir(root, row.key), 0o755);
    fs.chmodSync(file, 0o644);
    const original = fs.readFileSync(file);
    fs.writeFileSync(file, 'tampered');
    const res = problem(await post(cm, `/api/v1/releases/${r2}/activate`, undefined, `"${row.version}"`));
    assert.equal(res.status, 409);
    assert.match(res.body.title + ((res.body as Json).detail ?? ''), /изменены|Файлы релиза/);
    assert.equal(readCurrent(root), live);
    assert.equal((await releaseRow(r1)).status, 'active');
    fs.writeFileSync(file, original);
    fs.chmodSync(file, 0o444);
    fs.chmodSync(releaseDir(root, row.key), 0o555);
    // The symlink switch succeeds, then the database step fails → switched back.
    const actor = await userRow(cm);
    await assert.rejects(
      activateRelease(t.deps, actor, r2, row.version, 'publish', client, {
        afterSwitch: () => {
          assert.equal(readCurrent(root), row.key, 'switched');
          throw new Error('simulated database outage');
        },
      }),
      (e: Error & { code?: string }) => e.code === 'invalid_transition'
    );
    assert.equal(readCurrent(root), live, 'previous release restored');
    assert.equal((await releaseRow(r1)).status, 'active');
    assert.equal((await releaseRow(r2)).status, 'ready');
    const ev = await t.deps.db!.select().from(s.releaseEvents).where(and(eq(s.releaseEvents.releaseId, r2), eq(s.releaseEvents.event, 'activation_failed')));
    assert.deepEqual(ev.map((e) => (e.detail as Json).reason).sort(), ['artifact_checksum', 'commit_failed']);
  });

  test('stale releases: an older ready candidate cannot replace a newer live release', async () => {
    const older = await releaseRow(r2);
    const r3 = ((await post(cm, '/api/v1/releases', {})).json() as Json).id;
    assert.equal((await runNextJob(t.deps, fakeBuilder())).outcome, 'done');
    const d3 = await get(cm, `/api/v1/releases/${r3}`);
    assert.equal((await post(cm, `/api/v1/releases/${r3}/activate`, undefined, d3.etag)).statusCode, 200);
    assert.equal((await releaseRow(r2)).status, 'superseded', 'older ready candidates are superseded by a publication');
    assert.equal(problem(await post(cm, `/api/v1/releases/${r2}/activate`, undefined, `"${(await releaseRow(r2)).version}"`)).body.code, 'invalid_transition');
    assert.equal((await releaseRow(r1)).status, 'retired');
    assert.equal(readCurrent(root), (await releaseRow(r3)).key);
    void older;
  });

  test('rollback: re-activates the stored artifact of a retired release (no rebuild); Owner/Admin with step-up only', async () => {
    const d1 = await get(owner, `/api/v1/releases/${r1}`);
    assert.equal(d1.body.canRollback, true);
    assert.equal(problem(await post(cm, `/api/v1/releases/${r1}/rollback`, undefined, d1.etag)).status, 403, 'content manager cannot roll back');
    t.clock.advance(11 * 60_000);
    assert.equal(problem(await post(owner, `/api/v1/releases/${r1}/rollback`, undefined, d1.etag)).body.code, 'step_up_required');
    t.clock.advance(-11 * 60_000);
    const calls: string[] = [];
    const res = await post(owner, `/api/v1/releases/${r1}/rollback`, undefined, d1.etag);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal((await releaseRow(r1)).status, 'active');
    assert.equal(readCurrent(root), (await releaseRow(r1)).key);
    assert.deepEqual(calls, [], 'no build');
    const [ev] = await t.deps.db!.select().from(s.releaseEvents).where(and(eq(s.releaseEvents.releaseId, r1))).orderBy(desc(s.releaseEvents.id)).limit(1);
    assert.equal(ev!.event, 'rollback');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'release.rollback')).orderBy(desc(s.auditEvents.id)).limit(1);
    assert.equal(audit!.result, 'success');
  });

  test('one build at a time: a second worker pass is "busy" while a build runs', async () => {
    await post(cm, '/api/v1/releases', {});
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const calls: string[] = [];
    const first = runNextJob(t.deps, fakeBuilder({ gate, calls }));
    await new Promise((r) => setTimeout(r, 100));
    const second = await runNextJob(t.deps, fakeBuilder({ calls }));
    assert.equal(second.outcome, 'busy');
    open();
    assert.equal((await first).outcome, 'done');
    assert.equal(calls.length, 1);
  });

  test('a lost worker never leaves a release in "building": it is marked failed; startup reconciles with the symlink', async () => {
    const r = ((await post(cm, '/api/v1/releases', {})).json() as Json).id;
    await t.deps.db!.execute(sql`UPDATE releases SET status = 'building', heartbeat_at = now() - interval '10 minutes' WHERE id = ${r}`);
    assert.equal(await recoverStale(t.deps), 1);
    const row = await releaseRow(r);
    assert.equal(row.status, 'failed');
    assert.deepEqual(row.failure, { step: 'worker_lost', message: 'Сборка прервалась (процесс сборки остановлен). Повторите публикацию.' });
    // The symlink points elsewhere (e.g. switched by hand / crash between switch and commit) → the database follows the file system.
    const retired = (await t.deps.db!.select().from(s.releases).where(eq(s.releases.status, 'retired')))[0]!;
    fs.rmSync(currentLink(root));
    fs.symlinkSync(path.join('releases', retired.key), currentLink(root));
    assert.equal(await reconcileActive(t.deps), retired.key);
    assert.equal((await releaseRow(retired.id)).status, 'active');
    assert.equal(await reconcileActive(t.deps), null, 'idempotent');
  });

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  test('preview: one-time token in the URL fragment → cookie; noindex; anonymous, reused, revoked and expired access refused; no token in logs', async () => {
    const lines: string[] = [];
    const server = createPreviewServer(t.deps, { log: (l) => lines.push(l) });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const call = (method: string, p: string, headers: Record<string, string> = {}, body?: string) =>
      new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
          let b = '';
          res.on('data', (c) => (b += c));
          res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: b }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    try {
      const active = (await t.deps.db!.select().from(s.releases).where(eq(s.releases.status, 'active')))[0]!;
      assert.equal((await call('GET', '/')).status, 401, 'anonymous');
      assert.match((await call('GET', '/robots.txt')).body, /Disallow: \//);
      const link = await post(editor, `/api/v1/releases/${active.id}/preview`, { path: '/ru' });
      assert.equal(link.statusCode, 200, link.body);
      const { url } = link.json() as Json;
      assert.ok(url.startsWith('http://preview.soltex.test/__preview#t='), 'token only in the fragment');
      const token = new URLSearchParams(url.split('#')[1]).get('t')!;
      assert.equal((await call('POST', '/__preview/session', { 'content-type': 'application/json' }, JSON.stringify({ token }))).status, 403, 'custom header required');
      const ex = await call('POST', '/__preview/session', { 'content-type': 'application/json', 'x-requested-with': 'soltex-preview' }, JSON.stringify({ token }));
      assert.equal(ex.status, 200, ex.body);
      const setCookie = String(ex.headers['set-cookie']);
      assert.match(setCookie, /HttpOnly; SameSite=Strict/);
      const cookie = setCookie.split(';')[0]!;
      const reuse = await call('POST', '/__preview/session', { 'content-type': 'application/json', 'x-requested-with': 'soltex-preview' }, JSON.stringify({ token }));
      assert.equal(reuse.status, 401, 'one-time token');
      const page = await call('GET', '/ru', { cookie });
      assert.equal(page.status, 200);
      assert.match(page.body, /<html>ru<\/html>/);
      assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
      assert.equal(page.headers['cache-control'], 'no-store');
      assert.equal(page.headers['referrer-policy'], 'no-referrer');
      assert.equal((await call('GET', '/nope', { cookie })).status, 404);
      assert.equal((await call('GET', '/release.json', { cookie })).status, 404);
      // Expiry (30 min) and revocation.
      t.clock.advance(31 * 60_000);
      assert.equal((await call('GET', '/', { cookie })).status, 401, 'expired');
      t.clock.advance(-31 * 60_000);
      assert.equal((await call('GET', '/', { cookie })).status, 200);
      assert.equal((await post(editor, '/api/v1/preview/revoke')).statusCode, 200);
      assert.equal((await call('GET', '/', { cookie })).status, 401, 'revoked');
      // A logged-out admin session ends its previews.
      const link2 = (await post(cm, `/api/v1/releases/${active.id}/preview`, {})).json() as Json;
      const token2 = new URLSearchParams(link2.url.split('#')[1]).get('t')!;
      const ex2 = await call('POST', '/__preview/session', { 'content-type': 'application/json', 'x-requested-with': 'soltex-preview' }, JSON.stringify({ token: token2 }));
      const cookie2 = String(ex2.headers['set-cookie']).split(';')[0]!;
      assert.equal((await call('GET', '/', { cookie: cookie2 })).status, 200);
      await cm.c.req('POST', '/api/v1/auth/logout');
      assert.equal((await call('GET', '/', { cookie: cookie2 })).status, 401, 'session ended');
      // Neither the token nor the cookie value appears in the log or the audit log.
      const logText = lines.join('\n');
      for (const secret of [token, token2, cookie.split('=')[1]!, cookie2.split('=')[1]!]) assert.ok(!logText.includes(secret));
      const audit = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'preview.grant'));
      assert.ok(audit.length >= 2);
      assert.ok(!JSON.stringify(audit).includes(token));
      // The preview changed nothing live.
      assert.equal(readCurrent(root), active.key);
    } finally {
      server.close();
      cm = await signedIn(t, 'content_manager');
    }
  });

  // -------------------------------------------------------------------------
  // Real build (the existing public build pipeline, isolated workspace)
  // -------------------------------------------------------------------------

  test('real build of the seed content: the site of the public build, stored, activatable', { timeout: 300_000 }, async () => {
    await resetToSeed(t);
    await refreshIds();
    const rel = ((await post(cm, '/api/v1/releases', {})).json() as Json).id;
    const res = await runNextJob(t.deps, siteBuilder());
    assert.equal(res.outcome, 'done');
    const row = await releaseRow(rel);
    assert.equal(row.status, 'ready', JSON.stringify(row.failure));
    assert.equal(row.artifactFiles, 229);
    assert.equal(row.artifactPages, 180);
    const d = await get(cm, `/api/v1/releases/${rel}`);
    assert.equal((await post(cm, `/api/v1/releases/${rel}/activate`, undefined, d.etag)).statusCode, 200);
    assert.ok(fs.readFileSync(path.join(currentLink(root), 'ar.html'), 'utf8').includes('dir="rtl"'));
  });
});
