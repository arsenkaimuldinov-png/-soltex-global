# Routes

Status: current as of Phase M-1 (commit 959f733)

There are three route sets: the public site, the admin SPA and the API. All of them are verified against the code: `apps/web/src/content/routes.ts`, `apps/web/src/App.tsx`, `apps/web/scripts/prerender.ts`, `apps/admin/src/App.tsx`, `apps/api/openapi.json` (API 0.13.0) and `deploy/nginx/soltexglobal.conf`.

---

## 1. Hosts and origins

| Host | Serves | Config |
|---|---|---|
| `https://soltexglobal.co` | Static release (`/srv/soltex/current`), `/media/originals/`, `/media/variants/`, `POST /api/v1/public/leads` (proxied) | `deploy/nginx/soltexglobal.conf`; `PUBLIC_SITE_URL`, `VITE_SITE_URL` |
| `www.soltexglobal.co`, `http://` | 301 → `https://soltexglobal.co$request_uri` | same file (`host-redirects` block) |
| `ADMIN_ORIGIN` (prod example `https://admin.soltexglobal.co`, dev `http://localhost:3001`) | Admin SPA + `/api/v1/*` on the same origin (no CORS) | nginx block **not in the repo yet** (Phase N) |
| `PREVIEW_ORIGIN` (prod example `https://preview.soltexglobal.co`, dev default `http://localhost:4176`) | Preview server (`apps/api/src/preview/server.ts`) | nginx block **not in the repo yet** (Phase N) |
| `127.0.0.1:3100` | API process (`API_HOST`/`API_PORT`) | loopback only |
| `127.0.0.1:3102` | Preview server process (`PREVIEW_PORT`) | loopback only |

---

## 2. Public site (`apps/web`)

### 2.1 Locale prefixes

| Locale | Prefix | `<html lang>` / `dir` |
|---|---|---|
| `en` (source, default) | none: `/company` | `en` / ltr |
| `ru` | `/ru/company` | `ru` / ltr |
| `zh` | `/zh/…` | `zh-Hans` / ltr |
| `tr` | `/tr/…` | `tr` / ltr |
| `ar` | `/ar/…` | `ar` / **rtl** |
| `es` | `/es/…` | `es` / ltr |

- Locale home pages are `/ru`, `/zh`, … with no trailing slash.
- Slugs are the same in every language; localized slugs are not implemented.
- Source: `apps/web/src/i18n/config.ts` and `paths.ts`.

### 2.2 Pages

URL patterns are owned by the code (`PAGE_PATHS` in `apps/web/src/content/routes.ts`). Content only decides which records are published.

| Path (locale-less) | Page key | Component | Rendered when |
|---|---|---|---|
| `/` | `home` | `HomePage` | always |
| `/company` | `company` | `AboutPage` | always |
| `/company/global-presence` | `globalPresence` | `GlobalPresencePage` | always |
| `/technologies` | `technologies` | `TechnologiesPage` | always |
| `/technologies/patents` | `patents` | `PatentsPage` | always |
| `/technologies/:slug` | — (template `technologyDetail`) | `TechnologyDetailPage` | per published technology |
| `/epcm` | `epcm` | `EpcmPage` | always |
| `/products` | `products` | `ProductsPage` | always |
| `/products/:slug` | — (template `productDetail`) | `ProductDetailPage` | per published product |
| `/projects` | `projects` | `ProjectsPage` | always |
| `/projects/:slug` | — (template `projectDetail`) | `ProjectDetailPage` | per published project |
| `/contact` | `contact` | `ContactPage` | always |
| `/privacy`, `/terms` | `privacy`, `terms` | `LegalPage` | **only when the page is published.** Both are `draft` in the seed, so today they are not routed, prerendered or in the sitemap |
| `*` | — | `NotFoundPage` | unmatched paths |

Notes:
- The prerender and sitemap list static pages only when the page record exists and is published (`getPublicPaths` uses `content.hasPage`).
- The React route table in `App.tsx` always registers the eleven non-legal paths.

**Current output (seed content):**

| Item | Count |
|---|---|
| Static pages | 9 |
| Technologies | 6 |
| Products | 6 |
| Projects | 8 |
| Routes (total of the above) | 29 |
| HTML pages (29 routes × 6 locales) | 174 |
| Localized 404 pages | 6 |

