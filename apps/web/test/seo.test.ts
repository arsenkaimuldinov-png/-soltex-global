/**
 * Launch SEO (Phase N-0): social-card fallback and JSON-LD built only from content facts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createContentApi } from '../src/content/getters.ts';
import type { ContentSnapshot } from '../src/content/types.ts';
import { DEFAULT_OG_IMAGE, getNotFoundMeta, getRouteMeta } from '../src/i18n/seo.ts';
import { getStructuredData, jsonLdScript } from '../src/i18n/structured-data.ts';
import { SITE_URL } from '../src/i18n/config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const load = (l: string) => ({
  content: createContentApi(JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/snapshot/${l}.json`), 'utf8')) as ContentSnapshot),
  ui: JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/ui/${l}.json`), 'utf8')) as Record<string, string>,
});
const en = load('en');
const ru = load('ru');

test('og:image: every page has one — SEO image, else a JPEG/PNG photo of the page, else the default card', () => {
  const project = en.content.projects[0]!;
  const meta = getRouteMeta(`/projects/${project.slug}`, en.content)!;
  assert.equal(meta.ogImage, /^https?:/.test(project.image.src) ? project.image.src : `${SITE_URL}${project.image.src}`);
  assert.equal(getRouteMeta('/epcm', en.content)!.ogImage, `${SITE_URL}${DEFAULT_OG_IMAGE}`, 'no photo of its own');
  assert.equal(getRouteMeta('/', en.content)!.ogImage, `${SITE_URL}${DEFAULT_OG_IMAGE}`, 'a WebP hero is not used for link previews');
  assert.equal(getNotFoundMeta('Not found', en.content).ogImage, `${SITE_URL}${DEFAULT_OG_IMAGE}`);
  assert.ok(fs.existsSync(path.join(ROOT, 'public', DEFAULT_OG_IMAGE)), 'the default card ships with the site');
});

test('JSON-LD: Organization and WebSite on the home page, from settings only', () => {
  const [org, site] = getStructuredData('/', en.content, 'en', en.ui);
  const s = en.content.settings;
  assert.equal(org!['@type'], 'Organization');
  assert.equal(org!.name, s.siteName);
  assert.equal(org!.email, s.primaryEmail);
  assert.equal(org!.description, s.defaultSeo.siteDescription);
  assert.deepEqual(Object.keys(org!).sort(), ['@context', '@id', '@type', 'description', 'email', 'legalName', 'logo', 'name', 'url'], 'no invented properties (address, founding date, …)');
  assert.equal(site!['@type'], 'WebSite');
  assert.equal(getStructuredData('/', ru.content, 'ru', ru.ui)[0]!.url, `${SITE_URL}/ru`);
});

test('JSON-LD: detail pages carry the visible breadcrumb; index and unknown pages carry nothing', () => {
  const p = ru.content.projects[0]!;
  const [bc] = getStructuredData(`/projects/${p.slug}`, ru.content, 'ru', ru.ui);
  const items = (bc as { itemListElement: Array<{ name: string; item: string; position: number }> }).itemListElement;
  assert.deepEqual(
    items.map((i) => [i.position, i.name, i.item]),
    [
      [1, ru.ui['nav.home'], `${SITE_URL}/ru`],
      [2, ru.ui['breadcrumb.projects'], `${SITE_URL}/ru/projects`],
      [3, p.title, `${SITE_URL}/ru/projects/${p.slug}`],
    ]
  );
  assert.deepEqual(getStructuredData('/epcm', en.content, 'en', en.ui), []);
  assert.deepEqual(getStructuredData('/nope', en.content, 'en', en.ui), []);
});

test('JSON-LD script: "<" is escaped, so content can never close the tag', () => {
  const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  assert.equal(html.match(/<\/script>/g)?.length, 1);
  assert.deepEqual(JSON.parse(html.replace(/^<script[^>]*>|<\/script>$/g, '')), { name: '</script><script>alert(1)</script>' });
});

test('legal pages: published in every language with the same structure; "## " paragraphs are headings', async () => {
  const { legalHeading } = await import('../src/pages/LegalPage.tsx');
  assert.equal(legalHeading('## 1. Who we are'), '1. Who we are');
  assert.equal(legalHeading('Plain paragraph'), null);
  for (const key of ['privacy', 'terms'] as const) {
    assert.ok(en.content.hasPage(key) && ru.content.hasPage(key), key);
    const a = en.content.page(key).page.body!;
    const b = ru.content.page(key).page.body!;
    assert.equal(a.length, b.length);
    a.forEach((p, i) => assert.equal(legalHeading(p) === null, legalHeading(b[i]!) === null, `${key} #${i}: heading in both`));
    assert.ok(getRouteMeta(`/${key}`, ru.content)!.description.length > 40, 'a real meta description');
  }
  assert.match(ru.ui['consent.label']!, /\{link\}/);
});
