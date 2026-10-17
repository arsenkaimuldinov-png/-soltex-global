# SEO (as implemented)

Status: current as of Phase N-0 (robots.txt, JSON-LD, og:image, old-site redirects)

The public site is a static, prerendered build. All SEO tags are written into each HTML file at build time (`apps/web/scripts/prerender.ts`) and kept in sync during client-side navigation by `apps/web/src/i18n/SeoHead.tsx`. Both use the same functions in `apps/web/src/i18n/seo.ts`. The admin, the API and the build check the same rules through `@soltex/core/seo` (details: [`admin-seo.md`](admin-seo.md)).

---

## 1. Per-page head tags

| Tag | Value | Code |
|---|---|---|
| `<html lang dir>` | `en`, `ru`, `zh-Hans`, `tr`, `ar` (`dir="rtl"`), `es` | `i18n/config.ts`, `prerender.ts` |
| `<title>` | SEO override (`seo.metaTitle`) of the served language, else `"{H1} \| Soltex Global"` (page header title, or entity title) | `i18n/seo.ts` `getRouteMeta()` |
| `meta description` | SEO override (`seo.metaDescription`), else the page header description / technology overview / product description / project overview, shortened to whole sentences (≈160 characters, `summarize()`) | same |
| `meta robots` | `index, follow`; `noindex, follow` when `seo.noindex` is set, and on every 404 page | same |
| `link rel=canonical` | Absolute URL of the page in the served language. If the translation is not approved, the page is served in English and the canonical points to the English URL | `prerender.ts`, `SeoHead.tsx` |
| `link rel=alternate hreflang` | One per language that has an approved version, plus `x-default` = English. None on noindex pages; none on 404 pages | `getAlternates()` |
| `og:title`, `og:description` | Same as title and description | `prerender.ts` |
| `og:url` | Canonical URL | same |
| `og:locale` | `en_US`, `ru_RU`, `zh_CN`, `tr_TR`, `ar_AR`, `es_ES` | `i18n/config.ts` |
| `og:image` | On **every** page, absolute URL of the first that exists: `seo.ogImage` → the page's own photo if it is JPEG/PNG (the entity image; for fixed pages the first media of the page; WebP/AVIF are skipped because link previews do not show them reliably) → `DEFAULT_OG_IMAGE` = `/og-default.png` (`apps/web/public/og-default.png`, 1200×630, the client logo on `#FBFBF8`). 404 pages get the default. `SeoHead` updates it on client-side navigation | `seo.ts` `build()`, `getNotFoundMeta()` |
| `og:type`, `twitter:card` | `website`, `summary_large_image`: static, from `apps/web/index.html`, identical on every page | `index.html` |

- **Origin:** `SITE_URL` = `VITE_SITE_URL` or `https://soltexglobal.co` (`i18n/config.ts`).
- **URLs:** English unprefixed, other languages under `/ru`, `/zh`, `/tr`, `/ar`, `/es`; slugs identical in every language (no localized slugs).
- **Page set:** published fixed pages with a route (`PAGE_ROUTES` in `@soltex/core/seo`: `/`, `/company`, `/company/global-presence`, `/technologies`, `/technologies/patents`, `/epcm`, `/products`, `/projects`, `/contact`, plus `/privacy` and `/terms` once published; both are drafts today) and published technologies, products and projects.
- **No manual canonical or hreflang fields.** Both are computed (approved architecture §15).

## 2. Structured data (JSON-LD)

Written by `prerender.ts` into the static HTML of indexable pages, from `apps/web/src/i18n/structured-data.ts` (`getStructuredData()`, `jsonLdScript()`). Only facts the content already states are emitted (decision N0-2):

| Page | Types | Fields |
|---|---|---|
| Home (each language) | `Organization` (`@id` = `<SITE_URL>/#organization`) + `WebSite` (`publisher` → the Organization, `inLanguage`) | From settings: `name` (site name), `legalName` (headquarters name, only if it differs), `url`, `logo`, `email` (primary e-mail), `description` (default SEO description) — each only when set |
| Technology, product, project detail | `BreadcrumbList` | Home → index page → item, with the visible breadcrumb labels (`nav.home`, `breadcrumb.technologies` / `products` / `projects`, item title) |
| Other pages, 404 | none | |

- `<` is escaped as `\u003c`, so content can never close the `<script>` element. `application/ld+json` is data, so `SITE_CSP` is unaffected.
- Not updated by `SeoHead` on client-side navigation (crawlers read the prerendered HTML).
- The archived Directus-era plan (Products as `TechArticle`, D-013 of the archived log) is not implemented.

## 3. Sitemap and robots

| Item | Implementation |
|---|---|
| `sitemap.xml` | Written by `prerender.ts` into the build root. One `<url>` per indexable page per language whose canonical is itself, each with `xhtml:link` hreflang alternates including `x-default`. No `lastmod`, `priority` or `changefreq` |
| Sitemap checks | `validate-site.ts`: every sitemap URL exists, is indexable and canonical; every indexable self-canonical page is in the sitemap |
| `robots.txt` (public site) | Written by `prerender.ts` into the build root: `User-agent: *`, `Allow: /`, `Sitemap: <SITE_URL>/sitemap.xml`. Served by nginx as a static file of the release |
| Preview server | `/robots.txt` = `Disallow: /`; every answer has `X-Robots-Tag: noindex, nofollow, noarchive` (`apps/api/src/preview/server.ts`) |
| Admin | `apps/admin/public/robots.txt`, `<meta name="robots" content="noindex, nofollow, noarchive">` in `apps/admin/index.html`; on the server `deploy/nginx/admin.soltexglobal.conf` answers `/robots.txt` with `Disallow: /` and sends `X-Robots-Tag: noindex, nofollow, noarchive` |

