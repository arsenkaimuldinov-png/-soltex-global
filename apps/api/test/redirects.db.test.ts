/**
 * Redirects and address changes (Phase I-2, docs/admin-seo.md §8): CRUD with normalization,
 * collapsing and SEO checks; the slug change of a published record; the nginx lookup endpoint
 * served from the ACTIVE release; permissions and audit. The path rules themselves are
 * unit-tested in packages/core/test/redirects.test.ts.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { desc, eq } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { closeTestDb, DB_ENABLED, makeApp, signedIn, type TestApp } from './helpers.ts';
import { activateWorkingCopy, resetToSeed } from './release-helpers.ts';

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;
const problem = (res: { json: () => unknown }) => res.json() as Json;

describe('Redirects and address changes (Phase I-2)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let seo: Signed, cm: Signed, editor: Signed;
  let projects: Record<string, string> = {};

  before(async () => {
    t = await makeApp({ PUBLIC_SITE_URL: 'https://soltexglobal.co' });
    await resetToSeed(t);
    [seo, cm, editor] = [await signedIn(t, 'seo_specialist'), await signedIn(t, 'content_manager'), await signedIn(t, 'editor')];
    const res = await cm.c.req('GET', '/api/v1/content/projects?limit=100');
    projects = Object.fromEntries((res.json().items as Json[]).map((i) => [i.slug, i.id]));
  });
  after(async () => {
    await resetToSeed(t);
    await t.app.close();
    await closeTestDb();
  });

  const create = (who: Signed, body: Json) => who.c.req('POST', '/api/v1/redirects', body);
  const byFrom = async (from: string) => (await t.deps.db!.select().from(s.redirects).where(eq(s.redirects.fromPath, from)))[0];
  const lookup = (p: string, remoteAddress = '127.0.0.1') => t.app.inject({ method: 'GET', url: '/internal/v1/redirect', remoteAddress, headers: { 'x-lookup-path': Buffer.from(p, 'utf8').toString('latin1') } });

  test('create: normalized paths, 201 with ETag, audit; permissions redirects.read / redirects.manage', async () => {
    const res = await create(seo, { from: 'https://soltexglobal.co/old-company/', to: '/company' });
    assert.equal(res.statusCode, 201, res.body);
    const r = res.json() as Json;
    assert.deepEqual([r.from, r.to, r.statusCode, r.allLocales, r.source, r.version, r.hits], ['/old-company', '/company', 301, true, 'manual', 1, 0]);
    assert.equal(res.headers.etag, '"1"');
    assert.deepEqual(r.issues, []);
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'redirect.create')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.deepEqual([audit!.result, audit!.resourceId, (audit!.summary as Json).from], ['success', r.id, '/old-company']);

    const list = await cm.c.req('GET', '/api/v1/redirects?q=old-comp');
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().total, 1);
    assert.equal(problem(await create(cm, { from: '/x', to: '/company' })).code, 'forbidden', 'content manager: read only');
    assert.equal(problem(await editor.c.req('GET', '/api/v1/redirects')).code, 'forbidden');
  });

  test('refused on save: syntax (§11.2), duplicate source, missing target, shadowing a live page, self', async () => {
    const field = async (body: Json) => {
      const p = problem(await create(seo, body));
      return `${p.code}:${p.errors?.map((e: Json) => `${e.field}=${e.message}`).join(',') ?? ''}`;
    };
    assert.equal(await field({ from: '/a', to: 'https://evil.example' }), 'validation_failed:to=scheme');
    assert.equal(await field({ from: '/a', to: '//evil.example' }), 'validation_failed:to=protocol_relative');
    assert.equal(await field({ from: '/a%2Fb', to: '/company' }), 'validation_failed:from=encoded');
    assert.equal(await field({ from: '/a/../b', to: '/company' }), 'validation_failed:from=dot_segment');
    assert.equal(await field({ from: '/ru/a', to: '/company' }), 'validation_failed:from=locale_prefix');
    assert.equal(await field({ from: '/a?x=1', to: '/company' }), 'validation_failed:from=query');
    assert.equal(await field({ from: '/images/x.webp', to: '/company' }), 'validation_failed:from=reserved');
    assert.equal(await field({ from: '/same', to: '/same/' }), 'validation_failed:to=self');
    assert.equal(await field({ from: '/old-company', to: '/contact' }), 'redirect_exists:from=exists');
    assert.equal(await field({ from: '/gone', to: '/nowhere' }), 'redirect_rejected:to=redirect_target_missing');
    assert.equal(await field({ from: '/contact', to: '/company' }), 'redirect_rejected:from=redirect_shadows_page');
    assert.equal(await field({ from: '/ru/old-company', to: '/ru', allLocales: false }), 'redirect_rejected:from=redirect_duplicate');
    assert.equal((await t.deps.db!.select().from(s.redirects)).filter((r) => r.source !== 'import').length, 1, 'nothing stored by refused saves (besides the seed redirects)');
  });

  test('chains are collapsed: a new rule to a redirected path points to the final page; rules to its source are rewritten', async () => {
    // /older → /old-company would be a chain (/old-company → /company): stored as /older → /company
    const a = await create(seo, { from: '/older', to: '/old-company' });
    assert.equal(a.statusCode, 201, a.body);
    assert.equal(a.json().to, '/company');
    // /company-2010 → /older, then /older changes: rules pointing to it follow
    assert.equal((await create(seo, { from: '/company-2010', to: '/older' })).json().to, '/company');
    const older = await byFrom('/older');
    const res = await seo.c.req('PATCH', `/api/v1/redirects/${older!.id}`, { from: '/older', to: '/contact' }, { 'if-match': `"${older!.version}"` });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().version, 2);
    assert.equal((await byFrom('/company-2010'))!.toPath, '/company', 'pointed to the final page already, not to /older');
    // optimistic lock
    assert.equal(problem(await seo.c.req('PATCH', `/api/v1/redirects/${older!.id}`, { from: '/older', to: '/company' }, { 'if-match': '"1"' })).code, 'edit_conflict');
    assert.equal(problem(await seo.c.req('PATCH', `/api/v1/redirects/${older!.id}`, { from: '/older', to: '/company' })).code, 'precondition_required');
    // delete
    const del = await seo.c.req('DELETE', `/api/v1/redirects/${older!.id}`, undefined, { 'if-match': '"2"' });
    assert.equal(del.statusCode, 204, del.body);
    assert.equal(await byFrom('/older'), undefined);
  });

  test('a published record’s address: PATCH is refused, POST …/slug changes it and creates the 301', async () => {
    const id = projects['solbar-israel']!;
    const cur = await seo.c.req('GET', `/api/v1/content/projects/${id}`);
    const locked = problem(await seo.c.req('PATCH', `/api/v1/content/projects/${id}`, { slug: 'x' }, { 'if-match': String(cur.headers.etag) }));
    assert.deepEqual([locked.code, locked.errors[0].message], ['invalid_transition', 'locked_published']);
    // an older rule pointing to the current address is rewritten to the new one
    assert.equal((await create(seo, { from: '/projects/israel', to: '/projects/solbar-israel' })).statusCode, 201);

    const bad = async (slug: string) => problem(await seo.c.req('POST', `/api/v1/content/projects/${id}/slug`, { slug }, { 'if-match': String(cur.headers.etag) }));
    assert.equal((await bad('solbar-israel')).errors[0].message, 'unchanged');
    assert.equal((await bad('Bad Slug')).errors[0].message, 'format');
    assert.equal((await bad('solbar-ningbo')).code, 'slug_taken');
    assert.equal(problem(await cm.c.req('POST', `/api/v1/content/projects/${id}/slug`, { slug: 'solbar-israel-plant' }, { 'if-match': String(cur.headers.etag) })).code, 'forbidden');

    const res = await seo.c.req('POST', `/api/v1/content/projects/${id}/slug`, { slug: 'solbar-israel-plant' }, { 'if-match': String(cur.headers.etag) });
    assert.equal(res.statusCode, 200, res.body);
    const out = res.json() as Json;
    assert.deepEqual([out.slug, out.redirect, out.rewritten], ['solbar-israel-plant', { from: '/projects/solbar-israel', to: '/projects/solbar-israel-plant' }, 1]);
    assert.equal(out.version, Number(String(cur.headers.etag).replace(/"/g, '')) + 1);
    assert.equal((await byFrom('/projects/solbar-israel'))!.source, 'slug_change');
    assert.equal((await byFrom('/projects/israel'))!.toPath, '/projects/solbar-israel-plant');
    // every language row has the new slug; translations did not become outdated
    const rows = await t.deps.db!.select({ slug: s.projectTranslations.slug }).from(s.projectTranslations).where(eq(s.projectTranslations.projectId, id));
    assert.deepEqual([...new Set(rows.map((r) => r.slug))], ['solbar-israel-plant']);
    const rec = (await seo.c.req('GET', `/api/v1/content/projects/${id}`)).json() as Json;
    assert.equal(rec.translations.ru.status, 'approved');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'content.slug_change')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.deepEqual([(audit!.summary as Json).slug, (audit!.summary as Json).previous_slug], ['solbar-israel-plant', 'solbar-israel']);
    // the next release has no BLOCKING issue
    assert.equal((await seo.c.req('GET', '/api/v1/seo/report?severity=blocking')).json().summary.blocking, 0);

    // back to the old address: the reverse rule is removed instead of forming a loop
    const v = String((await seo.c.req('GET', `/api/v1/content/projects/${id}`)).headers.etag);
    const back = await seo.c.req('POST', `/api/v1/content/projects/${id}/slug`, { slug: 'solbar-israel' }, { 'if-match': v });
    assert.equal(back.statusCode, 200, back.body);
    assert.equal(await byFrom('/projects/solbar-israel'), undefined, 'the rule from the address the page now lives at is gone');
    assert.equal((await byFrom('/projects/solbar-israel-plant'))!.toPath, '/projects/solbar-israel');
    assert.equal((await byFrom('/projects/israel'))!.toPath, '/projects/solbar-israel');
  });

  test('lookup for nginx: active release only, all languages, trailing slash, injection → 404 without Location', async () => {
    assert.equal((await lookup('/projects/solbar-israel-plant')).statusCode, 404, 'no active release yet');
    await activateWorkingCopy(t);
    const r1 = await lookup('/projects/solbar-israel-plant');
    assert.deepEqual([r1.statusCode, r1.headers.location], [301, 'https://soltexglobal.co/projects/solbar-israel']);
    const r2 = await lookup('/ar/old-company');
    assert.deepEqual([r2.statusCode, r2.headers.location], [301, 'https://soltexglobal.co/ar/company']);
    const r3 = await lookup('/ru/company/');
    assert.deepEqual([r3.statusCode, r3.headers.location], [301, 'https://soltexglobal.co/ru/company'], 'trailing slash of a live page');
    assert.equal((await lookup('/unknown')).statusCode, 404);
    for (const bad of ['company', '//evil.example', '/a\\b', 'javascript:alert(1)', '/a\r\nLocation: https://evil.example', '/a%0d%0a', '/a%2fb', '/a/../company', `/${'a'.repeat(2050)}`]) {
      const res = await t.app.inject({ method: 'GET', url: '/internal/v1/redirect', remoteAddress: '127.0.0.1', headers: { 'x-lookup-path': bad.replace(/[\r\n]/g, ' ') } });
      assert.equal(res.statusCode, 404, bad);
      assert.equal(res.headers.location, undefined, bad);
    }
    assert.equal((await lookup('/old-company', '203.0.113.9')).statusCode, 404, 'not reachable except from nginx on loopback');
    // a rule added after the release is not served until the next release
    assert.equal((await create(seo, { from: '/later', to: '/contact' })).statusCode, 201);
    assert.equal((await lookup('/later')).statusCode, 404);
    // non-ASCII paths (nginx passes decoded UTF-8)
    assert.equal((await create(seo, { from: '/%D0%BE-%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8', to: '/company' })).json().from, '/о-компании');
    await activateWorkingCopy(t);
    const r4 = await lookup('/ru/о-компании');
    assert.deepEqual([r4.statusCode, r4.headers.location], [301, 'https://soltexglobal.co/ru/company']);
    assert.equal((await lookup('/later')).statusCode, 301);
    // hit counter (asynchronous)
    for (let i = 0; i < 50 && !(await byFrom('/old-company'))!.hits; i++) await new Promise((r) => setTimeout(r, 20));
    const hit = (await byFrom('/old-company'))!;
    assert.ok(hit.hits >= 1 && hit.lastHitAt, 'hits counted');
    assert.equal(hit.version, 1, 'counting hits is not an edit');
  });
});
