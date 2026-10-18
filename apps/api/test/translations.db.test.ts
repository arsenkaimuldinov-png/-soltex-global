/**
 * Translation management API (Phase F): states (missing, in progress, outdated, approved),
 * source-revision tracking, overview counts, list filters, the translation editor (target language
 * only, fixed structure, placeholders), the review workflow and its permissions, optimistic
 * locking, audit, and the seed-format export / reconcile of approvals.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';
import { exportStore } from '../src/content/export.ts';
import { importStore } from '../src/content/import.ts';
import { legacySourceHash } from '../src/content/legacy-source-hash.ts';
import { reconcileApprovals } from '../src/content/reconcile.ts';
import { readSeedDir, serialize } from '../src/content/seed-files.ts';
import { Client, closeTestDb, DB_ENABLED, makeApp, problem, signedIn, type TestApp } from './helpers.ts';

const SEED = path.resolve(import.meta.dirname, '../../web/src/content/seed');
const CONTENT_TABLES = [
  'media', 'media_translations', 'technologies', 'technology_translations', 'technology_projects',
  'projects', 'project_translations', 'project_gallery', 'products', 'product_translations',
  'epcm_stages', 'epcm_stage_translations', 'patents', 'patent_translations', 'videos', 'video_translations',
  'pages', 'page_translations', 'page_media', 'page_list_items', 'page_list_item_translations',
  'settings', 'settings_translations', 'metrics', 'metric_translations', 'offices', 'office_translations', 'redirects',
];
/** Non-archived records of the seven types in the seed. */
const SEED_ITEMS = 14 + 8 + 6 + 6 + 8 + 6 + 2;

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;

async function resetToSeed(t: TestApp) {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
  await mig.close();
  await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
}

/**
 * Fixture of the API tests: the two legal pages as untranslated records (the seed has them
 * translated since Phase N-0), so the suite keeps a "missing" state to work with.
 */
async function untranslateLegalPages(t: TestApp) {
  const db = t.deps.db!;
  const legal = await db.select({ id: s.pages.id }).from(s.pages).where(inArray(s.pages.key, ['page-privacy', 'page-terms']));
  await db
    .update(s.pageTranslations)
    .set({ trStatus: 'missing', approvedSourceHash: null, approvedAt: null, approvedSourceRevision: null })
    .where(and(inArray(s.pageTranslations.pageId, legal.map((p) => p.id)), ne(s.pageTranslations.locale, 'en')));
}

test('seed-format hash: equals approvedSourceHash of every approved translation in the seed', () => {
  const store = readSeedDir(SEED);
  let n = 0;
  for (const rec of [...store.pages, ...store.projects, ...store.technologies, ...store.products, ...store.epcmStages, ...store.patents, ...store.videos, store.settings])
    for (const e of Object.values(rec.translationStatus))
      if (e.status === 'approved') {
        assert.equal(e.approvedSourceHash, legacySourceHash(rec), rec.id);
        n++;
      }
  assert.equal(n, 255);
});

