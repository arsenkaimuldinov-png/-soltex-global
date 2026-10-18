/**
 * SEO checks in the API (Phase I-1, docs/admin-seo.md): the site report (next release), the record
 * report (effective title / description / URL per language), and the BLOCKING rule at
 * «Отметить к публикации» and «Создать релиз». The checks themselves are unit-tested in
 * packages/core/test/seo-checker.test.ts.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';
import { importStore } from '../src/content/import.ts';
import { readSeedDir } from '../src/content/seed-files.ts';
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

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;

async function resetToSeed(t: TestApp) {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
  await mig.close();
  await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
}

describe('SEO checks (Phase I-1)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let cm: Signed, editor: Signed, seo: Signed, marketer: Signed;
  const ids: Record<string, Record<string, string>> = {};

  before(async () => {
    t = await makeApp();
    await resetToSeed(t);
    [cm, editor, seo, marketer] = [await signedIn(t, 'content_manager'), await signedIn(t, 'editor'), await signedIn(t, 'seo_specialist'), await signedIn(t, 'marketer')];
    for (const col of ['projects', 'technologies', 'products']) {
      const res = await cm.c.req('GET', `/api/v1/content/${col}?limit=100`);
      ids[col] = Object.fromEntries((res.json().items as Json[]).map((i) => [i.key, i.id]));
    }
  });
  after(async () => {
    await resetToSeed(t);
    await t.app.close();
    await closeTestDb();
  });

  const get = async (who: Signed, url: string) => {
    const res = await who.c.req('GET', url);
    assert.equal(res.statusCode, 200, res.body);
    return res.json() as Json;
  };
  const patch = async (who: Signed, url: string, body: Json) => {
    const cur = await who.c.req('GET', url);
    const res = await who.c.req('PATCH', url, body, { 'if-match': String(cur.headers.etag) });
    assert.equal(res.statusCode, 200, res.body);
  };
  const setPublished = async (type: string, id: string, publish: boolean) => {
    const cur = await cm.c.req('GET', `/api/v1/content/${type}/${id}`);
    return cm.c.req('POST', `/api/v1/content/${type}/${id}/${publish ? 'publish' : 'unpublish'}`, undefined, { 'if-match': String(cur.headers.etag) });
  };
  const releases = async () => (await t.deps.db!.select().from(s.releases)).length;
  const LONG = 'Industrial pectin plant with alcohol-free extraction, membrane ultrafiltration, vacuum evaporation and spray drying — turnkey EPCM delivery by Soltex';

  test('site report of the seed: no BLOCKING issue, 186 pages, warnings with links to the records; seo.read for every role', async () => {
    const r = await get(seo, '/api/v1/seo/report');
    assert.equal(r.summary.blocking, 0, JSON.stringify(r.issues.filter((i: Json) => i.severity === 'blocking')));
    assert.equal(r.pages, 186);
    assert.ok(r.summary.warning > 0);
    const projectIssue = r.issues.find((i: Json) => i.type === 'projects');
    assert.ok(projectIssue.record?.id && projectIssue.record.title, 'issues link to the record in the admin');
    const ru = await get(seo, '/api/v1/seo/report?locale=ru&severity=warning');
    assert.ok(ru.issues.length > 0 && ru.issues.every((i: Json) => i.locale === 'ru' && i.severity === 'warning'));
    for (const who of [cm, editor, marketer]) assert.equal((await who.c.req('GET', '/api/v1/seo/report')).statusCode, 200);
    assert.equal((await t.app.inject({ method: 'GET', url: '/api/v1/seo/report' })).statusCode, 401);
  });

  test('record report: the title, description and URL the site renders, per language', async () => {
    const r = await get(editor, `/api/v1/content/projects/${ids.projects!['project-solbar-ningbo']}/seo`);
    assert.equal(r.meta.length, 6);
    const en = r.meta.find((m: Json) => m.locale === 'en');
    assert.equal(en.title, 'SOLBAR NINGBO | Soltex Global');
    assert.equal(en.titleSource, 'default');
    assert.equal(en.url, 'https://soltexglobal.co/projects/solbar-ningbo');
    assert.equal(r.meta.find((m: Json) => m.locale === 'ru').url, 'https://soltexglobal.co/ru/projects/solbar-ningbo');
    assert.equal(r.canPublish, true);
    assert.ok(r.issues.some((i: Json) => i.code === 'title_default' && i.severity === 'info'));
    assert.equal((await editor.c.req('GET', '/api/v1/content/projects/01900000-0000-7000-8000-000000000000/seo')).statusCode, 404);
  });

  test('a title over 120 characters is BLOCKING: the release is refused and nothing is created', async () => {
    const id = ids.projects!['project-solbar-israel']!;
    await patch(seo, `/api/v1/content/projects/${id}`, { seoMetaTitle: LONG });
    const r = await get(seo, `/api/v1/content/projects/${id}/seo`);
    assert.equal(r.canPublish, false);
    assert.ok(r.issues.some((i: Json) => i.code === 'title_too_long' && i.locale === 'en' && i.field === 'seoMetaTitle'));
    assert.ok((await get(seo, '/api/v1/seo/report')).summary.blocking >= 1);
    const before = await releases();
    const refused = problem(await cm.c.req('POST', '/api/v1/releases', {}));
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'seo_blocking');
    assert.ok((refused.body as Json).errors.some((e: Json) => e.field === 'projects/project-solbar-israel:en:seoMetaTitle' && e.message === 'title_too_long'));
    assert.equal(await releases(), before, 'no snapshot, no release');
    // A preview build is not refused (it exists to look at drafts and problems).
    assert.equal((await cm.c.req('POST', '/api/v1/previews', {})).statusCode, 201);
    await patch(seo, `/api/v1/content/projects/${id}`, { seoMetaTitle: null });
    const ok = await cm.c.req('POST', '/api/v1/releases', {});
    assert.equal(ok.statusCode, 201, ok.body);
    assert.ok((ok.json() as Json).validation.warnings.some((w: string) => /^seo_warnings:\d+$/.test(w)), 'SEO warnings are recorded on the release');
  });

  test('«Отметить к публикации» is refused while the record has a BLOCKING issue', async () => {
    const id = ids.projects!['project-solbar-nebraska']!;
    assert.equal((await setPublished('projects', id, false)).statusCode, 200);
    await patch(cm, `/api/v1/content/projects/${id}`, { seoMetaTitle: LONG });
    const draft = await get(cm, `/api/v1/content/projects/${id}/seo`);
    assert.equal(draft.canPublish, false, 'a draft is checked as if it were published');
    const refused = problem(await setPublished('projects', id, true));
    assert.equal(refused.body.code, 'seo_blocking');
    assert.equal((await t.deps.db!.select().from(s.projects).where(eq(s.projects.id, id)))[0]!.status, 'draft');
    await patch(cm, `/api/v1/content/projects/${id}`, { seoMetaTitle: null });
    assert.equal((await setPublished('projects', id, true)).statusCode, 200);
  });

  test('a published record pointing to an unpublished one blocks the release (relation_broken)', async () => {
    const tech = ids.technologies!['technology-soy-protein'] ?? Object.values(ids.technologies!)[1]!;
    assert.equal((await setPublished('technologies', tech, false)).statusCode, 200);
    const report = await get(seo, '/api/v1/seo/report?severity=blocking');
    assert.ok(report.issues.some((i: Json) => i.code === 'relation_broken' && i.field === 'relatedTechnology'));
    assert.equal(problem(await cm.c.req('POST', '/api/v1/releases', {})).body.code, 'seo_blocking');
    assert.equal((await setPublished('technologies', tech, true)).statusCode, 200);
    assert.equal((await get(seo, '/api/v1/seo/report')).summary.blocking, 0);
  });

  test('the same SEO title on two pages of one language is a WARNING on both', async () => {
    const a = ids.projects!['project-solbar-israel']!;
    const b = ids.projects!['project-solbar-ningbo']!;
    await patch(seo, `/api/v1/content/projects/${a}`, { seoMetaTitle: 'Solbar soy protein plants' });
    await patch(seo, `/api/v1/content/projects/${b}`, { seoMetaTitle: 'Solbar soy protein plants' });
    const r = await get(seo, '/api/v1/seo/report?severity=warning&locale=en');
    const dup = r.issues.filter((i: Json) => i.code === 'title_duplicate');
    assert.deepEqual(dup.map((i: Json) => i.key).sort(), ['project-solbar-israel', 'project-solbar-ningbo']);
    assert.equal(r.summary.blocking, 0, 'duplicates never block');
  });
});