### 2.3 Prerender output and serving

`apps/web/scripts/prerender.ts` writes one file per route × locale:

| URL | File |
|---|---|
| `/` | `dist/index.html` |
| `/company` | `dist/company.html` |
| `/projects/solbar-israel` | `dist/projects/solbar-israel.html` |
| `/ru` | `dist/ru.html` |
| `/ru/company` | `dist/ru/company.html` |
| not found (en) | `dist/404.html` |
| not found (other locales) | `dist/<locale>/404.html` |
| sitemap | `dist/sitemap.xml` |

nginx order (`location /`):
1. `try_files $uri $uri.html $uri/index.html`.
2. A path with a trailing slash gets a 301 to the bare path when that page exists.
3. Otherwise `@lookup` runs (redirects, §2.4).
4. Otherwise a **real 404** with `/<locale>/404.html` (picked from the request prefix) or `/404.html`.

There is no SPA fallback. Details: [`deployment.md`](deployment.md).

### 2.4 Redirects

- Redirect rules are stored in the `redirects` table and managed in «SEO → Редиректы». They are not compiled into nginx.
- For a path with no static file, nginx calls `GET /internal/v1/redirect` on the API over loopback, with header `X-Lookup-Path`. This route is hidden from OpenAPI and answers only loopback callers.
- The API resolves the path against the rules of the **active release snapshot**. It follows chains and ignores loops.
- It answers 301/302 with `Location: PUBLIC_SITE_URL + internal path`, or 404.
- Rate limit: 20 r/s per IP, burst 40.
- API down, slow or 5xx → 404 page.
- Only internal targets are possible. Database CHECK constraints enforce this ([`cms-schema.md`](cms-schema.md)).
- Changing the slug of a published project, technology or product can create a `slug_change` redirect (`POST /api/v1/content/{type}/{id}/slug`).
- The seed `redirects.json` is empty. Rules: [`admin-seo.md`](admin-seo.md).

### 2.5 Sitemap, robots, hreflang

| Item | Implementation |
|---|---|
| `sitemap.xml` | Generated by prerender. Lists indexable URLs only, each in its canonical locale, with `xhtml:link` hreflang alternates. No `lastmod`, `priority` or `changefreq` |
| Per-page robots | `<meta name="robots" content="index, follow">` or `"noindex, follow"` (entity `noindex` flag or SEO model). 404 pages are `noindex` (checked by `validate-site.ts`) |
| Canonical / hreflang | Self-canonical. A record whose translation is not approved falls back to English: the canonical points to the English URL and the record is left out of that locale's hreflang and sitemap. hreflang includes `x-default` = English. A `noindex` page has no hreflang links |
| `robots.txt` (public site) | **NOT IMPLEMENTED.** There is no `robots.txt` in `apps/web/public` and none is generated. Only the admin (`apps/admin/public/robots.txt`) and the preview server serve `Disallow: /` |
| Structured data (JSON-LD) | **NOT IMPLEMENTED** (no `ld+json` in `apps/web`) |

---

## 3. Admin SPA (`apps/admin`)

Routes are defined in `apps/admin/src/App.tsx`. Every screen except the sign-in pages is lazy-loaded. A route guard only hides screens; the API checks the permission on every request.

### 3.1 Sign-in flow (outside the shell)

| Path | Screen | Guard |
|---|---|---|
| `/login` | LoginPage | public only |
| `/forgot-password` | ForgotPasswordPage | public only |
| `/reset-password` | ResetPasswordPage (token in `#token=`) | any state |
| `/login/mfa` | MfaPage | session step `mfa_required` |
| `/setup-mfa` | SetupMfaPage | step `mfa_enrollment_required` |
| `/change-password` | ChangeInitialPasswordPage | step `password_change_required` |

### 3.2 Inside the shell (signed in)

