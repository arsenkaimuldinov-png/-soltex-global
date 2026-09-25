/**
 * Post-build SEO step (runs after `vite build`, see package.json "build").
 *
 * For every route × language it writes a static HTML shell into dist/ with the correct
 *   <html lang dir>, <title>, meta description, canonical, hreflang alternates and OpenGraph tags,
 * so search engines and link previews get language-specific metadata without executing JavaScript.
 * The page body is still rendered by the React app (the shell contains the same bundle).
 *
 * Files are written as flat "<path>.html" (e.g. dist/ru/company.html) — Netlify serves them for
 * "/ru/company" — and the `/*  /index.html  200` rewrite in netlify.toml remains the fallback
 * for any other URL. A sitemap.xml with hreflang alternates is generated as well.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, LOCALES, Locale, getLocaleInfo } from '../src/i18n/config';
import { absoluteUrl, getAllRoutePaths, getAlternates, getRouteMeta } from '../src/i18n/seo';
import { localizePath } from '../src/i18n/paths';

const DIST = path.resolve(import.meta.dirname, '../dist');
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const dictionaries: Record<string, Record<string, string>> = { en: {} };
for (const l of LOCALES) {
  if (l.code === DEFAULT_LOCALE) continue;
  dictionaries[l.code] = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, `../src/i18n/locales/${l.code}.json`), 'utf8')
  );
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderShell(routePath: string, locale: Locale): string {
  const info = getLocaleInfo(locale);
  const dict = dictionaries[locale];
  const t = (s: string) => (locale === DEFAULT_LOCALE ? s : dict[s] ?? s);
  const meta = getRouteMeta(routePath, t);
  const canonical = absoluteUrl(routePath, locale);

  const head = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.indexable ? 'index, follow' : 'noindex, follow'}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    ...getAlternates(routePath).map(
      (a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`
    ),
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:locale" content="${info.ogLocale}" />`,
    ...(info.fallbackFonts
      ? [
          `<link id="i18n-fonts-${info.code}" rel="stylesheet" href="https://fonts.googleapis.com/css2?${esc(
            info.fallbackFonts
          )}&amp;display=swap" />`,
        ]
      : []),
  ].join('\n    ');

  return template
    .replace(/<html[^>]*>/, `<html lang="${info.htmlLang}" dir="${info.dir}" class="scroll-smooth">`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta property="og:title"[^>]*>/, '')
    .replace(/<meta property="og:description"[^>]*>/, '')
    .replace('</head>', `  ${head}\n  </head>`)
    .replace(/\n[ \t]*(?=\n)/g, ''); // drop blank lines left by removed tags
}

function outFile(publicPath: string): string {
  if (publicPath === '/') return path.join(DIST, 'index.html');
  return path.join(DIST, `${publicPath.replace(/^\//, '')}.html`);
}

const routes = getAllRoutePaths();
let written = 0;
for (const l of LOCALES) {
  for (const r of routes) {
    const file = outFile(localizePath(r, l.code));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderShell(r, l.code));
    written++;
  }
}

// sitemap.xml with hreflang alternates
const urls = routes
  .flatMap((r) =>
    LOCALES.map(
      (l) => `  <url>
    <loc>${esc(absoluteUrl(r, l.code))}</loc>
${getAlternates(r)
  .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`)
  .join('\n')}
  </url>`
    )
  )
  .join('\n');
fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
);

console.log(`prerender: ${written} localized HTML shells + sitemap.xml (${routes.length} routes × ${LOCALES.length} languages)`);
