# SEO (as implemented)

Status: current as of Phase M-1 (commit 959f733)

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
| `og:image` | Absolute URL of `seo.ogImage` **only if set**. No record sets it today, so **no page emits `og:image`** | `seo.ts` `build()` |
| `og:type`, `twitter:card` | `website`, `summary_large_image`: static, from `apps/web/index.html`, identical on every page | `index.html` |

- **Origin:** `SITE_URL` = `VITE_SITE_URL` or `https://soltexglobal.co` (`i18n/config.ts`).
- **URLs:** English unprefixed, other languages under `/ru`, `/zh`, `/tr`, `/ar`, `/es`; slugs identical in every language (no localized slugs).
- **Page set:** published fixed pages with a route (`PAGE_ROUTES` in `@soltex/core/seo`: `/`, `/company`, `/company/global-presence`, `/technologies`, `/technologies/patents`, `/epcm`, `/products`, `/projects`, `/contact`, plus `/privacy` and `/terms` once published; both are drafts today) and published technologies, products and projects.
- **No manual canonical or hreflang fields.** Both are computed (approved architecture §15).

## 2. Structured data (JSON-LD)

**None is emitted.** No `application/ld+json` or schema.org markup exists in `apps/web`, `packages/core` or the build scripts. The archived Directus-era plan (Products as `TechArticle`, decision D-013 of the archived log) is not implemented. Open item.

## 3. Sitemap and robots

| Item | Implementation |
|---|---|
| `sitemap.xml` | Written by `prerender.ts` into the build root. One `<url>` per indexable page per language whose canonical is itself, each with `xhtml:link` hreflang alternates including `x-default`. No `lastmod`, `priority` or `changefreq` |
| Sitemap checks | `validate-site.ts`: every sitemap URL exists, is indexable and canonical; every indexable self-canonical page is in the sitemap |
| `robots.txt` (public site) | **Not generated, not in `apps/web/public`.** nginx has no rule for it, so `/robots.txt` goes to the redirect lookup and ends in a 404. The sitemap is therefore not announced. Open item |
| Preview server | `/robots.txt` = `Disallow: /`; every answer has `X-Robots-Tag: noindex, nofollow, noarchive` (`apps/api/src/preview/server.ts`) |
| Admin | `apps/admin/public/robots.txt` and `<meta name="robots" content="noindex, nofollow, noarchive">` in `apps/admin/index.html` |

## 4. Not-found pages

- Every language has its own prerendered 404 page (`dist/404.html`, `dist/<locale>/404.html`): `noindex, follow`, no canonical, no hreflang.
- nginx returns them with **HTTP 404** (`map $request_uri $soltex_not_found`); there is no SPA fallback (decision P1-12). The Netlify demo uses the same rules (`netlify.toml`).

## 5. Redirects

Two kinds, both stored in the `redirects` table (source of truth) and both served by the same lookup:

| Kind | Source | How it is created |
|---|---|---|
| Manual | `manual` | Admin «SEO → Редиректы» (`redirects.manage`) |
| Address change | `slug_change` | Admin «Изменить адрес» on a published project, technology or product: creates `old → new` (301, all languages) by default and rewrites older rules to the new address |
| Import | `import` | `src/content/seed/redirects.json`, imported with the seed. **The file is empty today**, so no old soltexglobal.co addresses are redirected yet |

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
| Output validation (`scripts/validate-site.ts`) | Unique routes and slugs; title, description, `lang`, `dir`, one `<h1>`; self-referencing canonical; reciprocal hreflang with `x-default` = English; hreflang targets exist; sitemap consistency; noindex only where the content sets it; every `<title>`, description and robots equals the `@soltex/core/seo` model; redirects without loops, chains or shadowing; links, assets and relations resolve; no secrets or development URLs in the output |
| Admin and API | «Проверка SEO» panel in each editor, the site-wide report `/seo`, and refusal of «Отметить к публикации» / «Создать релиз» on BLOCKING issues |

**Severities:**
- **BLOCKING:** slug, relation, media, link, empty title or description, title over 120 characters, redirect errors.
- **WARNING:** title over 60, description outside 70–160, duplicates, missing or outdated translations, `og_image_missing` on detail pages, chains, image size.
- **INFO:** default template used.

Full list: [`admin-seo.md`](admin-seo.md) §3.

## 8. Gaps (verified in code)

| Gap | Note |
|---|---|
| No JSON-LD | §2 |
| No `og:image` on any page | The field exists; no content sets it; the checker warns on detail pages |
| No public `robots.txt` | §3; the architecture review planned one with a sitemap link |
| No `lastmod` in the sitemap | Proposed in the architecture review (§0), not implemented |
| Old-site redirects not imported | `redirects.json` is empty; client decision 10 (approved §22) pending |