describe('translation management API', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
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
    t = await makeApp();
    await resetToSeed(t);
    await untranslateLegalPages(t);
    [owner, cm, editor, seo, marketer] = [await signedIn(t, 'owner'), await signedIn(t, 'content_manager'), await signedIn(t, 'editor'), await signedIn(t, 'seo_specialist'), await signedIn(t, 'marketer')];
    await refreshIds();
  });
  after(async () => {
    await resetToSeed(t);
    await t.app.close();
    await closeTestDb();
  });

  const get = async (who: Signed, url: string) => {
    const res = await who.c.req('GET', url);
    assert.equal(res.statusCode, 200, res.body);
    return { body: res.json() as Json, etag: String(res.headers.etag) };
  };
  const tr = (type: string, key: string, locale: string) => `/api/v1/content/${type}/${ids[type]![key]}/translations/${locale}`;
  const save = (who: Signed, url: string, fields: Json, etag: string | null) => who.c.req('PATCH', url, { fields }, etag === null ? {} : { 'if-match': etag });
  const review = (who: Signed, url: string, action: 'approve' | 'reopen', etag: string) => who.c.req('POST', `${url}/${action}`, undefined, { 'if-match': etag });
  const audits = async (resourceId: string, action?: string) =>
    t.deps.db!.select().from(s.auditEvents).where(and(eq(s.auditEvents.resourceId, resourceId), action ? eq(s.auditEvents.action, action) : undefined)).orderBy(desc(s.auditEvents.id));
  const overview = async () => (await get(cm, '/api/v1/translations/overview')).body;
  const ruOf = (o: Json) => o.locales.find((l: Json) => l.locale === 'ru');

  test('authentication is required; every role can read; only the five translated languages', async () => {
    const anon = new Client(t);
    assert.equal(problem(await anon.req('GET', '/api/v1/translations/overview')).status, 401);
    assert.equal((await anon.req('GET', tr('projects', 'project-solbar-ningbo', 'ru'))).statusCode, 401);
    for (const who of [owner, cm, editor, seo, marketer]) {
      assert.equal((await who.c.req('GET', '/api/v1/translations/overview')).statusCode, 200);
      assert.equal((await who.c.req('GET', tr('projects', 'project-solbar-ningbo', 'ar'))).statusCode, 200);
    }
    for (const bad of ['en', 'de', 'RU'])
      assert.equal(problem(await cm.c.req('GET', tr('projects', 'project-solbar-ningbo', bad))).body.code, 'validation_failed', bad);
    assert.equal(problem(await cm.c.req('GET', '/api/v1/content/projects/01900000-0000-7000-8000-000000000000/translations/ru')).status, 404);
    assert.equal(problem(await cm.c.req('GET', '/api/v1/translations?state=draft')).body.code, 'validation_failed');
  });

  test('overview: counts per language from the seed; English is the source, never a backlog', async () => {
    const o = await overview();
    assert.equal(o.sourceLocale, 'en');
    assert.equal(o.total, SEED_ITEMS);
    assert.deepEqual(o.locales.map((l: Json) => l.locale), ['ru', 'zh', 'tr', 'ar', 'es']);
    for (const l of o.locales) {
      // privacy and terms have no translations yet; everything else is approved for the current source.
      assert.deepEqual({ ...l, locale: undefined }, { locale: undefined, total: SEED_ITEMS, missing: 2, inProgress: 0, outdated: 0, approved: SEED_ITEMS - 2, completion: Math.floor(((SEED_ITEMS - 2) * 100) / SEED_ITEMS) });
    }
    const pages = o.types.find((x: Json) => x.type === 'pages');
    assert.equal(pages.total, 14);
    assert.equal(pages.locales[0].missing, 2);
  });

  test('list: filters (locale, type, state, record, search), sort and paging', async () => {
    const all = (await get(cm, '/api/v1/translations?limit=100')).body;
    assert.equal(all.total, SEED_ITEMS * 5);
    assert.equal(all.items.length, 100);
    const ru = (await get(cm, '/api/v1/translations?locale=ru&limit=100')).body;
    assert.equal(ru.total, SEED_ITEMS);
    assert.ok(ru.items.every((i: Json) => i.locale === 'ru'));
    const missing = (await get(cm, '/api/v1/translations?state=missing&limit=100')).body;
    assert.equal(missing.total, 10);
    assert.deepEqual([...new Set(missing.items.map((i: Json) => i.key))].sort(), ['page-privacy', 'page-terms']);
    assert.equal((await get(cm, '/api/v1/translations?state=attention')).body.total, 10);
    const projects = (await get(cm, '/api/v1/translations?type=projects&locale=zh&limit=100')).body;
    assert.equal(projects.total, 8);
    const one = (await get(cm, `/api/v1/translations?entity=${ids.projects!['project-solbar-ningbo']}`)).body;
    assert.equal(one.total, 5);
    assert.deepEqual(one.items.map((i: Json) => i.locale), ['ru', 'zh', 'tr', 'ar', 'es']);
    assert.equal((await get(cm, '/api/v1/translations?q=ningbo&locale=ru')).body.total, 1);
    assert.equal((await get(cm, '/api/v1/translations?q=%25%25%25')).body.total, 0, 'LIKE wildcards are literal');
    const p2 = (await get(cm, '/api/v1/translations?locale=ru&limit=7&offset=7')).body;
    assert.equal(p2.items.length, 7);
    assert.equal(p2.total, SEED_ITEMS);
    const past = (await get(cm, '/api/v1/translations?locale=ru&limit=10&offset=1000')).body;
    assert.deepEqual([past.items.length, past.total], [0, SEED_ITEMS]);
    const byState = (await get(cm, '/api/v1/translations?locale=ru&sort=state&limit=3')).body;
    assert.equal(byState.items[0].state, 'missing');
  });

  test('read: source and target of every translatable field; ETag = source revision . row version', async () => {
    const { body, etag } = await get(cm, tr('projects', 'project-solbar-ningbo', 'ru'));
    assert.equal(etag, body.etag);
    assert.match(etag, /^"\d+\.\d+"$/);
    assert.equal(body.state, 'approved');
    assert.equal(body.sourceLocale, 'en');
    assert.equal(body.approvedSourceRevision, body.sourceRevision);
    const seed = readSeedDir(SEED).projects.find((p) => p.id === 'project-solbar-ningbo')!;
    const title = body.fields.find((f: Json) => f.name === 'title');
    assert.deepEqual([title.kind, title.source, title.target], ['text', seed.title.en, seed.title.ru]);
    const specs = body.fields.find((f: Json) => f.name === 'specs');
    assert.equal(specs.kind, 'pairs');
    assert.equal(specs.target.length, seed.specs.length);
    assert.equal(body.fields.find((f: Json) => f.name === 'seoMetaTitle')?.group ?? 'seo', 'seo');
    assert.ok(!body.fields.some((f: Json) => f.name === 'slug'), 'slugs are not translated');
    const page = (await get(cm, tr('pages', 'page-home', 'ar'))).body;
    const list = page.fields.find((f: Json) => f.name === 'lists.keyDirections');
    assert.equal(list.kind, 'records');
    assert.equal(list.source.length, 6);
  });

  let ningboRu = '';
  let enBefore = '';

  test('editor saves a translation: target language only, state → in_progress, audited; English unchanged', async () => {
    const url = tr('projects', 'project-solbar-ningbo', 'ru');
    const { body, etag } = await get(editor, url);
    ningboRu = url;
    enBefore = JSON.stringify((await t.deps.db!.select().from(s.projectTranslations).where(and(eq(s.projectTranslations.projectId, body.id), eq(s.projectTranslations.locale, 'en'))))[0]);
    const res = await save(editor, url, { title: '  Солбар Нинбо — новый перевод  ', overview: body.fields.find((f: Json) => f.name === 'overview').target }, etag);
    assert.equal(res.statusCode, 200, res.body);
    const v = res.json() as Json;
    assert.equal(v.state, 'in_progress');
    assert.equal(v.fields.find((f: Json) => f.name === 'title').target, 'Солбар Нинбо — новый перевод');
    assert.notEqual(v.etag, etag);
    assert.equal(res.headers.etag, v.etag);
    assert.equal(v.editedSourceRevision, v.sourceRevision);
    const enAfter = JSON.stringify((await t.deps.db!.select().from(s.projectTranslations).where(and(eq(s.projectTranslations.projectId, body.id), eq(s.projectTranslations.locale, 'en'))))[0]);
    assert.equal(enAfter, enBefore, 'the English source row is untouched');
    const [a] = await audits(body.id, 'translation.update');
    assert.deepEqual([a!.result, a!.resourceType, (a!.summary as Json).locale, (a!.summary as Json).fields, (a!.summary as Json).previous_status, (a!.summary as Json).status], ['success', 'project', 'ru', ['title'], 'approved', 'in_progress']);
    assert.ok(a!.requestId);
    assert.ok(!JSON.stringify(a!.summary).includes('Нинбо'), 'no content in the audit log');
    // Other languages are untouched.
    assert.equal((await get(cm, tr('projects', 'project-solbar-ningbo', 'zh'))).body.state, 'approved');
    const o = ruOf(await overview());
    assert.deepEqual([o.inProgress, o.approved], [1, SEED_ITEMS - 3]);
  });

  test('validation: RFC 9457 field errors (required, structure, placeholders, unknown field, limits)', async () => {
    const { body, etag } = await get(editor, ningboRu);
    const specs = body.fields.find((f: Json) => f.name === 'specs');
    const cases: Array<[Json, string, string]> = [
      [{ title: '   ' }, 'title', 'required'],
      [{ title: 'x'.repeat(301) }, 'title', 'too_long'],
      [{ specs: specs.target.slice(1) }, 'specs', 'structure_is_fixed'],
      [{ specs: specs.target.map((p: Json) => ({ ...p, extra: 'x' })) }, 'specs', 'structure_is_fixed'],
      [{ slug: 'x' }, 'slug', 'not_translatable'],
      [{ nonsense: 'x' }, 'nonsense', 'not_translatable'],
    ];
    for (const [fields, field, message] of cases) {
      const res = await save(editor, ningboRu, fields, etag);
      const p = problem(res);
      assert.equal(p.status, 400, `${field}: ${res.body}`);
      assert.match(String(p.type), /application\/problem\+json/);
      assert.equal(p.body.code, 'validation_failed');
      assert.ok(p.body.request_id);
      assert.deepEqual((p.body as Json).errors, [{ field, message }]);
    }
    // Placeholders of a template text must be kept.
    const pageUrl = tr('pages', 'page-project-detail', 'es');
    const page = await get(cm, pageUrl);
    const res = await save(cm, pageUrl, { 'copy.ctaTitle': 'Consulte sobre una planta como esta' }, page.etag);
    assert.deepEqual((problem(res).body as Json).errors, [{ field: 'copy.ctaTitle', message: 'placeholders' }]);
    const ok = await save(cm, pageUrl, { 'copy.ctaTitle': 'Consulte sobre una planta como {title}' }, page.etag);
    assert.equal(ok.statusCode, 200, ok.body);
    // Unknown body shape → schema validation.
    assert.equal(problem(await editor.c.req('PATCH', ningboRu, { title: 'x' }, { 'if-match': etag })).body.code, 'validation_failed');
  });

  test('optimistic locking: stale ETag → 409, missing If-Match → 428; nothing is overwritten', async () => {
    const a = await get(editor, ningboRu);
    const b = await get(cm, ningboRu);
    assert.equal((await save(cm, ningboRu, { title: 'Перевод B' }, b.etag)).statusCode, 200);
    const stale = problem(await save(editor, ningboRu, { title: 'Перевод A' }, a.etag));
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'edit_conflict');
    assert.equal(stale.body.title, 'Запись была изменена другим пользователем. Обновите страницу перед сохранением.');
    assert.equal((await get(cm, ningboRu)).body.fields.find((f: Json) => f.name === 'title').target, 'Перевод B');
    assert.equal(problem(await save(editor, ningboRu, { title: 'x' }, null)).status, 428);
    assert.equal(problem(await save(editor, ningboRu, { title: 'x' }, '"3"')).status, 428);
    assert.equal(problem(await review(cm, ningboRu, 'approve', a.etag)).status, 409);
  });

  test('permissions: marketer is read-only; editor cannot review; SEO specialist edits only SEO texts — all enforced and audited', async () => {
    const { body, etag } = await get(cm, ningboRu);
    assert.equal(problem(await save(marketer, ningboRu, { title: 'x' }, etag)).status, 403);
    assert.equal(problem(await review(marketer, ningboRu, 'approve', etag)).status, 403);
    const denied = problem(await review(editor, ningboRu, 'approve', etag));
    assert.equal(denied.status, 403);
    const [d] = await t.deps.db!.select().from(s.auditEvents).where(and(eq(s.auditEvents.action, 'access.denied'), eq(s.auditEvents.actorId, editor.user.id))).orderBy(desc(s.auditEvents.id)).limit(1);
    assert.equal((d!.summary as Json).permission, 'content.publish');
    // SEO specialist: content text refused (403 + audit), SEO text allowed.
    const seoRes = problem(await save(seo, ningboRu, { title: 'SEO меняет заголовок' }, etag));
    assert.equal(seoRes.status, 403);
    assert.deepEqual((seoRes.body as Json).errors, [{ field: 'title', message: 'not_allowed' }]);
    const [refused] = await audits(body.id, 'translation.update');
    assert.deepEqual([refused!.result, (refused!.summary as Json).fields], ['denied', ['title']]);
    const metaField = body.fields.find((f: Json) => f.name === 'seoMetaTitle');
    if (metaField) {
      const ok = await save(seo, ningboRu, { seoMetaTitle: 'Солбар Нинбо — SEO' }, etag);
      assert.equal(ok.statusCode, 200, ok.body);
    }
    // Editor may not change SEO texts.
    if (metaField) assert.equal(problem(await save(editor, ningboRu, { seoMetaTitle: 'x' }, (await get(cm, ningboRu)).etag)).status, 403);
  });

  test('approve: content.publish; records the reviewed source revision; audited; counts', async () => {
    const { body, etag } = await get(cm, ningboRu);
    assert.equal(body.state, 'in_progress');
    const res = await review(cm, ningboRu, 'approve', etag);
    assert.equal(res.statusCode, 200, res.body);
    const v = res.json() as Json;
    assert.equal(v.state, 'approved');
    assert.equal(v.approvedSourceRevision, v.sourceRevision);
    assert.equal(v.approvedBy.id, cm.user.id);
    assert.equal(v.approvedAt, t.clock.now().toISOString().slice(0, 10));
    const [a] = await audits(body.id, 'translation.approve');
    assert.deepEqual([(a!.summary as Json).locale, (a!.summary as Json).previous_status, (a!.summary as Json).status, (a!.summary as Json).revision], ['ru', 'in_progress', 'approved', v.sourceRevision]);
    assert.equal(problem(await review(cm, ningboRu, 'approve', v.etag)).body.code, 'invalid_transition', 'already approved');
    assert.equal(ruOf(await overview()).approved, SEED_ITEMS - 2);
  });

  test('source text change → approved translations outdated; unrelated change → not; re-approval records the new revision', async () => {
    const id = ids.projects!['project-solbar-ningbo']!;
    const rec = await get(cm, `/api/v1/content/projects/${id}`);
    const before = (await get(cm, ningboRu)).body;
    // Unrelated (language-independent) fields: no new source revision.
    const r1 = await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { imagePosition: 'center 30%', position: rec.body.position + 100 }, { 'if-match': rec.etag });
    assert.equal(r1.statusCode, 200, r1.body);
    const same = (await get(cm, ningboRu)).body;
    assert.deepEqual([same.state, same.sourceRevision], ['approved', before.sourceRevision]);
    // A translated source field: new revision, every approved language outdated.
    const r2 = await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { overview: `${rec.body.fields.overview} Updated.` }, { 'if-match': `"${(r1.json() as Json).version}"` });
    assert.equal(r2.statusCode, 200, r2.body);
    for (const l of ['ru', 'zh', 'tr', 'ar', 'es']) {
      const v = (await get(cm, tr('projects', 'project-solbar-ningbo', l))).body;
      assert.equal(v.state, 'outdated', l);
      assert.equal(v.sourceRevision, before.sourceRevision + 1);
    }
    const o = await overview();
    assert.deepEqual([ruOf(o).outdated, ruOf(o).approved], [1, SEED_ITEMS - 3]);
    assert.equal((await get(cm, '/api/v1/translations?state=outdated&locale=zh')).body.items[0].key, 'project-solbar-ningbo');
    // Outdated → (reviewed) approved again with the new revision.
    const cur = await get(cm, ningboRu);
    const ok = (await review(cm, ningboRu, 'approve', cur.etag)).json() as Json;
    assert.deepEqual([ok.state, ok.approvedSourceRevision], ['approved', before.sourceRevision + 1]);
    // Reopen returns it to work.
    const re = (await review(cm, ningboRu, 'reopen', ok.etag)).json() as Json;
    assert.equal(re.state, 'in_progress');
    assert.equal(problem(await review(cm, ningboRu, 'reopen', re.etag)).body.code, 'invalid_transition');
    // An editor saving after a source change: "source changed since the last save" hint.
    const es = await get(editor, tr('projects', 'project-solbar-ningbo', 'es'));
    assert.equal((await save(editor, tr('projects', 'project-solbar-ningbo', 'es'), { title: 'Solbar Ningbo (ES)' }, es.etag)).statusCode, 200);
    const rec2 = await get(cm, `/api/v1/content/projects/${id}`);
    await cm.c.req('PATCH', `/api/v1/content/projects/${id}`, { title: `${rec2.body.fields.title} ` + 'II' }, { 'if-match': rec2.etag });
    const esAfter = (await get(cm, tr('projects', 'project-solbar-ningbo', 'es'))).body;
    assert.deepEqual([esAfter.state, esAfter.sourceChangedSinceEdit], ['in_progress', true]);
    // The translator's old ETag no longer matches (the source changed).
    assert.equal(problem(await save(editor, tr('projects', 'project-solbar-ningbo', 'es'), { title: 'x' }, es.etag)).status, 409);
  });

  test('missing translation: confirm the copy as a start; cannot be approved before; pages lists keep structure', async () => {
    const url = tr('pages', 'page-privacy', 'zh');
    const m = await get(cm, url);
    assert.equal(m.body.state, 'missing');
    assert.equal(problem(await review(cm, url, 'approve', m.etag)).body.code, 'invalid_transition');
    const res = await save(editor, url, {}, m.etag);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal((res.json() as Json).state, 'in_progress');
    assert.equal(problem(await save(marketer, url, {}, (res.json() as Json).etag)).status, 403);
    // Page list items: texts of one language change, structure is fixed.
    const home = await get(cm, tr('pages', 'page-home', 'tr'));
    const list = home.body.fields.find((f: Json) => f.name === 'lists.keyDirections');
    const edited = list.target.map((it: Json, i: number) => (i === 0 ? Object.fromEntries(Object.keys(it).map((k) => [k, `${it[k]} (TR)`])) : it));
    const ok = await save(cm, tr('pages', 'page-home', 'tr'), { 'lists.keyDirections': edited }, home.etag);
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual((ok.json() as Json).fields.find((f: Json) => f.name === 'lists.keyDirections').target[0], edited[0]);
    const en = (await get(cm, tr('pages', 'page-home', 'ru'))).body.fields.find((f: Json) => f.name === 'lists.keyDirections').source;
    assert.deepEqual(en, list.source, 'source list unchanged');
  });

  test('archived records: translations read-only and not counted', async () => {
    const c = await cm.c.req('POST', '/api/v1/content/videos', {
      title: 'Archive me',
      video: ((await cm.c.req('GET', '/api/v1/content/media?kind=video')).json().items as Json[])[0]!.id,
      poster: ((await cm.c.req('GET', '/api/v1/content/media?kind=image')).json().items as Json[])[0]!.id,
    });
    assert.equal(c.statusCode, 201, c.body);
    const rec = c.json() as Json;
    const totalWith = (await overview()).total;
    const arch = await cm.c.req('POST', `/api/v1/content/videos/${rec.id}/archive`, undefined, { 'if-match': `"${rec.version}"` });
    assert.equal(arch.statusCode, 200);
    assert.equal((await overview()).total, totalWith - 1);
    const url = `/api/v1/content/videos/${rec.id}/translations/ru`;
    const v = await get(cm, url);
    assert.equal(v.body.editable, false);
    assert.equal(problem(await save(cm, url, { title: 'x' }, v.etag)).body.code, 'invalid_transition');
  });

  test('export: current approvals carry the seed-format hash; outdated ones keep a stale hash; reconcile links them back', async () => {
    const store = await exportStore(t.deps.db!);
    const ningbo = store.projects.find((p) => p.id === 'project-solbar-ningbo')!;
    const h = legacySourceHash(ningbo);
    // ru: reopened (in progress); zh: outdated (stale hash); privacy zh: in progress.
    assert.equal(ningbo.translationStatus.ru.status, 'in_progress');
    assert.equal(ningbo.translationStatus.zh.status, 'approved');
    assert.notEqual(ningbo.translationStatus.zh.approvedSourceHash, h, 'outdated approval keeps its old hash');
    // Approve zh again → exported as current.
    const zh = await get(cm, tr('projects', 'project-solbar-ningbo', 'zh'));
    assert.equal((await review(cm, tr('projects', 'project-solbar-ningbo', 'zh'), 'approve', zh.etag)).statusCode, 200);
    const store2 = await exportStore(t.deps.db!);
    const n2 = store2.projects.find((p) => p.id === 'project-solbar-ningbo')!;
    assert.equal(n2.translationStatus.zh.approvedSourceHash, legacySourceHash(n2));
    // Export → import is lossless for the review states: the export carries the hashes, the
    // import (reconcile) links them back to the database revisions.
    const states = async () => {
      const out: string[] = [];
      for (let offset = 0; offset < SEED_ITEMS * 5 + 10; offset += 100)
        out.push(...(await get(cm, `/api/v1/translations?limit=100&offset=${offset}`)).body.items.map((i: Json) => `${i.key}:${i.locale}:${i.state}`));
      return out;
    };
    const before = await states();
    const exported = await exportStore(t.deps.db!);
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
    await mig.close();
    await t.deps.db!.transaction((tx) => importStore(tx, JSON.parse(JSON.stringify(exported))));
    await refreshIds();
    assert.deepEqual(await states(), before);
    assert.equal(await reconcileApprovals(t.deps.db!), 0, 'idempotent');
  });

  test('a database from before Phase F: approvals whose English text changed are outdated after reconcile', async () => {
    await resetToSeed(t);
    const db = t.deps.db!;
    // Simulate a Phase E database: approvals without revisions, and one English text edited.
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    for (const table of ['project_translations', 'technology_translations', 'product_translations', 'epcm_stage_translations', 'patent_translations', 'video_translations', 'page_translations'])
      await mig.pool.query(`UPDATE ${table} SET approved_source_revision = NULL`);
    await mig.pool.query(`UPDATE project_translations t SET title = title || ' (edited)' FROM projects p WHERE p.id = t.project_id AND p.key = 'project-solbar-israel' AND t.locale = 'en'`);
    await mig.close();
    assert.equal(await reconcileApprovals(db), 250 - 5); // Phase N-0: the legal pages are translated in the seed (+10)
    await refreshIds();
    const israel = (await get(cm, `/api/v1/translations?entity=${ids.projects!['project-solbar-israel']}`)).body.items;
    assert.deepEqual(israel.map((i: Json) => i.state), ['outdated', 'outdated', 'outdated', 'outdated', 'outdated']);
    assert.equal(ruOf(await overview()).approved, SEED_ITEMS - 1);
    await resetToSeed(t);
    // After a clean import the database exports exactly the seed.
    assert.equal(serialize(await exportStore(db)), serialize(readSeedDir(SEED)));
  });
});
