/**
 * Phase L (docs/admin-ui.md): «Обзор» numbers per role, «Система» status, ⌘K content search.
 * Every block and every kind of search result follows the role's read permissions; the numbers
 * agree with the lists they link to; nothing exposes paths or connection strings.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { sql } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import { createLead } from '../src/leads/service.ts';
import { WORKER_APPLICATION_NAME } from '../src/system/overview.ts';
import { closeTestDb, DB_ENABLED, makeApp, signedIn, type TestApp } from './helpers.ts';
import { activateWorkingCopy, resetToSeed } from './release-helpers.ts';

type Json = Record<string, any>;
type Signed = Awaited<ReturnType<typeof signedIn>>;

async function truncateLeads() {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query('TRUNCATE "lead_events", "outbox", "leads"');
  await mig.close();
}

describe('Dashboard, system status, search (Phase L)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let owner: Signed, editor: Signed, marketer: Signed, cm: Signed;
  let reference: string;

  before(async () => {
    const tmp = (n: string) => fs.mkdtempSync(path.join(os.tmpdir(), `soltex-dash-${n}-`));
    t = await makeApp({ RELEASES_DIR: tmp('releases'), MEDIA_DIR: tmp('media') });
    await resetToSeed(t);
    await activateWorkingCopy(t);
    await truncateLeads();
    reference = (await createLead(t.deps, { formType: 'contact_page', fields: { name: 'Дашборд Тестов', phone: '+77010000001', email: 'dash@example.test' }, topic: null, locale: 'ru', pagePath: '/contact', fillMs: 9000 }, 'h')).reference;
    [owner, editor, marketer, cm] = [await signedIn(t, 'owner'), await signedIn(t, 'editor'), await signedIn(t, 'marketer'), await signedIn(t, 'content_manager')];
  });
  after(async () => {
    await truncateLeads();
    await t.app.close();
    await closeTestDb();
  });

  test('dashboard: blocks follow the role; numbers agree with the lists they link to', async () => {
    const all = (await owner.c.req('GET', '/api/v1/dashboard')).json() as Json;
    assert.deepEqual(Object.keys(all).sort(), ['content', 'leads', 'media', 'publishing', 'seo', 'translations']);
    assert.equal(all.leads.byStatus.new, 1);
    assert.equal(all.leads.formsLive, false);
    const report = (await owner.c.req('GET', '/api/v1/seo/report')).json() as Json;
    assert.deepEqual(all.seo, report.summary, 'same check as «Проверка SEO»');
    assert.equal(all.translations.locales.length, 5);
    const overview = (await owner.c.req('GET', '/api/v1/translations/overview')).json() as Json;
    assert.deepEqual(all.translations.locales.map((l: Json) => l.outdated), overview.locales.map((l: Json) => l.outdated));
    const [{ n: drafts }] = (await t.deps.db!.execute(sql`SELECT (SELECT count(*) FROM projects WHERE status='draft') + (SELECT count(*) FROM technologies WHERE status='draft') + (SELECT count(*) FROM products WHERE status='draft') + (SELECT count(*) FROM epcm_stages WHERE status='draft') + (SELECT count(*) FROM patents WHERE status='draft') + (SELECT count(*) FROM videos WHERE status='draft') + (SELECT count(*) FROM pages WHERE status='draft') AS n`)).rows as [{ n: string }];
    assert.equal(all.content.drafts.reduce((n: number, d: Json) => n + d.count, 0), Number(drafts));
    const pub = (await owner.c.req('GET', '/api/v1/publishing/overview')).json() as Json;
    assert.equal(all.content.pending, pub.pending.length);
    assert.ok(all.publishing.active?.key.startsWith('R-TEST-'));
    const attention = (await owner.c.req('GET', '/api/v1/media?attention=true')).json() as Json;
    assert.equal(all.media.attention, attention.total, 'the media filter shows exactly the counted files');
    assert.ok(attention.items.every((m: Json) => m.warnings.length > 0 || m.variants.state === 'missing'));

    const ed = (await editor.c.req('GET', '/api/v1/dashboard')).json() as Json;
    assert.equal(ed.leads, undefined, 'no leads.read');
    assert.ok(ed.content && ed.seo && ed.media);
    const mk = (await marketer.c.req('GET', '/api/v1/dashboard')).json() as Json;
    assert.equal(mk.leads.byStatus.new, 1);
    assert.equal((await t.app.inject({ method: 'GET', url: '/api/v1/dashboard' })).statusCode, 401);
  });

  test('dashboard: «Недавно изменено» lists the records people edited last, each once', async () => {
    const list = (await cm.c.req('GET', '/api/v1/content/projects?limit=1')).json() as Json;
    const id = list.items[0].id;
    const cur = await cm.c.req('GET', `/api/v1/content/projects/${id}`);
    const res = await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { capacity: 'Dashboard test capacity' }, { 'if-match': String(cur.headers.etag) });
    assert.equal(res.statusCode, 200, res.body);
    const again = await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { capacity: 'Dashboard test capacity 2' }, { 'if-match': String(res.headers.etag) });
    assert.equal(again.statusCode, 200, again.body);
    const recent = ((await cm.c.req('GET', '/api/v1/dashboard')).json() as Json).content.recent;
    assert.equal(recent[0].id, id);
    assert.equal(recent[0].type, 'projects');
    assert.equal(recent[0].by, cm.user.name);
    assert.equal(recent.filter((r: Json) => r.id === id).length, 1, 'each record once, with its last edit');
  });

  test('system status: system.read only; database, worker, queues, builds, disk; no paths or secrets', async () => {
    assert.equal((await editor.c.req('GET', '/api/v1/system/status')).statusCode, 403);
    const res = await cm.c.req('GET', '/api/v1/system/status');
    assert.equal(res.statusCode, 200, res.body);
    const st = res.json() as Json;
    assert.equal(st.database.ok, true);
    assert.match(st.database.version, /^\d+/);
    assert.equal(st.worker.running, false, 'no worker in this test');
    assert.ok(st.disk.length >= 1 && st.disk.every((d: Json) => d.totalBytes > 0 && d.freeBytes >= 0 && d.freeBytes <= d.totalBytes));
    assert.deepEqual(st.backups, { configured: false, lastSuccessAt: null, stale: false });
    assert.deepEqual(st.mail, { configured: false, recipients: 0 });
    assert.ok(st.site.active?.key);
    for (const secret of [t.config.publishing.releasesDir, t.config.media.dir, process.env.DATABASE_URL!, 'postgres://']) assert.ok(!res.body.includes(secret), `exposes ${secret.slice(0, 20)}`);

    const fakeWorker = connect(process.env.DATABASE_URL!, 1, WORKER_APPLICATION_NAME);
    await fakeWorker.pool.query('SELECT 1');
    try {
      const w = ((await cm.c.req('GET', '/api/v1/system/status')).json() as Json).worker;
      assert.equal(w.running, true);
      assert.ok(w.since);
    } finally {
      await fakeWorker.close();
    }
  });

  test('search: titles in any language and keys; media; leads only with leads.read; at least 2 characters', async () => {
    const [p] = (await t.deps.db!.execute(sql`SELECT p.id, en.title AS en, ru.title AS ru FROM projects p JOIN project_translations en ON en.project_id = p.id AND en.locale = 'en' JOIN project_translations ru ON ru.project_id = p.id AND ru.locale = 'ru' WHERE en.title <> ru.title ORDER BY p.position LIMIT 1`)).rows as [{ id: string; en: string; ru: string }];
    const find = async (who: Signed, q: string) => ((await who.c.req('GET', `/api/v1/search?q=${encodeURIComponent(q)}`)).json() as Json).items as Json[];

    const byEn = await find(editor, p.en.slice(0, 12));
    const hit = byEn.find((h) => h.kind === 'content' && h.id === p.id)!;
    assert.deepEqual([hit.type, hit.title, hit.match], ['projects', p.en, null]);
    const byRu = (await find(editor, p.ru.slice(0, 12))).find((h) => h.id === p.id)!;
    assert.equal(byRu.title, p.en, 'the source title names the record');
    assert.equal(byRu.match, `RU: ${p.ru}`, 'and the Russian title shows why it matched');

    assert.deepEqual(await find(editor, 'а'), [], 'one character: nothing');
    assert.deepEqual(await find(editor, '%%'), [], 'wildcards are escaped');
    assert.ok((await find(editor, 'jpg')).some((h) => h.kind === 'media'));

    assert.ok(!(await find(editor, 'Дашборд')).some((h) => h.kind === 'lead'), 'editor: no leads');
    const leadHits = (await find(marketer, reference)).filter((h) => h.kind === 'lead');
    assert.equal(leadHits.length, 1);
    assert.equal(leadHits[0]!.title, `${reference} · Дашборд Тестов`);
    assert.equal((await t.app.inject({ method: 'GET', url: '/api/v1/search?q=solbar' })).statusCode, 401);
  });
});
