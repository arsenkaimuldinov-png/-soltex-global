/**
 * Static prerendering (runs after `vite build`, see package.json "build").
 *
 * For every public route × language it renders the React app to HTML at build time and writes a
 * complete static page into dist/: <html lang dir>, <title>, meta description, robots,
 * canonical, hreflang, OpenGraph AND the full page body. The browser bundle then hydrates the
 * page. Search engines, link previews and visitors without JavaScript get the real content.
 *
 * Output layout (portable — any static web server):
 *   dist/index.html            /            (English home)
 *   dist/company.html          /company
 *   dist/ru.html               /ru
 *   dist/ru/company.html       /ru/company
 *   dist/404.html              unknown URLs (served with HTTP 404 — see docs/deployment.md)
 *   dist/<locale>/404.html     unknown URLs under /<locale>/
 *   dist/sitemap.xml           every public URL with hreflang alternates
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, LOCALES, Locale, getLocaleInfo } from '../src/i18n/config';
import { localizePath } from '../src/i18n/paths';
import { absoluteUrl, getAlternates, getNotFoundMeta, getRouteMeta, RouteMeta } from '../src/i18n/seo';
import { getPublicPaths } from '../src/content/routes';
import type { ContentSnapshot } from '../src/content/types';
import { getBundle, primeBundle, renderRoute } from '../src/entry-server';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// Register every language synchronously for rendering.
for (const l of LOCALES) {
  primeBundle(l.code, {
    ui: JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/ui/${l.code}.json`), 'utf8')),
    content: JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/snapshot/${l.code}.json`), 'utf8')) as ContentSnapshot,
  });
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderPage(routePath: string, locale: Locale, meta: RouteMeta, url: string, withLinks: boolean, notFound = false): string {
  const info = getLocaleInfo(locale);
  const canonical = absoluteUrl(routePath, meta.canonicalLocale === locale ? locale : meta.canonicalLocale);
  const head = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.indexable ? 'index, follow' : 'noindex, follow'}" />`,
    ...(withLinks
      ? [
          `<link rel="canonical" href="${esc(canonical)}" />`,
          ...getAlternates(routePath, meta.alternateLocales).map(
            (a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`
          ),
        ]
      : []),
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    ...(withLinks ? [`<meta property="og:url" content="${esc(canonical)}" />`] : []),
    `<meta property="og:locale" content="${info.ogLocale}" />`,
    ...(meta.ogImage ? [`<meta property="og:image" content="${esc(meta.ogImage)}" />`] : []),
    ...(info.fallbackFonts
      ? [
          `<link id="i18n-fonts-${info.code}" rel="stylesheet" href="https://fonts.googleapis.com/css2?${esc(
            info.fallbackFonts
          )}&amp;display=swap" />`,
        ]
      : []),
  ].join('\n    ');

  const body = renderRoute(url);

  return template
    .replace(/<html[^>]*>/, `<html lang="${info.htmlLang}" dir="${info.dir}" class="scroll-smooth">`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta property="og:title"[^>]*>/, '')
    .replace(/<meta property="og:description"[^>]*>/, '')
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"${notFound ? ' data-render="not-found"' : ''}>${body}</div>`)
    .replace(/\n[ \t]*(?=\n)/g, ''); // drop blank lines left by removed tags
}

function outFile(publicPath: string): string {
  if (publicPath === '/') return path.join(DIST, 'index.html');
  return path.join(DIST, `${publicPath.replace(/^\//, '')}.html`);
}

const write = (file: string, html: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};

const english = getBundle(DEFAULT_LOCALE)!.content;
const routes = getPublicPaths(english);
const sitemapEntries: string[] = [];
let written = 0;

for (const l of LOCALES) {
  const content = getBundle(l.code)!.content;
  for (const r of routes) {
    const meta = getRouteMeta(r, content);
    if (!meta) throw new Error(`prerender: no content for ${r} (${l.code})`);
    const url = localizePath(r, l.code);
    write(outFile(url), renderPage(r, l.code, meta, url, true));
    written++;
  }

  // "Page not found" document per language (rendered for a path that matches no route).
  const notFoundUrl = localizePath('/__not-found__', l.code);
  const nfMeta = getNotFoundMeta(getBundle(l.code)!.ui['notFound.title'], content);
  const nfFile = l.code === DEFAULT_LOCALE ? path.join(DIST, '404.html') : path.join(DIST, l.code, '404.html');
  write(nfFile, renderPage('/__not-found__', l.code, nfMeta, notFoundUrl, false, true));
}

// sitemap.xml with hreflang alternates (indexable pages only)
for (const r of routes) {
  for (const l of LOCALES) {
    const meta = getRouteMeta(r, getBundle(l.code)!.content)!;
    if (!meta.indexable || meta.canonicalLocale !== l.code) continue;
    sitemapEntries.push(`  <url>
    <loc>${esc(absoluteUrl(r, l.code))}</loc>
${getAlternates(r, meta.alternateLocales)
  .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`)
  .join('\n')}
  </url>`);
  }
}
fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.join('\n')}
</urlset>
`
);

console.log(`prerender: ${written} pages (${routes.length} routes × ${LOCALES.length} languages) + ${LOCALES.length} not-found pages + sitemap.xml`);