| Path | Screen | Permission | Sidebar section |
|---|---|---|---|
| `/` | Обзор (OverviewPage) | — | — |
| `/content/pages` | Страницы | `content.read` | Контент |
| `/content/pages/:id` | Page editor | `content.read` | Контент |
| `/content/:collection` | Collection list. `:collection` ∈ `projects`, `technologies`, `products`, `epcm-stages`, `patents`, `videos`; anything else → 404 | `content.read` | Контент |
| `/content/:collection/:id` | Collection editor | `content.read` | Контент |
| `/media` | Медиатека | `media.read` | Контент |
| `/media/:id` | Media detail | `media.read` | Контент |
| `/leads` | Все заявки | `leads.read` | Заявки |
| `/leads/:id` | Lead detail | `leads.read` | Заявки |
| `/translations` | Переводы: обзор | `content.read` | Переводы |
| `/translations/all` | Все переводы | `content.read` | Переводы |
| `/translations/attention` | Требуют внимания | `content.read` | Переводы |
| `/translations/:type/:id/:locale` | Translation editor | `content.read` | Переводы |
| `/seo` | Проверка SEO | `seo.read` | SEO |
| `/seo/redirects` | Редиректы | `redirects.read` | SEO |
| `/publishing` | Публикация: обзор | `content.read` | Публикация |
| `/publishing/revisions` | Ревизии | `content.read` | Публикация |
| `/publishing/revisions/:type/:id` | History of one record | `content.read` | Публикация |
| `/publishing/releases` | Релизы | `content.read` | Публикация |
| `/publishing/releases/:id` | Release detail | `content.read` | Публикация |
| `/account` | Профиль и безопасность | — | user menu |
| `/admin/users` | Пользователи | `users.manage` | Администрирование |
| `/admin/audit` | Журнал действий | `audit.read` | Администрирование |
| `/admin/system` | Система | `system.read` | Администрирование |
| `*` | NotFoundPage | — | — |

There is no settings screen. The `settings.manage` permission exists, but settings, offices and metrics cannot be edited in the admin yet ([`admin-content.md`](admin-content.md)).

---

## 4. API (`apps/api`)

- **Base:** `/api/v1` on the admin origin. OpenAPI 3.1: `apps/api/openapi.json`, version **0.13.0**, **182 operations**. Regenerate with `npm run openapi`.
- **Errors:** RFC 9457 Problem Details.
- **CSRF:** state-changing requests need `x-requested-with: soltex-admin`. The public lead form uses its own site value.
- **Access column:** the `x-soltex-access` extension of each operation.
  - `public`: no session.
  - `pending`: password verified, second factor not yet.
  - `enrollment`: the session may set up second factors.
  - `full`: complete session, plus the listed permission (a list means "any of").
  - `+step-up`: needs a fresh second factor.
- Concerns: [`admin-auth.md`](admin-auth.md), [`admin-content.md`](admin-content.md), [`admin-translations.md`](admin-translations.md), [`admin-publishing.md`](admin-publishing.md), [`admin-seo.md`](admin-seo.md), [`admin-media.md`](admin-media.md), [`admin-leads.md`](admin-leads.md).

### 4.1 Operations per tag

| Tag | Operations |
|---|---|
| system | 5 |
| auth | 10 |
| mfa | 7 |
| passkeys | 6 |
| users | 6 |
| content | 43 |
| translations | 30 |
| publishing | 46 |
| seo | 13 |
| media | 6 |
| leads | 10 |
| **Total** | **182** |

**Hidden routes, not in the 182:**

| Route | Purpose |
|---|---|
| `GET /internal/v1/redirect` | nginx lookup, loopback only |
| `GET /api/v1/docs/openapi.json` | Only when `API_DOCS=authenticated`, with `system.read`. Forced off in production |

### 4.2 Collection placeholders

The tables below use `{type}` for content types. Which types each row applies to:

| Placeholder | Types |
|---|---|
| **C6** | `projects`, `technologies`, `products`, `epcm-stages`, `patents`, `videos` |
| **R3** | the routable types: `projects`, `technologies`, `products` |
| **T7** | C6 + `pages` |

