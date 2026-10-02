/**
 * Post-build validation of dist/ (runs as the last step of `npm run build`; fails the build).
 *
 * SEO       unique routes/slugs · title, description, lang, dir, one <h1> · self-referencing
 *           canonical · reciprocal hreflang with x-default = English · hreflang targets exist ·
 *           sitemap URLs exist, are indexable and canonical · no unexpected noindex ·
 *           redirects: no loops, no chains, never shadow a live route
 * INTEGRITY every internal link resolves · every referenced image/video/file exists ·
 *           every content relation resolves · 404 pages exist for every language
 * PORTABILITY / SECURITY  production output contains no CMS/backend secrets, no localhost or
 *           development URLs, no Netlify-specific runtime endpoints and no Sanity references.
 *
 * Usage: tsx scripts/validate-site.ts [distDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, LOCALES, SITE_URL } from '../src/i18n/config';
import { localizePath } from '../src/i18n/paths';
import type { ContentSnapshot } from '../src/content/types';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist'));

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

// ---------------------------------------------------------------------------
// Load output
// ---------------------------------------------------------------------------
function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}
const files = listFiles(DIST);
const rel = (f: string) => '/' + path.relative(DIST, f).split(path.sep).join('/');
const fileSet = new Set(files.map(rel));

/** Public URL path → output file (mirrors the server rule $uri → $uri.html → $uri/index.html). */
function resolveUrlPath(p: string): string | null {
  const clean = decodeURI(p.split(/[?#]/)[0]).replace(/\/+$/, '') || '/';
  for (const c of [clean, `${clean}.html`, `${clean}/index.html`]) if (fileSet.has(c)) return c;
  if (clean === '/' && fileSet.has('/index.html')) return '/index.html';
  return null;
}

const isNotFoundPage = (f: string) => /(^|\/)404\.html$/.test(f);
const htmlPages = files.filter((f) => f.endsWith('.html')).map(rel);
const pages = htmlPages.filter((f) => !isNotFoundPage(f));

const read = (f: string) => fs.readFileSync(path.join(DIST, f), 'utf8');
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
const unesc = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");

interface PageInfo {
  file: string;
  url: string;
  title: string | null;
  description: string | null;
  robots: string | null;
  canonical: string[];
  hreflang: { lang: string; href: string }[];
  lang: string | null;
  dir: string | null;
  h1: number;
  bodyText: number;
}

function urlOf(file: string): string {
  if (file === '/index.html') return `${SITE_URL}/`;
  return SITE_URL + file.replace(/\.html$/, '').replace(/\/index$/, '');
}

function parse(file: string): PageInfo {
  const html = read(file);
  const head = html.slice(0, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<div id="root">'));
  const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? '';
  const tags = (re: RegExp) => [...head.matchAll(re)].map((m) => m[0]);
  return {
    file,
    url: urlOf(file),
    title: head.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    description: tags(/<meta name="description"[^>]*>/g).map((t) => attr(t, 'content'))[0] ?? null,
    robots: tags(/<meta name="robots"[^>]*>/g).map((t) => attr(t, 'content'))[0] ?? null,
    canonical: tags(/<link rel="canonical"[^>]*>/g).map((t) => unesc(attr(t, 'href') ?? '')),
    hreflang: tags(/<link rel="alternate" hreflang[^>]*>/g).map((t) => ({ lang: attr(t, 'hreflang')!, href: unesc(attr(t, 'href')!) })),
    lang: attr(htmlTag, 'lang'),
    dir: attr(htmlTag, 'dir'),
    h1: (body.match(/<h1[\s>]/g) ?? []).length,
    bodyText: body.replace(/<[^>]+>/g, '').trim().length,
  };
}

const infos = new Map(pages.map((f) => [f, parse(f)]));
const byUrl = new Map([...infos.values()].map((i) => [i.url, i]));

// ---------------------------------------------------------------------------
// Content (snapshots) — slugs, relations, redirects, media
// ---------------------------------------------------------------------------
const snapshots = Object.fromEntries(
  LOCALES.map((l) => [l.code, JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/snapshot/${l.code}.json`), 'utf8')) as ContentSnapshot])
);
const en = snapshots[DEFAULT_LOCALE];

for (const coll of ['projects', 'technologies', 'products'] as const) {
  const slugs = en[coll].map((x) => x.slug);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dup.length) err(`duplicate ${coll} slugs: ${dup.join(', ')}`);
}
const ids = new Set([...en.projects, ...en.technologies, ...en.products].map((x) => x.id));
for (const p of en.projects) if (!ids.has(p.relatedTechnologyId)) err(`relation: ${p.id} → ${p.relatedTechnologyId} missing`);
for (const t of en.technologies) for (const r of t.relatedProjectIds) if (!ids.has(r)) err(`relation: ${t.id} → ${r} missing`);
for (const p of en.products) {
  if (!ids.has(p.relatedTechnologyId)) err(`relation: ${p.id} → ${p.relatedTechnologyId} missing`);
  if (!ids.has(p.relatedProjectId)) err(`relation: ${p.id} → ${p.relatedProjectId} missing`);
}

// every media URL used anywhere in the content must exist in the output (or be absolute)
const mediaUrls = new Set<string>();
JSON.stringify(snapshots, (key, value) => {
  if (key === 'src' && typeof value === 'string') mediaUrls.add(value);
  return value;
});
for (const src of mediaUrls) if (src.startsWith('/') && !fileSet.has(decodeURI(src))) err(`content media missing in dist: ${src}`);

// redirects: loops, chains, shadowing
const redirects = en.redirects.flatMap((r) =>
  (r.allLocales ? LOCALES.map((l) => l.code) : [DEFAULT_LOCALE]).map((l) => ({ from: localizePath(r.from, l), to: localizePath(r.to, l) }))
);
const redirectMap = new Map(redirects.map((r) => [r.from, r.to]));
if (redirectMap.size !== redirects.length) err('duplicate redirect sources');
for (const r of redirects) {
  if (resolveUrlPath(r.from)) err(`redirect ${r.from} shadows a live page`);
  if (redirectMap.has(r.to)) err(`redirect chain: ${r.from} → ${r.to} → ${redirectMap.get(r.to)}`);
  const seen = new Set<string>();
  let cur: string | undefined = r.from;
  while (cur && redirectMap.has(cur)) {
    if (seen.has(cur)) {
      err(`redirect loop starting at ${r.from}`);
      break;
    }
    seen.add(cur);
    cur = redirectMap.get(cur);
  }
  if (!redirectMap.has(r.to) && !resolveUrlPath(r.to)) err(`redirect target does not exist: ${r.from} → ${r.to}`);
}

// ---------------------------------------------------------------------------
// Per-page SEO checks
// ---------------------------------------------------------------------------
const urls = [...infos.values()].map((i) => i.url);
if (new Set(urls).size !== urls.length) err('duplicate route URLs in output');

const expectedPages = LOCALES.length; // sanity: at least the home page per language
if (pages.length < expectedPages) err(`only ${pages.length} pages generated`);

for (const i of infos.values()) {
  const where = i.file;
  if (!i.title?.trim()) err(`${where}: missing <title>`);
  if (!i.description?.trim()) err(`${where}: missing meta description`);
  if (!i.lang) err(`${where}: missing <html lang>`);
  if (!i.dir) err(`${where}: missing <html dir>`);
  if (i.h1 !== 1) err(`${where}: ${i.h1} <h1> elements (expected 1)`);
  if (i.bodyText < 200) err(`${where}: page body is not prerendered (${i.bodyText} chars of text)`);
  if (i.canonical.length !== 1) err(`${where}: ${i.canonical.length} canonical links`);
  const indexable = !(i.robots ?? '').includes('noindex');
  if (!indexable) err(`${where}: unexpected noindex on a public page`);
  const canonical = i.canonical[0];
  if (canonical && canonical !== i.url) {
    // allowed only when the page falls back to English content (canonical → English URL)
    const target = byUrl.get(canonical);
    if (!target) err(`${where}: canonical ${canonical} is not a generated page`);
    else warnings.push(`${where}: canonical points to ${canonical} (untranslated content)`);
  }
  if (indexable && canonical === i.url) {
    if (!i.hreflang.length) err(`${where}: no hreflang alternates`);
    const xd = i.hreflang.filter((h) => h.lang === 'x-default');
    const enInfo = LOCALES.find((l) => l.code === DEFAULT_LOCALE)!;
    const enAlt = i.hreflang.find((h) => h.lang === enInfo.htmlLang);
    if (xd.length !== 1) err(`${where}: expected exactly one x-default`);
    else if (!enAlt || xd[0].href !== enAlt.href) err(`${where}: x-default must equal the English URL`);
    if (!i.hreflang.some((h) => h.href === i.url)) err(`${where}: hreflang cluster does not include the page itself`);
    for (const h of i.hreflang) {
      const target = byUrl.get(h.href);
      if (!target) {
        err(`${where}: hreflang ${h.lang} → ${h.href} does not exist`);
        continue;
      }
      if (h.lang !== 'x-default' && !target.hreflang.some((b) => b.href === i.url))
        err(`${where}: hreflang to ${h.href} is not reciprocal`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------
if (!fileSet.has('/sitemap.xml')) err('sitemap.xml missing');
else {
  const xml = read('/sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => unesc(m[1]));
  if (new Set(locs).size !== locs.length) err('sitemap: duplicate <loc>');
  for (const loc of locs) {
    const info = byUrl.get(loc);
    if (!info) err(`sitemap: ${loc} is not a generated page`);
    else {
      if ((info.robots ?? '').includes('noindex')) err(`sitemap: ${loc} is noindex`);
      if (info.canonical[0] !== loc) err(`sitemap: ${loc} is not canonical`);
    }
  }
  for (const i of infos.values()) if (i.canonical[0] === i.url && !locs.includes(i.url)) err(`sitemap: missing ${i.url}`);
}

// ---------------------------------------------------------------------------
// 404 pages
// ---------------------------------------------------------------------------
for (const l of LOCALES) {
  const f = l.code === DEFAULT_LOCALE ? '/404.html' : `/${l.code}/404.html`;
  if (!fileSet.has(f)) err(`missing not-found page ${f}`);
  else if (!/<meta name="robots" content="noindex/.test(read(f))) err(`${f}: must be noindex`);
}

// ---------------------------------------------------------------------------
// Links and assets referenced by the HTML
// ---------------------------------------------------------------------------
const checked = new Set<string>();
for (const f of htmlPages) {
  const html = read(f);
  const body = html.slice(html.indexOf('<body'));
  for (const m of html.matchAll(/\b(?:src|href|poster)="([^"]+)"/g)) {
    const raw = unesc(m[1]);
    if (!raw.startsWith('/') || raw.startsWith('//')) continue;
    const key = raw.split(/[?#]/)[0];
    if (checked.has(key)) continue;
    checked.add(key);
    const isAnchorTarget = body.includes(`href="${m[1]}"`) && !/\.[a-z0-9]{2,5}$/i.test(key);
    if (isAnchorTarget) {
      if (!resolveUrlPath(key)) err(`${f}: broken internal link ${raw}`);
    } else if (!fileSet.has(decodeURI(key)) && !resolveUrlPath(key)) {
      err(`${f}: missing file ${raw}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Hosting independence & secrets
// ---------------------------------------------------------------------------
const FORBIDDEN: [RegExp, string][] = [
  [/\/\.netlify\/(functions|blobs|edge)/i, 'Netlify runtime endpoint'],
  [/netlify\/functions|@netlify\/blobs|getStore\(/i, 'Netlify Functions/Blobs'],
  [/\.netlify\.app/i, 'Netlify preview URL'],
  [/sanity\.io|@sanity\/|cdn\.sanity|apicdn/i, 'Sanity reference'],
  // (third-party code may contain the bare base URL "http://localhost" — e.g. React Router's URL
  // parsing — which is harmless; a host with a port or path, or a loopback IP, is not)
  [/\blocalhost(?::\d+|\/[\w.-])|\b127\.0\.0\.1\b|\b0\.0\.0\.0:\d+/i, 'localhost / development URL'],
  [/\b(?:SANITY|DIRECTUS|CMS|ADMIN|DATABASE|DB|POSTGRES|MYSQL|SMTP|MAIL|LEAD|API)_[A-Z_]*(?:TOKEN|SECRET|KEY|PASSWORD|URL)\b/, 'secret-looking environment variable name'],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, 'private key'],
  [/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/, 'API key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT token'],
  [/postgres(?:ql)?:\/\/|mysql:\/\//i, 'database connection string'],
];
for (const f of files) {
  if (!/\.(html|js|css|json|xml|txt|webmanifest|map)$/.test(f)) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const [re, label] of FORBIDDEN) {
    const m = text.match(re);
    if (m) err(`${rel(f)}: ${label} found ("${m[0].slice(0, 60)}")`);
  }
}

// ---------------------------------------------------------------------------
if (warnings.length) console.warn(`validate-site: ${warnings.length} warning(s)\n  - ${warnings.slice(0, 50).join('\n  - ')}`);
if (errors.length) {
  console.error(`validate-site: ${errors.length} error(s)\n  - ${errors.slice(0, 200).join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `validate-site: OK — ${pages.length} pages, ${LOCALES.length} not-found pages, ${checked.size} internal links/assets, sitemap, hreflang, redirects, portability`
);
