/**
 * SEO checker (Phase I-1, approved §14–§15): every code, its severity, the fallback rule, the
 * effective texts and the path syntax rules, on small synthetic stores.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkSeo,
  formatSeoIssue,
  pathProblem,
  SEO_ISSUE_CODES,
  SEO_ISSUE_SEVERITY,
  seoDefaults,
  summarize,
  type SeoIssue,
} from '../src/seo/index.ts';

const L = (en: string, other?: Partial<Record<'ru' | 'zh' | 'tr' | 'ar' | 'es', string>>) => ({
  en,
  ru: other?.ru ?? `${en} RU`,
  zh: other?.zh ?? `${en} ZH`,
  tr: other?.tr ?? `${en} TR`,
  ar: other?.ar ?? `${en} AR`,
  es: other?.es ?? `${en} ES`,
});
const approved = { ru: { status: 'approved' }, zh: { status: 'approved' }, tr: { status: 'approved' }, ar: { status: 'approved' }, es: { status: 'approved' } };
const DESC = 'A processing plant for high-value ingredients, engineered and delivered on a turnkey basis by Soltex.';
const seo = (o: Partial<{ metaTitle: ReturnType<typeof L> | null; metaDescription: ReturnType<typeof L> | null; ogImage: { mediaId: string } | null; noindex: boolean }> = {}) => ({
  metaTitle: null,
  metaDescription: null,
  ogImage: { mediaId: 'm1' },
  noindex: false,
  ...o,
});

// Synthetic fixtures carry extra fields the checker ignores (structural input).
function store(): any {
  return {
    pages: [
      { id: 'page-home', key: 'home', kind: 'page', status: 'published', translationStatus: approved, header: null, lists: { keyDirections: [{ href: '/technologies/pectin' }] }, seo: seo({ metaTitle: L('Soltex Global — Turnkey Engineering'), metaDescription: L(DESC) }) },
      { id: 'page-company', key: 'company', kind: 'page', status: 'published', translationStatus: approved, header: { title: L('About'), description: L(DESC) }, lists: {}, seo: null },
      { id: 'page-project-detail', key: 'projectDetail', kind: 'template', status: 'published', translationStatus: approved, header: null, lists: {}, seo: null },
    ],
    technologies: [{ id: 't1', slug: 'pectin', status: 'published', translationStatus: approved, title: L('Pectin'), overview: L(DESC), seo: seo(), relatedProjectIds: ['p1'], image: { mediaId: 'm1' } }],
    products: [{ id: 'pr1', slug: 'pectin', status: 'published', translationStatus: approved, title: L('Pectin product'), description: L(DESC), seo: seo(), relatedTechnologyId: 't1', relatedProjectId: 'p1' }],
    projects: [{ id: 'p1', slug: 'solbar', status: 'published', translationStatus: approved, title: L('Solbar'), overview: L(DESC), seo: seo(), relatedTechnologyId: 't1' }],
    epcmStages: [],
    patents: [],
    videos: [],
    media: [{ id: 'm1' }],
    redirects: [],
  };
}

const codes = (issues: SeoIssue[], severity?: string) => issues.filter((i) => !severity || i.severity === severity).map((i) => `${i.code}:${i.type}/${i.key}${i.locale ? `:${i.locale}` : ''}`);

test('severity table: every code has exactly one severity; blocking list of approved §14', () => {
  assert.equal(SEO_ISSUE_CODES.length, Object.keys(SEO_ISSUE_SEVERITY).length);
  assert.deepEqual(
    SEO_ISSUE_CODES.filter((c) => SEO_ISSUE_SEVERITY[c] === 'blocking').sort(),
    ['description_missing', 'link_broken', 'media_missing', 'redirect_invalid', 'redirect_loop', 'redirect_self', 'redirect_shadows_page', 'redirect_target_missing', 'relation_broken', 'slug_duplicate', 'slug_invalid', 'title_missing', 'title_too_long']
  );
});

test('a clean store: no blocking issues; effective texts follow the site templates', () => {
  const r = checkSeo(store());
  assert.equal(r.summary.blocking, 0, r.issues.map(formatSeoIssue).join('\n'));
  assert.equal(r.pages.length, 5 * 6, 'home, company, technology, product, project × 6 languages; templates are not pages');
  const company = r.pages.find((m) => m.key === 'page-company' && m.locale === 'ru')!;
  assert.equal(company.title, 'About RU | Soltex Global');
  assert.equal(company.titleSource, 'default');
  assert.equal(company.path, '/company');
  const home = r.pages.find((m) => m.key === 'page-home' && m.locale === 'en')!;
  assert.equal(home.titleSource, 'override');
  assert.equal(home.title, 'Soltex Global — Turnkey Engineering');
  assert.equal(r.pages.find((m) => m.type === 'projects')!.path, '/projects/solbar');
  assert.ok(codes(r.issues, 'info').includes('title_default:pages/page-company'));
});

test('slugs, relations, media and internal links are BLOCKING', () => {
  const s = store();
  s.products[0].slug = 'Bad Slug';
  s.projects.push({ ...s.projects[0], id: 'p2' }); // same slug "solbar"
  s.technologies[0].relatedProjectIds = ['p1', 'gone'];
  s.products[0].relatedProjectId = 'p-draft';
  s.projects.push({ ...s.projects[0], id: 'p-draft', slug: 'draft', status: 'draft' });
  s.projects[0].seo = seo({ ogImage: { mediaId: 'nope' } });
  s.pages[0].lists = { keyDirections: [{ href: '/technologies/unknown' }, { href: '/technologies/pectin#x' }] };
  const r = checkSeo(s);
  const b = codes(r.issues, 'blocking');
  assert.ok(b.includes('slug_invalid:products/pr1'));
  assert.ok(b.includes('slug_duplicate:projects/p2'));
  assert.ok(b.includes('relation_broken:technologies/t1'));
  assert.ok(b.includes('relation_broken:products/pr1'), 'a draft target is not published');
  const media = r.issues.find((i) => i.code === 'media_missing')!;
  assert.equal(media.field, 'ogImage');
  const link = r.issues.filter((i) => i.code === 'link_broken');
  assert.equal(link.length, 1, 'anchors on live pages are fine');
  assert.equal(link[0]!.params.href, '/technologies/unknown');
  assert.equal(link[0]!.field, 'lists.keyDirections.0.href');
});

test('titles and descriptions: empty / > 120 BLOCKING, outside the recommended range WARNING, per language', () => {
  const s = store();
  s.projects[0].seo = seo({ metaTitle: L('', { ru: 'x'.repeat(121), zh: 'y'.repeat(70) }), metaDescription: L('short') });
  const r = checkSeo(s);
  const p = r.issues.filter((i) => i.key === 'p1');
  const has = (code: string, locale: string) => p.some((i) => i.code === code && i.locale === locale);
  assert.ok(has('title_missing', 'en'));
  assert.ok(has('title_too_long', 'ru'));
  assert.ok(has('title_length', 'zh'));
  assert.ok(has('description_length', 'en'));
  assert.ok(!has('title_default', 'en'));
});

test('fallback languages: a non-approved translation is a WARNING, the page is served in English and skipped by text checks', () => {
  const s = store();
  s.projects[0].translationStatus = { ...approved, ar: { status: 'in_progress' }, es: { status: 'missing' } };
  s.projects[0].seo = seo({ metaTitle: L('Solbar plant', { ar: '' }) });
  const r = checkSeo(s);
  const ar = r.pages.find((m) => m.key === 'p1' && m.locale === 'ar')!;
  assert.equal(ar.servedLocale, 'en');
  assert.equal(ar.title, 'Solbar plant');
  const p = codes(r.issues).filter((c) => c.includes('projects/p1'));
  assert.ok(p.includes('translation_missing:projects/p1:ar'));
  assert.ok(p.includes('translation_missing:projects/p1:es'));
  assert.ok(!p.some((c) => c.startsWith('title_missing')), 'the empty AR override is never served');
  // The API knows "outdated" (approved for an older English text): a WARNING, still served in that language.
  const r2 = checkSeo(store(), { translationState: (_t, key, locale) => (key === 'p1' && locale === 'tr' ? 'outdated' : 'approved') });
  assert.ok(codes(r2.issues).includes('translation_outdated:projects/p1:tr'));
  assert.equal(r2.pages.find((m) => m.key === 'p1' && m.locale === 'tr')!.servedLocale, 'tr');
});

test('duplicates among indexable pages of one language are WARNINGs; noindex pages are skipped', () => {
  const s = store();
  s.products[0].seo = seo({ metaTitle: L('Same title'), metaDescription: L(DESC) });
  s.projects[0].seo = seo({ metaTitle: L('Same title'), metaDescription: L(DESC) });
  const r = checkSeo(s);
  const dup = r.issues.filter((i) => i.code === 'title_duplicate' && i.locale === 'en');
  assert.deepEqual(dup.map((i) => i.key).sort(), ['p1', 'pr1']);
  assert.equal(dup[0]!.params.count, 2);
  s.projects[0].seo.noindex = true;
  s.pages[1].seo = seo({ noindex: true });
  const r2 = checkSeo(s);
  assert.ok(!r2.issues.some((i) => i.code === 'title_duplicate'));
  assert.ok(codes(r2.issues).includes('noindex_in_navigation:pages/page-company'));
  assert.equal(r2.pages.find((m) => m.key === 'p1')!.indexable, false);
});

test('redirects: invalid, self, loop and shadowing are BLOCKING; a chain is a WARNING', () => {
  const s = store();
  s.redirects = [
    { id: 'r1', from: '/old', to: '/older' },
    { id: 'r2', from: '/older', to: '/company' },
    { id: 'r3', from: '/a', to: '/b' },
    { id: 'r4', from: '/b', to: '/a' },
    { id: 'r5', from: '/x', to: 'https://evil.example' },
    { id: 'r6', from: '/same', to: '/same' },
    { id: 'r7', from: '/company', to: '/projects/solbar' },
    { id: 'r8', from: '/gone', to: '/nowhere' },
  ];
  const r = checkSeo(s);
  const c = codes(r.issues).filter((x) => x.includes('redirects/'));
  assert.ok(c.includes('redirect_chain:redirects/r1'));
  assert.ok(!c.some((x) => x.startsWith('redirect_target_missing:redirects/r1')));
  assert.ok(c.includes('redirect_loop:redirects/r3'));
  assert.ok(c.includes('redirect_invalid:redirects/r5'));
  assert.ok(c.includes('redirect_self:redirects/r6'));
  assert.ok(c.includes('redirect_shadows_page:redirects/r7'));
  assert.ok(c.includes('redirect_target_missing:redirects/r8'));
});

test('path rules (approved §11.2): internal paths only', () => {
  assert.equal(pathProblem('/company'), null);
  assert.equal(pathProblem('/ru/projects/x?utm=1'), null);
  assert.equal(pathProblem(''), 'empty');
  assert.equal(pathProblem('company'), 'not_absolute');
  assert.equal(pathProblem('//evil.example'), 'protocol_relative');
  assert.equal(pathProblem('https://evil.example'), 'scheme');
  assert.equal(pathProblem('javascript:alert(1)'), 'scheme');
  assert.equal(pathProblem('/a\\b'), 'backslash');
  assert.equal(pathProblem('/a\nb'), 'control');
  assert.equal(pathProblem('/a%0d%0aSet-Cookie'), 'encoded');
  assert.equal(pathProblem('/a%2F..'), 'encoded');
  assert.equal(pathProblem('/a/../b'), 'dot_segment');
  assert.equal(pathProblem('/' + 'a'.repeat(2048)), 'too_long');
});

test('default texts: "{H1} | Soltex Global"; descriptions shortened to whole sentences', () => {
  assert.deepEqual(seoDefaults('Pectin', 'One. Two.'), { title: 'Pectin | Soltex Global', description: 'One. Two.' });
  assert.equal(seoDefaults(null, null).title, 'Soltex Global | Soltex Global');
  const long = `${'A'.repeat(100)}. ${'B'.repeat(100)}.`;
  assert.equal(summarize(long), `${'A'.repeat(100)}.`);
  assert.equal(summarize('Один. Два。三'), 'Один. Два。三');
});