### 4.3 system (5)

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/health` | public |
| GET | `/api/v1/dashboard` | full |
| GET | `/api/v1/search` | full |
| GET | `/api/v1/audit` | `audit.read` |
| GET | `/api/v1/system/status` | `system.read` |

### 4.4 auth (10)

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/logout` | pending |
| GET | `/api/v1/auth/session` | pending |
| POST | `/api/v1/auth/password-reset/request` | public |
| POST | `/api/v1/auth/password-reset/confirm` | public |
| POST | `/api/v1/auth/password/change` | full (allowed with a temporary password) |
| PATCH | `/api/v1/auth/profile` | full |
| GET | `/api/v1/auth/sessions` | full |
| POST | `/api/v1/auth/sessions/{id}/revoke` | full |
| POST | `/api/v1/auth/sessions/revoke-others` | full |

### 4.5 mfa (7)

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/auth/mfa` | enrollment |
| POST | `/api/v1/auth/mfa/totp/enroll` | enrollment (step-up if enrolled) |
| POST | `/api/v1/auth/mfa/totp/confirm` | enrollment (step-up if enrolled) |
| POST | `/api/v1/auth/mfa/totp/verify` | pending |
| DELETE | `/api/v1/auth/mfa/totp` | full + step-up |
| POST | `/api/v1/auth/mfa/recovery/verify` | pending |
| POST | `/api/v1/auth/mfa/recovery-codes/regenerate` | full + step-up |

### 4.6 passkeys (6)

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/auth/passkeys` | enrollment |
| POST | `/api/v1/auth/passkeys/registration/options` | enrollment (step-up if enrolled) |
| POST | `/api/v1/auth/passkeys/registration/verify` | enrollment (step-up if enrolled) |
| POST | `/api/v1/auth/passkeys/authentication/options` | pending |
| POST | `/api/v1/auth/passkeys/authentication/verify` | pending |
| DELETE | `/api/v1/auth/passkeys/{id}` | full + step-up |

### 4.7 users (6)

All operations need `users.manage`.

| Method | Path | Step-up |
|---|---|---|
| GET | `/api/v1/users` | — |
| POST | `/api/v1/users` | yes |
| PATCH | `/api/v1/users/{id}` | yes |
| POST | `/api/v1/users/{id}/initial-password` | yes |
| POST | `/api/v1/users/{id}/mfa-reset` | yes |
| POST | `/api/v1/users/{id}/sessions/revoke` | yes |

### 4.8 content (43)

| Method | Path | Types | Ops | Access |
|---|---|---|---|---|
| GET | `/api/v1/content/{type}` | C6 | 6 | `content.read` |
| POST | `/api/v1/content/{type}` (create draft) | C6 | 6 | `content.edit` |
| GET | `/api/v1/content/{type}/{id}` | C6 | 6 | `content.read` |
| PATCH | `/api/v1/content/{type}/{id}` | C6 | 6 | `content.edit` or `seo.edit` (then checked per field) |
| POST | `/api/v1/content/{type}/{id}/archive` | C6 | 6 | `content.edit` |
| POST | `/api/v1/content/{type}/{id}/restore` (archived → draft) | C6 | 6 | `content.edit` |
| POST | `/api/v1/content/{type}/{id}/slug` (change address, optional redirect) | R3 | 3 | `redirects.manage` |
| GET | `/api/v1/content/pages` | pages | 1 | `content.read` |
| GET | `/api/v1/content/pages/{id}` | pages | 1 | `content.read` |
| PATCH | `/api/v1/content/pages/{id}` | pages | 1 | `content.edit` or `seo.edit` (then checked per field) |
| GET | `/api/v1/content/media` (picker list) | — | 1 | `media.read` |

Pages cannot be created, archived or restored: the set of pages is owned by the code.

### 4.9 translations (30)

| Method | Path | Types | Ops | Access |
|---|---|---|---|---|
| GET | `/api/v1/content/{type}/{id}/translations/{locale}` | T7 | 7 | `content.read` |
| PATCH | `/api/v1/content/{type}/{id}/translations/{locale}` | T7 | 7 | `content.edit` or `seo.edit` (then checked per field) |
| POST | `/api/v1/content/{type}/{id}/translations/{locale}/approve` | T7 | 7 | `content.publish` |
| POST | `/api/v1/content/{type}/{id}/translations/{locale}/reopen` | T7 | 7 | `content.publish` |
| GET | `/api/v1/translations` | — | 1 | `content.read` |
| GET | `/api/v1/translations/overview` | — | 1 | `content.read` |

### 4.10 publishing (46)

