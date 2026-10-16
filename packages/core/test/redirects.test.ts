/**
 * Redirect rules (Phase I-2): normalization, path rules, expansion per language, resolution,
 * collapsing on save and the locale-aware checks of the SEO checker.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRedirectIndex,
  checkSeo,
  collapseRedirects,
  expandRedirect,
  normalizeRedirectPath,
  redirectLocation,
  redirectPathProblem,
  resolveRedirect,
  splitLocale,
} from '../src/seo/index.ts';

test('normalize: trims, accepts this site’s own address, decodes, drops trailing slashes', () => {
  assert.equal(normalizeRedirectPath('  /old/  '), '/old');
  assert.equal(normalizeRedirectPath('https://soltexglobal.co/ru/old/'), '/ru/old');
  assert.equal(normalizeRedirectPath('https://www.soltexglobal.co'), '/');
  assert.equal(normalizeRedirectPath('https://evil.example/x'), 'https://evil.example/x');
  assert.equal(normalizeRedirectPath('/%D0%BF%D0%B5%D0%BA%D1%82%D0%B8%D0%BD'), '/пектин');
  assert.equal(normalizeRedirectPath('/a%2Fb'), '/a%2Fb', 'reserved escapes stay encoded');
  assert.equal(normalizeRedirectPath('/bad%E0%A4'), '/bad%E0%A4');
  assert.equal(normalizeRedirectPath('/'), '/');
});

test('path rules for redirects', () => {
  assert.equal(redirectPathProblem('/old', 'from', true), null);
  assert.equal(redirectPathProblem('/ru/old', 'from', false), null);
  assert.equal(redirectPathProblem('/ru/old', 'from', true), 'locale_prefix');
  assert.equal(redirectPathProblem('/old?x=1', 'from', false), 'query');
  assert.equal(redirectPathProblem('/old/', 'from', false), 'trailing_slash');
  assert.equal(redirectPathProblem('/', 'from', true), 'reserved');
  assert.equal(redirectPathProblem('/', 'to', true), null);
  assert.equal(redirectPathProblem('/images/a.webp', 'from', true), 'reserved');
  assert.equal(redirectPathProblem('//evil.example', 'to', false), 'protocol_relative');
  assert.equal(redirectPathProblem('/a%2fb', 'from', false), 'encoded');
});

test('splitLocale and expansion per language', () => {
  assert.deepEqual(splitLocale('/ru/projects/x'), { locale: 'ru', path: '/projects/x' });
  assert.deepEqual(splitLocale('/ar'), { locale: 'ar', path: '/' });
  assert.deepEqual(splitLocale('/rugby'), { locale: 'en', path: '/rugby' });
  assert.deepEqual(expandRedirect({ from: '/old', to: '/', allLocales: true }).slice(0, 2), [
    { from: '/old', to: '/' },
    { from: '/ru/old', to: '/ru' },
  ]);
  assert.equal(expandRedirect({ from: '/old', to: '/new', allLocales: true }).length, 6);
  assert.deepEqual(expandRedirect({ from: '/ru/old', to: '/ru/new', allLocales: false }), [{ from: '/ru/old', to: '/ru/new' }]);
});

test('resolve: exact match, chains followed, loops give up, 302 if any hop is temporary', () => {
  const index = buildRedirectIndex([
    { id: 'a', from: '/a', to: '/b', allLocales: true },
    { id: 'b', from: '/b', to: '/company', allLocales: true, statusCode: 302 },
    { id: 'l1', from: '/l1', to: '/l2' },
    { id: 'l2', from: '/l2', to: '/l1' },
    { id: 'bad', from: '/x', to: '//evil.example' },
  ]);
  assert.deepEqual(resolveRedirect(index, '/ru/a'), { id: 'a', to: '/ru/company', statusCode: 302 });
  assert.deepEqual(resolveRedirect(index, '/b'), { id: 'b', to: '/company', statusCode: 302 });
  assert.equal(resolveRedirect(index, '/l1'), null);
  assert.equal(resolveRedirect(index, '/x'), null, 'invalid rules are never served');
  assert.equal(resolveRedirect(index, '/a/'), null, 'exact match only');
  assert.equal(redirectLocation('/ru/пектин'), 'https://soltexglobal.co/ru/%D0%BF%D0%B5%D0%BA%D1%82%D0%B8%D0%BD');
  assert.equal(redirectLocation('/x', 'http://localhost:8080/'), 'http://localhost:8080/x');
});

test('collapse: the new rule points to the final page; rules pointing to its source are rewritten', () => {
  const rules = [
    { id: 'old1', from: '/projects/a', to: '/projects/b', allLocales: true },
    { id: 'next', from: '/projects/c', to: '/projects/d', allLocales: true },
    { id: 'en', from: '/ru/projects/b', to: '/ru/x', allLocales: false },
  ];
  // slug change b → c: /projects/b → /projects/c collapses to /projects/d; old1 now points there too
  assert.deepEqual(collapseRedirects(rules, { from: '/projects/b', to: '/projects/c', allLocales: true }), {
    to: '/projects/d',
    rewrites: [{ id: 'old1', to: '/projects/d' }],
  });
  // back to a previous address: the rule from that address would point to itself and is removed
  assert.deepEqual(collapseRedirects([{ id: 'r', from: '/projects/a', to: '/projects/b', allLocales: true }], { from: '/projects/b', to: '/projects/a', allLocales: true }), {
    to: '/projects/a',
    rewrites: [{ id: 'r', to: null }],
  });
  // reversing a rule: the old one is removed instead of forming a loop
  assert.deepEqual(collapseRedirects([{ id: 'r', from: '/b', to: '/a', allLocales: false }], { from: '/a', to: '/b', allLocales: false }), { to: '/b', rewrites: [{ id: 'r', to: null }] });
  // what would have been a loop through another rule: that rule is reversed away as well
  assert.deepEqual(collapseRedirects([{ id: 'r1', from: '/b', to: '/c' }, { id: 'r2', from: '/c', to: '/a' }].map((r) => ({ ...r, allLocales: false })), { from: '/a', to: '/b', allLocales: false }), {
    to: '/c',
    rewrites: [{ id: 'r2', to: null }],
  });
});

test('checker: language prefixes are understood; duplicates and prefixed locale-less rules are BLOCKING', () => {
  const page = (key: string) => ({ id: `page-${key}`, key, kind: 'page', status: 'published', header: { title: { en: key, ru: key, zh: key, tr: key, ar: key, es: key }, description: null }, lists: {}, seo: null, translationStatus: {} });
  const base = { pages: [page('home'), page('company')], projects: [], technologies: [], products: [], epcmStages: [], patents: [], videos: [], media: [] };
  const run = (redirects: Array<{ id: string; from: string; to: string; allLocales?: boolean }>) =>
    checkSeo({ ...base, redirects } as never).issues.filter((i) => i.type === 'redirects').map((i) => `${i.code}:${i.key}`);
  assert.deepEqual(run([{ id: 'ok', from: '/ru/old', to: '/ru/company' }]), []);
  assert.deepEqual(run([{ id: 'ok', from: '/old', to: '/company', allLocales: true }]), []);
  assert.deepEqual(run([{ id: 's', from: '/ru/company', to: '/ru' }]), ['redirect_shadows_page:s']);
  assert.deepEqual(run([{ id: 't', from: '/ru/old', to: '/ru/nowhere' }]), ['redirect_target_missing:t']);
  assert.deepEqual(run([{ id: 'p', from: '/ru/old', to: '/ru/company', allLocales: true }]), ['redirect_invalid:p']);
  assert.deepEqual(run([
    { id: 'all', from: '/old', to: '/company', allLocales: true },
    { id: 'ru', from: '/ru/old', to: '/ru', allLocales: false },
  ]), ['redirect_duplicate:all', 'redirect_duplicate:ru']);
  // a chain across the two kinds of rules is still found
  assert.deepEqual(run([
    { id: 'c1', from: '/ru/older', to: '/ru/old' },
    { id: 'c2', from: '/old', to: '/company', allLocales: true },
  ]), ['redirect_chain:c1']);
});