## 4. Not-found pages

- Every language has its own prerendered 404 page (`dist/404.html`, `dist/<locale>/404.html`): `noindex, follow`, no canonical, no hreflang.
- nginx returns them with **HTTP 404** (`map $request_uri $soltex_not_found`); there is no SPA fallback (decision P1-12). The Netlify demo uses the same rules (`netlify.toml`).

## 5. Redirects

Two kinds, both stored in the `redirects` table (source of truth) and both served by the same lookup:

| Kind | Source | How it is created |
|---|---|---|
| Manual | `manual` | Admin «SEO → Редиректы» (`redirects.manage`) |
| Address change | `slug_change` | Admin «Изменить адрес» on a published project, technology or product: creates `old → new` (301, all languages) by default and rewrites older rules to the new address |
| Import | `import` | `src/content/seed/redirects.json`, imported with the seed (`db:import`). Since Phase N-0 it holds the old-site addresses `/about` → `/company`, `/tech` → `/technologies`, `/services` → `/epcm` (301, English only). The file is maintained by hand; `migrate-legacy.ts` no longer overwrites it |

**Serving:**

1. nginx serves an existing static file (`$uri`, `$uri.html`, `$uri/index.html`) directly.
2. A trailing slash gets a 301 to the address without it when that page exists.
3. Anything else goes to `@lookup` → `GET /internal/v1/redirect` on the API (loopback only, 1 s / 2 s timeouts, 20 r/s per IP).
4. The API matches the path exactly against the rules of the **active release** and answers 301 or 302 with `Location = PUBLIC_SITE_URL + path`.
5. API 404, 429, 5xx, timeout or outage → **404** with the localized not-found page, never a 502.

**Rules:**
- Targets are internal paths only.
- Chains are collapsed on save; loops, duplicates, self-redirects, redirects shadowing a live page, and missing targets are refused (BLOCKING checks).
- A rule reaches the site with the next release.
- The query string is not carried over (deviation I-7).
- Host redirects: `http://` and `www.` → `https://soltexglobal.co` (301).

Code: `packages/core/src/seo/redirects.ts`, `apps/api/src/seo/`, `deploy/nginx/soltexglobal.conf`. Full rules: [`admin-seo.md`](admin-seo.md) §8–§11.

## 6. Security headers on the site host

Set in `deploy/nginx/soltexglobal.conf`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `SITE_CSP` from `packages/core/src/domain/site-security.ts` (below) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

TLS 1.2 / 1.3 only.

**`SITE_CSP`:**

```
default-src 'self';
script-src 'self' 'sha256-FxjS9LAg+aftdgj8JMq5VioItakbndiIAdl0ujkCkNc=';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
media-src 'self';
connect-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self'
```

- The hash allows the one inline script (the motion boot script in `apps/web/index.html`).
- `scripts/check-site-csp.mjs` (part of `npm run lint`) fails when the nginx header and `SITE_CSP` differ, or when an inline script of `index.html` is not covered by a hash.
- The preview server sends the same policy for release files, with `frame-ancestors 'none'`.
- `style-src 'unsafe-inline'` is an accepted risk (React `style` attributes); see [`decisions.md`](decisions.md).
- The Google Fonts stylesheet has no SRI (ASVS 14.2.3, partial).

## 7. Checks

| Where | What |
|---|---|
| Content build (`scripts/content/build-snapshots.ts`) | The SEO checker runs on the published content; any BLOCKING issue fails the build |
| Output validation (`scripts/validate-site.ts`) | Unique routes and slugs; title, description, `lang`, `dir`, one `<h1>`; self-referencing canonical; reciprocal hreflang with `x-default` = English; hreflang targets exist; sitemap consistency; noindex only where the content sets it; every `<title>`, description and robots equals the `@soltex/core/seo` model; redirects without loops, chains or shadowing; `robots.txt` exists, does not block the site and names the sitemap; every page has `og:image` and its file exists; every JSON-LD block parses and has `@context`/`@type`; links, assets and relations resolve; no secrets or development URLs in the output |
| Admin and API | «Проверка SEO» panel in each editor, the site-wide report `/seo`, and refusal of «Отметить к публикации» / «Создать релиз» on BLOCKING issues |

**Severities:**
- **BLOCKING:** slug, relation, media, link, empty title or description, title over 120 characters, redirect errors.
- **WARNING:** title over 60, description outside 70–160, duplicates, missing or outdated translations, chains, image size.
- **INFO:** default template used; `og_image_missing` on detail pages (since Phase N-0: the site falls back to the page photo or the default card).

Full list: [`admin-seo.md`](admin-seo.md) §3.

## 8. Gaps (verified in code)

| Gap | Note |
|---|---|
| No `lastmod` in the sitemap | Proposed in the architecture review (§0), not implemented |
| Old-site redirects: only three | `/about`, `/tech`, `/services` (English). A full list of old URLs is client decision 10 (approved §22) |
| No structured data beyond Organization, WebSite, BreadcrumbList | No `Product`, `Article` etc.; adding them needs content the site states (decision N0-2) |
