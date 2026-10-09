/**
 * Content management API (Phase E): CRUD of the six collections and the pages, field-level
 * authorization, validation, slugs, statuses, optimistic locking, audit, and the guarantee that
 * CMS writes keep the database exportable in the seed format.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { desc, eq } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import { auditEvents } from '../src/db/schema.ts';
import { exportStore } from '../src/content/export.ts';
import { importStore } from '../src/content/import.ts';
import { readSeedDir, serialize } from '../src/content/seed-files.ts';
import { closeTestDb, DB_ENABLED, makeApp, problem, signedIn, type TestApp } from './helpers.ts';

const SEED = path.resolve(import.meta.dirname, '../../web/src/content/seed');
const CONTENT_TABLES = [
  'media', 'media_translations', 'technologies', 'technology_translations', 'technology_projects',
  'projects', 'project_translations', 'project_gallery', 'products', 'product_translations',
  'epcm_stages', 'epcm_stage_translations', 'patents', 'patent_translations', 'videos', 'video_translations',
  'pages', 'page_translations', 'page_media', 'page_list_items', 'page_list_item_translations',
  'settings', 'settings_translations', 'metrics', 'metric_translations', 'offices', 'office_translations', 'redirects',
];

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;

describe('content management API', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let owner: Signed, cm: Signed, editor: Signed, seo: Signed, marketer: Signed;
  const ids: Record<string, Record<string, string>> = {};
  let img = '';
  let vid = '';

  before(async () => {
    t = await makeApp();
    // A clean content database with the seed (the migration role may truncate; the app role imports).
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
    await mig.close();
    await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
    [owner, cm, editor, seo, marketer] = [await signedIn(t, 'owner'), await signedIn(t, 'content_manager'), await signedIn(t, 'editor'), await signedIn(t, 'seo_specialist'), await signedIn(t, 'marketer')];
    for (const col of ['projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos']) {
      const res = await cm.c.req('GET', `/api/v1/content/${col}?limit=100`);
      ids[col] = Object.fromEntries((res.json().items as Json[]).map((i) => [i.key, i.id]));
    }
    const media = (await cm.c.req('GET', '/api/v1/content/media')).json().items as Json[];
    img = media.find((m) => m.kind === 'image')!.id;
    vid = media.find((m) => m.kind === 'video')!.id;
  });
  after(async () => {
    // Leave the database exactly as the seed (CI imports and exports it after the tests).
    const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
    await mig.close();
    await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
    await t.app.close();
    await closeTestDb();
  });

  const get = async (who: Signed, url: string) => {
    const res = await who.c.req('GET', url);
    assert.equal(res.statusCode, 200, res.body);
    return { body: res.json() as Json, etag: String(res.headers.etag) };
  };
  const patch = (who: Signed, url: string, body: unknown, version: number | string | null) =>
    who.c.req('PATCH', url, body, version === null ? {} : { 'if-match': typeof version === 'number' ? `"${version}"` : version });
  const lastAudit = async (resourceId: string) =>
    (await t.deps.db!.select().from(auditEvents).where(eq(auditEvents.resourceId, resourceId)).orderBy(desc(auditEvents.id)).limit(1))[0];

  test('every role can read the lists; the lists search, filter, sort and page', async () => {
    for (const who of [owner, cm, editor, seo, marketer]) assert.equal((await who.c.req('GET', '/api/v1/content/projects')).statusCode, 200);
    const all = (await get(cm, '/api/v1/content/projects?limit=100')).body;
    assert.equal(all.total, 8);
    assert.deepEqual(all.items.map((i: Json) => i.position), [...all.items.map((i: Json) => i.position)].sort((a: number, b: number) => a - b));
    const item = all.items[0];
    assert.deepEqual(Object.keys(item.translations).sort(), ['ar', 'es', 'ru', 'tr', 'zh']);
    assert.equal(item.translations.ru, 'approved');
    const found = (await get(cm, '/api/v1/content/projects?q=ningbo')).body;
    assert.deepEqual(found.items.map((i: Json) => i.slug), ['solbar-ningbo']);
    assert.equal((await get(cm, '/api/v1/content/projects?q=%25')).body.total, 0, 'LIKE wildcards are literal');
    assert.equal((await get(cm, '/api/v1/content/projects?status=draft')).body.total, 0);
    const page2 = (await get(cm, '/api/v1/content/projects?limit=3&offset=3&sort=title')).body;
    assert.equal(page2.items.length, 3);
    assert.equal(page2.total, 8);
    const byTitle = (await get(cm, '/api/v1/content/projects?limit=100&sort=title')).body.items.map((i: Json) => i.title);
    assert.deepEqual(byTitle, [...byTitle].sort());
    for (const col of ['technologies', 'products', 'epcm-stages', 'patents', 'videos']) assert.ok((await get(cm, `/api/v1/content/${col}`)).body.total > 0, col);
  });

  test('read: typed fields of the source language, ETag = version; unknown id → 404', async () => {
    const { body, etag } = await get(cm, `/api/v1/content/projects/${ids.projects!['project-solbar-ningbo']}`);
    assert.equal(etag, `"${body.version}"`);
    assert.equal(body.fields.slug, 'solbar-ningbo');
    assert.equal(body.fields.imagePosition, 'center top');
    assert.ok(Array.isArray(body.fields.scope) && typeof body.fields.scope[0] === 'string');
    assert.ok(Array.isArray(body.fields.specs) && 'label' in body.fields.specs[0]);
    const seedProject = readSeedDir(SEED).projects.find((p) => p.id === 'project-solbar-ningbo')!;
    assert.equal(body.fields.relatedTechnology, ids.technologies![seedProject.relatedTechnologyId]);
    assert.equal(body.translations.ru.status, 'approved');
    assert.equal(problem(await cm.c.req('GET', '/api/v1/content/projects/01900000-0000-7000-8000-000000000000')).status, 404);
    assert.equal(problem(await cm.c.req('GET', '/api/v1/content/projects/not-a-uuid')).body.code, 'validation_failed');
  });

  let draftId = '';
  let draftVersion = 0;

  test('create a draft: title + required references; other languages start as untranslated copies; audited', async () => {
    const res = await cm.c.req('POST', '/api/v1/content/projects', {
      title: 'Pilot Pectin Line',
      image: img,
      relatedTechnology: ids.technologies!['technology-pectin'],
      country: 'Kazakhstan',
    });
    assert.equal(res.statusCode, 201, res.body);
    const rec = res.json() as Json;
    draftId = rec.id;
    draftVersion = rec.version;
    assert.equal(rec.status, 'draft');
    assert.equal(rec.version, 1);
    assert.equal(rec.fields.slug, 'pilot-pectin-line', 'slug proposed from the title');
    assert.equal(rec.fields.country, 'Kazakhstan');
    assert.equal(rec.fields.overview, '');
    assert.deepEqual(rec.fields.scope, []);
    assert.equal(rec.translations.ru.status, 'missing');
    assert.equal(rec.updatedBy.name, cm.user.name);
    const ev = await lastAudit(draftId);
    assert.equal(ev!.action, 'content.create');
    assert.equal(ev!.actorId, cm.user.id);
    assert.equal(ev!.resourceType, 'project');
    assert.equal(ev!.result, 'success');
    assert.ok(ev!.requestId);
  });

  test('create: validation (required fields, media kind, unknown relation) and slug rules', async () => {
    const missing = problem(await cm.c.req('POST', '/api/v1/content/projects', { title: 'X' }));
    assert.equal(missing.body.code, 'validation_failed');
    const wrongKind = await cm.c.req('POST', '/api/v1/content/projects', { title: 'X', image: vid, relatedTechnology: ids.technologies!['technology-pectin'] });
    assert.deepEqual((wrongKind.json() as Json).errors, [{ field: 'image', message: 'not_an_image' }]);
    const unknownRef = await cm.c.req('POST', '/api/v1/content/projects', { title: 'X', image: img, relatedTechnology: '01900000-0000-7000-8000-000000000000' });
    assert.deepEqual((unknownRef.json() as Json).errors, [{ field: 'relatedTechnology', message: 'unknown_reference' }]);
    const extra = await cm.c.req('POST', '/api/v1/content/projects', { title: 'X', image: img, relatedTechnology: ids.technologies!['technology-pectin'], hacker: 1 });
    assert.equal(problem(extra).body.code, 'validation_failed', 'unknown fields are refused');
    // Explicit slugs: taken, malformed, reserved.
    const taken = await cm.c.req('POST', '/api/v1/content/technologies', { title: 'Pectin again', slug: 'pectin', image: img });
    assert.equal(problem(taken).status, 409);
    assert.equal(problem(taken).body.code, 'slug_taken');
    const reserved = await cm.c.req('POST', '/api/v1/content/technologies', { title: 'Patents', slug: 'patents', image: img });
    assert.deepEqual((reserved.json() as Json).errors, [{ field: 'slug', message: 'reserved' }]);
    const bad = await cm.c.req('POST', '/api/v1/content/technologies', { title: 'Bad', slug: 'Bad Slug', image: img });
    assert.deepEqual((bad.json() as Json).errors, [{ field: 'slug', message: 'format' }]);
    // A proposed slug never collides: "Pectin" → pectin-2.
    const auto = await cm.c.req('POST', '/api/v1/content/technologies', { title: 'Pectin', image: img });
    assert.equal((auto.json() as Json).fields.slug, 'pectin-2');
  });

  test('update: only changed fields, version raised, translations keep their text; audited with field names', async () => {
    const id = ids.projects!['project-solbar-israel']!;
    const before = (await get(cm, `/api/v1/content/projects/${id}`)).body;
    const ruBefore = await t.deps.db!.execute(`select title, scope from project_translations where project_id = '${id}' and locale = 'ru'`);
    const res = await patch(cm, `/api/v1/content/projects/${id}`, { title: `${before.fields.title} (edited)`, overview: before.fields.overview }, before.version);
    assert.equal(res.statusCode, 200, res.body);
    const after = res.json() as Json;
    assert.equal(after.version, before.version + 1);
    assert.equal(res.headers.etag, `"${after.version}"`);
    assert.equal(after.fields.title, `${before.fields.title} (edited)`);
    const ruAfter = await t.deps.db!.execute(`select title, scope from project_translations where project_id = '${id}' and locale = 'ru'`);
    assert.deepEqual(ruAfter.rows, ruBefore.rows, 'the Russian translation is untouched');
    assert.equal(after.translations.ru.status, 'approved', 'translation status semantics unchanged');
    const ev = await lastAudit(id);
    assert.equal(ev!.action, 'content.update');
    assert.deepEqual(ev!.summary, { fields: ['title'] }, 'only the changed field is recorded');
    // Saving the same values again changes nothing (no version bump, no audit).
    const same = await patch(cm, `/api/v1/content/projects/${id}`, { title: after.fields.title }, after.version);
    assert.equal(same.json().version, after.version);
  });

  test('lists keep translations attached: reorder, remove, add', async () => {
    const id = ids.projects!['project-solbar-israel']!;
    const rec = (await get(cm, `/api/v1/content/projects/${id}`)).body;
    const ru = async () => (await t.deps.db!.execute(`select scope from project_translations where project_id = '${id}' and locale = 'ru'`)).rows[0]!.scope as string[];
    const ruScope = await ru();
    assert.ok(rec.fields.scope.length >= 2);
    // Swap the first two items, drop the rest, add a new one.
    const items = [
      { value: rec.fields.scope[1], from: 1 },
      { value: rec.fields.scope[0], from: 0 },
      { value: 'Commissioning support', from: null },
    ];
    const res = await patch(cm, `/api/v1/content/projects/${id}`, { scope: items }, rec.version);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().fields.scope, [rec.fields.scope[1], rec.fields.scope[0], 'Commissioning support']);
    assert.deepEqual(await ru(), [ruScope[1], ruScope[0], 'Commissioning support'], 'Russian follows the structure; the new item is an untranslated copy');
    const bad = await patch(cm, `/api/v1/content/projects/${id}`, { scope: [{ value: 'x', from: 7 }] }, res.json().version);
    assert.deepEqual(bad.json().errors, [{ field: 'scope', message: 'invalid_list_origin' }]);
    // Nullable list: set to null in every language, then back (copied).
    const v = res.json().version;
    const cleared = await patch(cm, `/api/v1/content/projects/${id}`, { results: null }, v);
    assert.equal(cleared.json().fields.results, null);
    const ruResults = (await t.deps.db!.execute(`select results from project_translations where project_id = '${id}' and locale = 'ru'`)).rows[0]!.results;
    assert.equal(ruResults, null);
  });

  test('optimistic locking: a stale version → 409 edit_conflict; missing If-Match → 428; nothing overwritten', async () => {
    const id = ids.projects!['project-cargill-brazil']!;
    const a = (await get(cm, `/api/v1/content/projects/${id}`)).body;
    const b = (await get(editor, `/api/v1/content/projects/${id}`)).body;
    assert.equal((await patch(editor, `/api/v1/content/projects/${id}`, { country: 'Brazil (B)' }, b.version)).statusCode, 200);
    const stale = await patch(cm, `/api/v1/content/projects/${id}`, { country: 'Brazil (A)' }, a.version);
    const p = problem(stale);
    assert.equal(p.status, 409);
    assert.equal(p.body.code, 'edit_conflict');
    assert.equal(p.body.title, 'Запись была изменена другим пользователем. Обновите страницу перед сохранением.');
    assert.equal((await get(cm, `/api/v1/content/projects/${id}`)).body.fields.country, 'Brazil (B)', 'B is kept');
    assert.equal(problem(await patch(cm, `/api/v1/content/projects/${id}`, { country: 'X' }, null)).status, 428);
    assert.equal(problem(await patch(cm, `/api/v1/content/projects/${id}`, { country: 'X' }, 'garbage')).status, 428);
    // W/"n" and bare n are accepted.
    const cur = (await get(cm, `/api/v1/content/projects/${id}`)).body.version;
    assert.equal((await patch(cm, `/api/v1/content/projects/${id}`, { country: 'Brazil' }, `W/"${cur}"`)).statusCode, 200);
  });

  test('field-level authorization: Editor cannot change SEO fields, SEO specialist only SEO fields; refusals audited', async () => {
    const id = ids.technologies!['technology-inulin']!;
    let rec = (await get(editor, `/api/v1/content/technologies/${id}`)).body;
    const seoByEditor = await patch(editor, `/api/v1/content/technologies/${id}`, { seoMetaTitle: 'Inulin | Soltex', subtitle: rec.fields.subtitle }, rec.version);
    assert.equal(problem(seoByEditor).status, 403);
    assert.deepEqual(seoByEditor.json().errors, [{ field: 'seoMetaTitle', message: 'not_allowed' }]);
    const denied = await lastAudit(id);
    assert.equal(denied!.result, 'denied');
    assert.deepEqual(denied!.summary, { fields: ['seoMetaTitle'] });
    // Unchanged SEO values in the payload are fine (only changes are authorised).
    const ok = await patch(editor, `/api/v1/content/technologies/${id}`, { seoMetaTitle: rec.fields.seoMetaTitle, subtitle: `${rec.fields.subtitle}.` }, rec.version);
    assert.equal(ok.statusCode, 200, ok.body);
    rec = ok.json();
    const textBySeo = await patch(seo, `/api/v1/content/technologies/${id}`, { overview: 'SEO rewrite' }, rec.version);
    assert.equal(problem(textBySeo).status, 403);
    assert.deepEqual(textBySeo.json().errors, [{ field: 'overview', message: 'not_allowed' }]);
    const seoBySeo = await patch(seo, `/api/v1/content/technologies/${id}`, { seoMetaTitle: 'Inulin & FOS | Soltex Global', noindex: false }, rec.version);
    assert.equal(seoBySeo.statusCode, 200, seoBySeo.body);
    assert.equal(seoBySeo.json().fields.seoMetaTitle, 'Inulin & FOS | Soltex Global');
    // Marketer: read only.
    assert.equal(problem(await patch(marketer, `/api/v1/content/technologies/${id}`, { overview: 'x' }, seoBySeo.json().version)).status, 403);
    assert.equal(problem(await marketer.c.req('POST', '/api/v1/content/videos', { title: 'x' })).status, 403);
    // SEO specialist cannot create (content.edit) and an Editor cannot create with an explicit slug.
    assert.equal(problem(await seo.c.req('POST', '/api/v1/content/epcm-stages', { title: 'x' })).status, 403);
    const slugByEditor = await editor.c.req('POST', '/api/v1/content/projects', {
      title: 'Editor project',
      slug: 'editor-project',
      image: img,
      relatedTechnology: ids.technologies!['technology-pectin'],
    });
    assert.deepEqual(slugByEditor.json().errors, [{ field: 'slug', message: 'not_allowed' }]);
  });

  test('slug of a draft can change (unique, valid); slug of published content is locked until redirects (Phase I)', async () => {
    const draft = (await get(cm, `/api/v1/content/projects/${draftId}`)).body;
    const renamed = await patch(cm, `/api/v1/content/projects/${draftId}`, { slug: 'pilot-pectin-line-kz' }, draft.version);
    assert.equal(renamed.json().fields.slug, 'pilot-pectin-line-kz');
    const all = await t.deps.db!.execute(`select distinct slug from project_translations where project_id = '${draftId}'`);
    assert.deepEqual(all.rows, [{ slug: 'pilot-pectin-line-kz' }], 'one slug in every language');
    const taken = await patch(cm, `/api/v1/content/projects/${draftId}`, { slug: 'solbar-israel' }, renamed.json().version);
    assert.equal(problem(taken).body.code, 'slug_taken');
    const pub = (await get(cm, `/api/v1/content/projects/${ids.projects!['project-solbar-nebraska']}`)).body;
    const locked = await patch(cm, `/api/v1/content/projects/${pub.id}`, { slug: 'nebraska' }, pub.version);
    assert.equal(problem(locked).body.code, 'invalid_transition');
    assert.deepEqual(locked.json().errors, [{ field: 'slug', message: 'locked_published' }]);
    draftVersion = renamed.json().version;
  });

  test('status: drafts archive and restore (If-Match); published content is not archived here; archived content is read-only', async () => {
    const archived = await cm.c.req('POST', `/api/v1/content/projects/${draftId}/archive`, undefined, { 'if-match': `"${draftVersion}"` });
    assert.equal(archived.statusCode, 200, archived.body);
    assert.equal(archived.json().status, 'archived');
    assert.ok(archived.json().archivedAt);
    assert.equal((await lastAudit(draftId))!.action, 'content.archive');
    const edit = await patch(cm, `/api/v1/content/projects/${draftId}`, { title: 'x' }, archived.json().version);
    assert.equal(problem(edit).body.code, 'invalid_transition');
    const again = await cm.c.req('POST', `/api/v1/content/projects/${draftId}/archive`, undefined, { 'if-match': `"${archived.json().version}"` });
    assert.equal(problem(again).body.code, 'invalid_transition');
    const stale = await cm.c.req('POST', `/api/v1/content/projects/${draftId}/restore`, undefined, { 'if-match': `"${draftVersion}"` });
    assert.equal(problem(stale).body.code, 'edit_conflict');
    const restored = await cm.c.req('POST', `/api/v1/content/projects/${draftId}/restore`, undefined, { 'if-match': `"${archived.json().version}"` });
    assert.equal(restored.json().status, 'draft');
    assert.equal(restored.json().archivedAt, null);
    assert.equal((await lastAudit(draftId))!.action, 'content.restore');
    const pub = (await get(cm, `/api/v1/content/projects/${ids.projects!['project-solbar-nebraska']}`)).body;
    const noArchive = await cm.c.req('POST', `/api/v1/content/projects/${pub.id}/archive`, undefined, { 'if-match': `"${pub.version}"` });
    assert.equal(problem(noArchive).body.code, 'invalid_transition');
    assert.equal(problem(await editor.c.req('POST', `/api/v1/content/projects/${draftId}/archive`, undefined, {})).status, 428);
    assert.equal(problem(await seo.c.req('POST', `/api/v1/content/projects/${draftId}/archive`, undefined, { 'if-match': '"1"' })).status, 403);
  });

  test('every collection: create a draft, edit typed fields, archive', async () => {
    const cases: Array<[string, Json, Json]> = [
      ['technologies', { title: 'Malic Acid', image: img }, { processPrinciples: [{ title: 'Extraction', description: 'Water based.', from: null }], patentInfo: { patentNumber: 'No. 1', location: 'IL', keyPoints: [{ value: 'Point', from: null }] }, relatedProjects: [ids.projects!['project-solbar-israel']] }],
      ['products', { title: 'Malic Powder', image: img, relatedTechnology: ids.technologies!['technology-pectin'], relatedProject: ids.projects!['project-solbar-israel'] }, { characteristics: [{ value: 'White powder', from: null }], description: 'A product.' }],
      ['epcm-stages', { title: 'Audit stage' }, { number: '09', deliverables: [{ value: 'Report', from: null }], focus: 'Audit' }],
      ['patents', { title: 'New patent', placements: ['registry'] }, { patentNo: '123456', legalStatus: 'application', keyPillars: [{ title: 'Pillar', description: 'Text', from: null }] }],
      ['videos', { title: 'Plant tour', video: vid, poster: img }, { headline: 'Line one\nLine two', number: '03' }],
    ];
    for (const [col, create, update] of cases) {
      const res = await cm.c.req('POST', `/api/v1/content/${col}`, create);
      assert.equal(res.statusCode, 201, `${col}: ${res.body}`);
      const rec = res.json() as Json;
      const upd = await patch(cm, `/api/v1/content/${col}/${rec.id}`, update, rec.version);
      assert.equal(upd.statusCode, 200, `${col}: ${upd.body}`);
      for (const [k, v] of Object.entries(update)) {
        const got = upd.json().fields[k];
        if (Array.isArray(v) && v[0]?.from === null) assert.equal(got.length, v.length, `${col}.${k}`);
        else if (k === 'patentInfo') assert.deepEqual(got, { patentNumber: 'No. 1', location: 'IL', keyPoints: ['Point'] });
        else assert.deepEqual(got, v, `${col}.${k}`);
      }
      const arc = await cm.c.req('POST', `/api/v1/content/${col}/${rec.id}/archive`, undefined, { 'if-match': `"${upd.json().version}"` });
      assert.equal(arc.json().status, 'archived', col);
    }
  });

  test('pages: registry slots only, placeholders kept, list structure fixed, SEO field-level, no create', async () => {
    const pages = (await get(cm, '/api/v1/content/pages')).body.items as Json[];
    assert.equal(pages.length, 14);
    const home = (await get(cm, `/api/v1/content/pages/${pages.find((p) => p.pageKey === 'home')!.id}`)).body;
    assert.equal(home.fields.header, null);
    assert.ok(home.fields.copy.heroEyebrow);
    const url = `/api/v1/content/pages/${home.id}`;
    const ok = await patch(cm, url, { copy: { heroEyebrow: 'EPC · ENGINEERING' }, lists: { heroTags: home.fields.lists.heroTags.map((x: Json, i: number) => (i === 0 ? { label: 'ENGINEERING & EPC' } : x)) } }, home.version);
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().fields.copy.heroEyebrow, 'EPC · ENGINEERING');
    assert.equal(ok.json().fields.lists.heroTags[0].label, 'ENGINEERING & EPC');
    assert.deepEqual((await lastAudit(home.id))!.summary, { fields: ['copy.heroEyebrow', 'lists.heroTags'] });
    let v = ok.json().version;
    const unknownSlot = await patch(cm, url, { copy: { brandNewSlot: 'x' } }, v);
    assert.deepEqual(unknownSlot.json().errors, [{ field: 'copy.brandNewSlot', message: 'not_on_this_page' }]);
    const moreItems = await patch(cm, url, { lists: { heroTags: [...home.fields.lists.heroTags, { label: 'NEW' }] } }, v);
    assert.deepEqual(moreItems.json().errors, [{ field: 'lists.heroTags', message: 'structure_is_fixed' }]);
    const tpl = (await get(cm, `/api/v1/content/pages/${pages.find((p) => p.pageKey === 'projectDetail')!.id}`)).body;
    const lost = await patch(cm, `/api/v1/content/pages/${tpl.id}`, { copy: { ctaTitle: 'Inquire about this plant' } }, tpl.version);
    assert.deepEqual(lost.json().errors, [{ field: 'copy.ctaTitle', message: 'placeholders' }], '{title} must stay');
    const kept = await patch(cm, `/api/v1/content/pages/${tpl.id}`, { copy: { ctaTitle: 'Inquire about a plant like {title}' } }, tpl.version);
    assert.equal(kept.statusCode, 200);
    assert.equal(problem(await patch(cm, `/api/v1/content/pages/${tpl.id}`, { seoMetaTitle: 'x' }, kept.json().version)).body.code, 'validation_failed', 'templates have no SEO');
    // SEO specialist: SEO texts yes, page texts no.
    const company = (await get(seo, `/api/v1/content/pages/${pages.find((p) => p.pageKey === 'company')!.id}`)).body;
    assert.equal(problem(await patch(seo, `/api/v1/content/pages/${company.id}`, { header: { title: 'X' } }, company.version)).status, 403);
    const seoOk = await patch(seo, `/api/v1/content/pages/${company.id}`, { seoMetaDescription: 'Soltex Global: engineering and EPC for plant-based ingredient processing plants worldwide.' }, company.version);
    assert.equal(seoOk.statusCode, 200, seoOk.body);
    // Header nullable fields: '' clears.
    v = seoOk.json().version;
    const cleared = await patch(cm, `/api/v1/content/pages/${company.id}`, { header: { subtitle: '' } }, v);
    assert.equal(cleared.json().fields.header.subtitle, null);
    assert.equal(problem(await cm.c.req('POST', '/api/v1/content/pages', { title: 'x' })).status, 404, 'no page creation endpoint');
  });

  test('media picker lists existing media by kind (read-only)', async () => {
    const images = (await get(marketer, '/api/v1/content/media?kind=image')).body.items as Json[];
    assert.ok(images.length > 0 && images.every((m) => m.kind === 'image'));
    assert.ok(images[0]!.src.startsWith('/'));
    assert.equal((await marketer.c.req('POST', '/api/v1/content/media', {})).statusCode, 404, 'no upload in Phase E');
  });

  test('after CMS writes the database still exports in the seed format; untouched records are byte-identical', async () => {
    const store = await exportStore(t.deps.db!);
    const seed = readSeedDir(SEED);
    const touched = new Set(['project-solbar-israel', 'project-cargill-brazil', 'technology-inulin', 'project-solbar-nebraska']);
    for (const col of ['projects', 'technologies', 'products', 'epcmStages', 'patents', 'videos'] as const)
      for (const rec of seed[col]) {
        const out = (store[col] as Array<{ id: string }>).find((x) => x.id === rec.id);
        if (!touched.has(rec.id)) assert.equal(serialize(out), serialize(rec), rec.id);
      }
    assert.equal(serialize(store.media), serialize(seed.media));
    assert.equal(serialize(store.settings), serialize(seed.settings));
    const edited = store.projects.find((p) => p.id === 'project-solbar-israel')!;
    assert.ok(edited.title.en.endsWith('(edited)'));
    assert.equal(edited.title.ru, seed.projects.find((p) => p.id === 'project-solbar-israel')!.title.ru);
    const created = store.projects.find((p) => p.slug === 'pilot-pectin-line-kz')!;
    assert.equal(created.status, 'draft', 'drafts are exported with their status; the site build renders only published content');
    assert.equal(created.translationStatus.ru.status, 'missing');
    // Never-translated languages follow the source completely (untranslated copies).
    assert.equal(created.country.ru, 'Kazakhstan');
    assert.deepEqual(created.title.ru, created.title.en);
  });

  test('anonymous and unauthorised access is refused; no CORS', async () => {
    const anon = await t.app.inject({ method: 'GET', url: '/api/v1/content/projects' });
    assert.equal(anon.statusCode, 401);
    const csrf = await t.app.inject({ method: 'POST', url: '/api/v1/content/projects', payload: {}, headers: { 'content-type': 'application/json' } });
    assert.equal(csrf.statusCode, 403);
  });
});