| Method | Path | Types | Ops | Access |
|---|---|---|---|---|
| POST | `/api/v1/content/{type}/{id}/publish` | T7 | 7 | `content.publish` |
| POST | `/api/v1/content/{type}/{id}/unpublish` | T7 | 7 | `content.publish` |
| GET | `/api/v1/content/{type}/{id}/revisions/{n}` | T7 | 7 | `content.read` |
| GET | `/api/v1/content/{type}/{id}/revisions/{n}/compare` | T7 | 7 | `content.read` |
| POST | `/api/v1/content/{type}/{id}/revisions/{n}/restore` | T7 | 7 | `content.edit` |
| GET | `/api/v1/revisions` | — | 1 | `content.read` |
| GET | `/api/v1/publishing/overview` | — | 1 | `content.read` |
| GET | `/api/v1/releases` | — | 1 | `content.read` |
| POST | `/api/v1/releases` (create release candidate) | — | 1 | `content.publish` |
| GET | `/api/v1/releases/{id}` | — | 1 | `content.read` |
| POST | `/api/v1/releases/{id}/activate` | — | 1 | `content.publish` |
| POST | `/api/v1/releases/{id}/retry` | — | 1 | `system.deploy` |
| POST | `/api/v1/releases/{id}/rollback` | — | 1 | `system.rollback` + step-up |
| POST | `/api/v1/releases/{id}/preview` (one-time preview link) | — | 1 | `content.read` |
| POST | `/api/v1/previews` (build preview of working copy) | — | 1 | any of `content.edit`, `seo.edit`, `content.publish` |
| POST | `/api/v1/preview/revoke` | — | 1 | `content.read` |

### 4.11 seo (13)

| Method | Path | Types | Ops | Access |
|---|---|---|---|---|
| GET | `/api/v1/content/{type}/{id}/seo` | T7 | 7 | `seo.read` |
| GET | `/api/v1/seo/report` | — | 1 | `seo.read` |
| GET | `/api/v1/redirects` | — | 1 | `redirects.read` |
| POST | `/api/v1/redirects` | — | 1 | `redirects.manage` |
| GET | `/api/v1/redirects/{id}` | — | 1 | `redirects.read` |
| PATCH | `/api/v1/redirects/{id}` | — | 1 | `redirects.manage` |
| DELETE | `/api/v1/redirects/{id}` | — | 1 | `redirects.manage` |

### 4.12 media (6)

| Method | Path | Access |
|---|---|---|
| GET | `/api/v1/media` | `media.read` |
| POST | `/api/v1/media` (upload) | `media.upload` |
| GET | `/api/v1/media/{id}` | `media.read` |
| DELETE | `/api/v1/media/{id}` (unused only) | `media.delete` |
| GET | `/api/v1/media/{id}/preview` (WebP) | `media.read` |
| POST | `/api/v1/media/{id}/replace` | `media.replace` |

### 4.13 leads (10)

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/public/leads` (site forms; the only API route on the public host) | public |
| GET | `/api/v1/leads` | `leads.read` |
| GET | `/api/v1/leads/{id}` | `leads.read` |
| PATCH | `/api/v1/leads/{id}` | `leads.manage` |
| POST | `/api/v1/leads/{id}/delete` (bin; anonymized after 30 days) | `leads.manage` |
| POST | `/api/v1/leads/{id}/restore` | `leads.manage` |
| POST | `/api/v1/leads/{id}/notes` | `leads.manage` |
| POST | `/api/v1/leads/{id}/notify` | `leads.manage` |
| GET | `/api/v1/leads/assignees` | `leads.read` |
| GET | `/api/v1/leads/export` (CSV) | `leads.export` + step-up |

---

## 5. Preview server routes

Source: `apps/api/src/preview/server.ts`.

| Method | Path | Does |
|---|---|---|
| GET | `/__preview` | Start page. Reads the token from the URL fragment |
| POST | `/__preview/session` | Exchanges the one-time token for an HttpOnly SameSite=Strict cookie (30 min) |
| GET | `/__preview/close` | Revokes the grant |
| GET | `/robots.txt` | `Disallow: /` |
| GET | `/*` | Files of the granted release, with the same routing as the public site, or 401 |

Every response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow, noarchive`.
