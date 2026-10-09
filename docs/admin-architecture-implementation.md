# Admin / backend architecture: implementation log

**Source of truth:** [`docs/admin-architecture-approved.md`](admin-architecture-approved.md) (approved 2026-10-02). This document only records what has been implemented, phase by phase. It does not change the architecture; any deviation is listed explicitly.

---

## Phase A: Foundation (2026-10-02)

**Base commit:** `1accbfb` ("Prepare content architecture for custom admin").
**Scope:** monorepo structure only. The public website must stay identical.

### What was done

1. **Monorepo with npm workspaces.**
   - The package manager was kept: npm, with the existing `package-lock.json`, now at the root.
   - Every previously locked version is unchanged. The only additions are Fastify and its dependency tree (`apps/api`).
2. **The public site moved to `apps/web` with `git mv`**:
   - `src/`, `public/`, `scripts/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `metadata.json`, `package.json` (renamed `react-example` → `@soltex/web`; nothing else changed), `README.md` (AI Studio legacy), `.env.example` (legacy lines kept, real variables documented).
   - No file of the site was edited.
   - The site's build, prerender, validation and QA scripts moved together with it (`apps/web/scripts`), so every relative path inside them is unchanged.
   - There is no second copy of the frontend.
3. **`apps/admin`:** React + Vite application shell with one placeholder screen («Soltex Global Admin»). It has `noindex` and a `robots.txt` that disallows everything. No login, data or design.
4. **`apps/api`:** Fastify 5 bootstrap.
   - `GET /api/v1/health` returns `{status:"ok"}` with `Cache-Control: no-store`.
   - `X-Request-ID` is echoed back.
   - Configuration comes from environment variables (`NODE_ENV`, `API_HOST` default `127.0.0.1`, `API_PORT` 3100, `API_LOG_LEVEL`).
   - No CORS headers.
   - 7 unit tests (`node:test`).
5. **`packages/core`:** skeleton with the four layers `domain/`, `validation/`, `seo/`, `content/`. They export nothing yet, and no code was moved into them. The README documents the layer and dependency rules.
   - `tsconfig` has `lib: ["ES2022"]` and `types: []`, so DOM and Node APIs do not compile in core.
6. **Dependency-direction check** `scripts/check-deps.mjs` (`npm run check:deps`) fails when:
   - core imports an app, React, Vite, a UI or framework package, or a Node module;
   - core uses a browser or Node global;
   - core breaks its layer order;
   - an app imports another app;
   - an app imports a package by relative path.

   Verified with negative test cases.
7. **Root scripts:** see the command table below. The old commands keep working from the root: `npm run build`, `dev`, `lint`, `content`, `validate`, `serve:dist`, `preview`, `clean`.
8. **Environment:** the root `.env.example` documents the development / test / production separation, the variables Phase A uses, and the variables reserved for later phases. It contains no values and no secrets. `apps/web/.env.example` lists the variables the site build actually reads.
9. **CI** (`.github/workflows/ci.yml`):
   - job 1: install, typecheck, check:deps, tests, site build, assert 180 HTML files, no `localhost` in generated documents, admin build;
   - job 2: public-site regression against the PR base / previous commit (`scripts/qa-regression.mjs --base-ref`).

   No database, Redis, SMTP, external services or secrets.
10. **Regression tooling:**
    - `scripts/qa-regression.mjs` (`npm run qa`) runs the whole Phase 1 QA harness against two builds and compares the results;
    - new `apps/web/scripts/qa/navigation.mjs` covers the language switch, client navigation, stored-language redirect, video lightbox, mobile menu and video URLs. Phase 1 checked these with ad-hoc scripts; they are now part of the harness.
11. **`netlify.toml`** (demo only): build command `npm run build:web`, publish directory `apps/web/dist`. The 404 rules are unchanged.

### Structure

```
.
├── apps/
│   ├── web/            public site (@soltex/web): src/, public/, scripts/ (content, prerender,
│   │                   validate-site, serve-dist, qa/), index.html, vite.config.ts, tsconfig.json
│   ├── admin/          admin shell (@soltex/admin)
│   └── api/            API bootstrap (@soltex/api)
├── packages/
│   └── core/           shared domain layer (@soltex/core): src/{domain,validation,seo,content}
├── scripts/            monorepo tooling: check-deps.mjs, qa-regression.mjs
├── docs/
├── .github/workflows/ci.yml
├── .env.example  .gitignore  .nvmrc  netlify.toml  package.json  package-lock.json  README.md
```

### Dependency direction

```
apps/web    apps/admin    apps/api
     \          |          /
      ▼         ▼         ▼
          packages/core          (core never imports apps; apps never import each other)

core layers:  domain ◄── validation ◄── seo
                   ▲          ▲
                   └──────────┴────── content      (seo and content do not import each other)
```

- `apps/admin` and `apps/api` already declare `@soltex/core` as a dependency.
- `apps/web` does not yet: the web content layer moves into core only in Phase B, behind the regression gate.

### Commands

| Purpose | Command (repository root) |
|---|---|
| Install | `npm install` (CI: `npm ci`) |
| Dev | `npm run dev` / `dev:web` (3000), `dev:admin` (3001), `dev:api` (3100) |
| Build | `npm run build` = `build:web` → `apps/web/dist`; `build:admin` → `apps/admin/dist`; `build:all` |
| Type check | `npm run typecheck` (web incl. content validation; admin; api; core) |
| Dependency rules | `npm run check:deps` |
| Lint | `npm run lint` (= typecheck + check:deps; the project has no ESLint) |
| Tests | `npm test` |
| QA / regression | `npm run qa -- --base <baseline-dist>` or `--base-ref <git-ref>`. Add `--shots` for screenshots. Needs Playwright + Chromium (`npm i --no-save playwright@1 && npx playwright install chromium`, or `CHROMIUM_PATH`). Output in `.qa/` |
| Serve the static site | `npm run serve:dist` (port 4173, real 404s) |

### Verification (2026-10-02)

| Check | Result |
|---|---|
| `npm run typecheck` (web + content validation, admin, api, core) | pass |
| `npm run check:deps` | OK (negative cases verified to fail) |
| `npm test` | 7/7 pass |
| `npm run build` | pass: 174 pages + 6 × 404 = 180 HTML, `validate-site` OK |
| `npm run build:admin` | pass |
| `dev:web`, `dev:admin`, `dev:api` | start; `/api/v1/health` → 200 |
| Dependency versions | every package version from the previous lock unchanged; Fastify tree added |

### Regression against `1accbfb`

| Check | Result |
|---|---|
| HTML outputs | 180 = 174 pages + 6 localized 404, same file list (229 files) |
| `validate-site` | OK: 174 pages, 6 not-found pages, 203 internal links/assets, sitemap, hreflang, redirects, portability |
| Page data, 348 page loads (29 routes × 6 languages × 1440/390): head/SEO, canonical, hreflang, OG, `lang`/`dir`, texts, attributes | **IDENTICAL**, no runtime errors |
| JavaScript disabled, motion, script-fail fallback, real 404s (EN/RU/AR/unknown project) | **identical** to baseline |
| Interactions (dialogs, inquiry topics, forms) | **identical** |
| Navigation (language switch → AR/RTL, client navigation, detail/back, stored-language redirect, video lightbox, mobile menu EN/AR, video URLs) | **identical** |
| Inquiry topic follows the language (18 cases) | **ALL PASSED** |
| Screenshots, 696 full-page (29 routes × 6 languages × 390/768/1280/1440) | 652 pixel-identical at first pass. 18 above the threshold, all on pages with autoplaying or hover video previews and lazy media. Recaptured: 12 of 18 identical. The remaining differences are on home pages, and the baseline differs from **itself** on the same pages (base vs base: 7 of 18 differ). Capture noise, not a regression |
| Build output bytes | **byte-identical**: all 229 files of `apps/web/dist` equal `1accbfb`'s `dist`, asset hashes included, after the fix below |

**Difference found and resolved: the main CSS file.**
- **What:** the CSS file lost two utility classes that nothing uses: `.outline` and `.text-wrap`. Two `--tw-outline-style` declarations changed position. Its hash changed from `index-DE9U3zLp.css` to `index-DaJ5waLg.css`, so the main JS (same content except for the CSS file name) and every HTML file reference new asset names.
- **Cause:** Tailwind CSS 4 detects class candidates automatically by scanning all non-ignored files under the project root. Before Phase A the project root was the repository root, so Tailwind also scanned `docs/` and picked up the words `text-wrap` and `outline` from `docs/qa-pre-presentation.md`. Since `apps/web` is the project root, `docs/` is no longer scanned.
- **Impact:** neither class appears in any HTML or JS of the site, so rendering is unchanged (page data, checks, interactions and navigation were identical even before the fix).
- **Resolution (client decision, 2026-10-02):** restore byte identity with one line in `apps/web/src/index.css`, directly after `@import "tailwindcss";`: `@source inline("outline text-wrap");`. This explicitly keeps the two classes that the old root-level scan produced. Verified: the build output is byte-identical to `1accbfb`.
- **Removing it later:** remove the line in a dedicated cleanup task (expected diff: exactly the two classes). **Do not** point `@source` at `docs/`: then any word in the documentation would become CSS.

### Deliberately NOT done in Phase A

- PostgreSQL, Drizzle, migrations;
- auth (Argon2, WebAuthn, TOTP), sessions, users, RBAC, audit log;
- content CRUD, admin editor, media library, translations UI, leads, e-mail;
- publishing, releases, preview, redirects database, pg-boss;
- backups, VPS, nginx, systemd.
- No code was moved from `apps/web` into `packages/core`.
- No legacy code was removed (P1-17 still applies).
- No change to design, copy, translations, URLs, routes, SEO, images, videos or forms. The only edit to a site source file is the CSS line from A-4, which keeps the output byte-identical.

### Deviations from the approved architecture (Phase A)

| # | Deviation | Reason | Resolved in |
|---|---|---|---|
| A-1 | Node.js stays **22** (`.nvmrc`); the approved runtime is Node 24 LTS | Changing the runtime is outside a structure-only phase, and `.nvmrc` also drives the Netlify demo build. Everything is compatible with Node 24 | Phase C (before the first API code), verified by the regression |
| A-2 | Tests use the built-in **`node:test`** instead of Vitest (review §B) | No new dependency for 7 scaffold tests | Phase B/C, when real test suites start (Vitest can run them unchanged) |
| A-3 | `packages/core` has no Zod yet | No schema exists yet; core's only allowed runtime dependency is added with the first schema | **Resolved in Phase B** |
| A-4 | `apps/web/src/index.css` has one added line, `@source inline("outline text-wrap")` (the only edit to a site source file) | Moving the Tailwind scan root to `apps/web` dropped two unused classes; the line keeps the output byte-identical (see above) | Later cleanup task (optional) |

---

## Phase B: Database and import (2026-10-07)

**Base commit:** `22b4ede`. Details: [`admin-database.md`](admin-database.md).

### What was done

1. **`packages/core`:**
   - `domain/locales.ts` (content languages);
   - `content/store.ts`: the stored content types, moved unchanged from `apps/web/src/content/types.ts`, which now re-exports them;
   - `content/localized.ts`: `isLocalized`, `projectLocale`, `mergeLocales`, `splitText`/`joinText`;
   - `content/jsonb.ts`: Zod schemas of every JSONB column;
   - Zod 4 is core's only runtime dependency;
   - 6 unit tests.
2. **Schema** (`apps/api/src/db/schema.ts`, Drizzle) and committed migrations:
   - `drizzle/0000_content_schema.sql`: 29 tables;
   - `drizzle/0001_locales_reference_data.sql`.
3. **Roles:** `apps/api/db/provision.sql` creates `soltex_migrate` (owner), `soltex_app` (DML only) and `soltex_backup` (read-only).
4. **Import / export:**
   - `apps/api/src/content/import.ts`: idempotent, one transaction, never deletes;
   - `apps/api/src/content/export.ts`: one consistent snapshot, seed format, seed key order;
   - CLI: `db:migrate`, `db:import`, `db:export`, `db:generate`.
5. **Site:** new content source `file` (`apps/web/src/content/sources/file.ts`). Usage: `CONTENT_SOURCE=file CONTENT_STORE_FILE=… npm run build:web` builds the site from a database export. The default source is still `seed`.
6. **Tests and CI:**
   - `apps/api/src/db/db.test.ts` (8 tests, `npm run test:db`);
   - new CI job `database`: PostgreSQL 17 service → provision → migrate → DB tests → import/export → `diff` with the seed → site build from the database `diff` with the seed build;
   - drift check: the committed migrations must match the schema.

### Verification

| Check | Result |
|---|---|
| `seed → DB → export` vs the 10 seed files | **byte-identical** |
| Site built from the DB export vs site built from the seed | **byte-identical** (229 files, 180 HTML) |
| Site built from the seed vs Phase A (`22b4ede`) | **byte-identical** (the type move changes no output) |
| Second import | no row count and no exported byte changes |
| Failing import | full rollback |
| `soltex_app` | cannot `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, create a schema, or write `locales`; can read and write content |
| `soltex_backup` | read-only |
| Redirect checks | external URL, `//host`, `/\host`, `javascript:`, CRLF, self-redirect: all rejected by the database |
| FK `RESTRICT` / slug uniqueness | enforced |
| `npm run typecheck`, `check:deps`, `test` | pass |
| `drizzle-kit check` / no drift | pass |

Local tests ran on PostgreSQL 17.10. CI uses the official `postgres:17` image.

### Deviations (Phase B)

| # | Deviation | Reason |
|---|---|---|
| B-1 | `page_list_items.structure` is `json` (not `jsonb`) | Key order of arbitrary list items is content; `jsonb` reorders keys (`admin-database.md` DB-5). Validated by Zod like every JSONB column |
| B-2 | `schema_version` is per table, not inside each JSON value | Plain lists (`string[]`) cannot carry a version field without changing their shape; one version per table covers all its JSON columns |
| B-3 | `normalize` and the page-slot registry still live in `apps/web` | Moving them is not needed for the database. It follows when the admin needs them (Phase E/H), behind the regression gate |

### Not done in Phase B (by design)

Users, sessions, auth, audit log (Phase C); revisions, releases, publishing (G); preview (H); redirect lookup (I); media uploads (J); leads (K). No admin screens yet.

---

## Phase C: API authentication, RBAC and audit (2026-10-08)

**Base commit:** `99637e0`. Details: [`admin-auth.md`](admin-auth.md); tables: [`admin-database.md`](admin-database.md).

### What was done

1. **`packages/core/src/domain/permissions.ts`:**
   - 6 roles and 21 permissions; the role → permission matrix written out explicitly;
   - `hasPermission` (no wildcard; unknown roles or permissions are denied);
   - MFA requirement per role;
   - field-level rules (`deniedContentFields`);
   - user-management rules (`canManageUser`);
   - 6 tests.
2. **Database:**
   - migration `0002`: users, sessions, known devices, WebAuthn credentials and challenges, TOTP, recovery codes, password resets, `audit_events`, and FKs for every `created_by` / `updated_by`;
   - migration `0003`: append-only audit log (grants + triggers).
   - Phase B migrations are unchanged.
3. **API (`apps/api`):**
   - Fastify 5 + Zod 4 (`fastify-type-provider-zod`);
   - `buildApp({config, db, now, notifier})` with injected dependencies; the clock and notifier are replaceable in tests;
   - modules:
     - `auth/`: passwords, sessions, factors, guard, login, TOTP, recovery, WebAuthn, password flows;
     - `audit/`;
     - `http/`: problems, request ID, cookies, security;
     - `routes/`: auth, mfa, passkeys, users, system;
     - `users/`;
     - `notify/`.
4. **Endpoints (29 operations under `/api/v1`):**
   - health;
   - login, logout, session, sessions + revoke + revoke-others;
   - password change, password reset request / confirm, profile;
   - MFA state, TOTP verify / enroll / confirm / remove, recovery verify / regenerate;
   - passkey registration and authentication options / verify, list, remove;
   - users list / create / update / MFA reset / revoke sessions;
   - audit log;
   - OpenAPI document.
5. **Cross-cutting:**
   - RFC 9457 problems;
   - `X-Request-ID`;
   - CSRF header + Origin / Sec-Fetch-Site checks;
   - helmet headers; no CORS; `no-store`;
   - body limit 64 KB;
   - in-memory rate limits;
   - log redaction.
6. **OpenAPI 3.1:** `apps/api/openapi.json` is generated by `npm run openapi` and committed. A test and a CI step fail on drift.
7. **CLI:** `npm run auth:bootstrap-owner`: interactive, hidden password, or `--password-stdin`. Refuses when an active Owner exists. Advisory lock; audited.
8. **Configuration:** new variables in `.env.example`, placeholders only: `ADMIN_ORIGIN`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `DATA_ENCRYPTION_KEYS`, `DATA_ENCRYPTION_KEY_ID`, `HASH_SECRET`, `SESSION_COOKIE_SECURE`, `API_DOCS`, `MFA_FOR_ALL_ROLES`. The API refuses to start with missing or weak keys.
9. **Tests:** see [`admin-auth.md`](admin-auth.md) §9.
   - `npm test`: 32 tests (core 12, api 20);
   - `npm run test:db`: 64 tests.
   - The Phase A tests were updated: the async `buildApp`, and request IDs must now be UUIDs.
10. **CI:**
    - OpenAPI drift check in the build job;
    - the database job runs all auth / RBAC / audit suites.

### Verification (2026-10-08)

| Check | Result |
|---|---|
| `npm run lint` (typecheck web/admin/api/core + check:deps) | pass |
| `npm test` | 32 / 32 pass |
| `npm run test:db` on the dev database and on a **freshly provisioned** database (migrations from zero) | 64 / 64 pass on both |
| `drizzle-kit check` / no drift | pass |
| `openapi.json` up to date | pass |
| Public site build vs Phase B (`99637e0`) | **byte-identical** (229 files, 180 HTML) |
| `qa-regression --base-ref 99637e0` | **IDENTICAL to the baseline**: dist bytes, page data of 348 page loads, no-JS / motion / script-fail / 404, interactions, navigation, inquiry topics (all passed) |
| DB regression: `seed → DB → export` | **byte-identical** to the seed |
| Site built from the DB export vs the seed build | **byte-identical** |
| Admin shell build | pass (unchanged) |
| Secret scan of the diff; `git diff --check` | clean |

### Deviations (Phase C)

| # | Deviation | Reason |
|---|---|---|
| C-1 | Node.js stays **22** (A-1 remains open) | Instruction for Phase C: no runtime migration. Every dependency added supports Node 22 and 24. Node 24 is a separate task |
| C-2 | **No `SESSION_SECRET`** variable | Sessions are random opaque tokens stored as sha256 in PostgreSQL. Nothing is signed, so there is no signing secret. The secrets are `DATA_ENCRYPTION_KEYS` (TOTP at rest) and `HASH_SECRET` (IP / e-mail HMAC) |
| C-3 | TOTP via **otplib v13** | Maintained, small, RFC 6238. The replay guard and encryption are ours |
| C-4 | **E-mail is not sent yet** | `Notifier` interface with `UnconfiguredNotifier`, which logs only the user ID and the alert type. Password reset tokens therefore reach users only once SMTP exists (Phase K). Until then an admin sets a new password via user management, or the Owner runs the bootstrap on an empty system |
| C-5 | Session cookie `Path=/` | Required by the `__Host-` prefix. The admin and API share the origin |
| C-6 | Rate limits **in memory** | One API process (approved §10). Redis is not introduced. Counters reset on restart; the persistent per-account counters (delay, lock-out) are in PostgreSQL |
| C-7 | Users are created by an Owner or Admin **with an initial password** (no invitation e-mail) | No e-mail until Phase K. An invitation flow can replace this then |
| C-8 | The first factor can be enrolled at `aal 1` (right after the password) | A new user has no factor yet. Every further factor needs step-up |
| C-9 | Tests stay on `node:test` (A-2) | 96 tests run without Vitest. No reason to add a dependency |
| C-10 | `audit_events` is not partitioned yet | Volume is tiny. Retention (§19) is a later, separately reviewed migration |

### Not done in Phase C (by design)

Admin UI (login screens included), content CRUD API, editor, publishing, preview, media, leads, e-mail delivery, Redis, GraphQL, pg-boss.

---

## Phase D: Admin shell (2026-10-08)

**Base commit:** `1147fa7`. Details: [`admin-ui.md`](admin-ui.md).

### What was done

1. **`apps/admin`, the Russian admin SPA:**
   - stack per review §B: React Router 7, TanStack Query and Table, react-hook-form + Zod, Radix UI, Tailwind 4, `@simplewebauthn/browser`, `uqr` for the local TOTP QR code;
   - the Phase A placeholder is replaced.
2. **Sign-in:**
   - password;
   - second factor: passkey, authenticator code, or recovery code;
   - mandatory enrollment by role: passkey for Owner and Admin, passkey or app for others;
   - recovery codes shown once;
   - forgot-password and reset pages; the token is in the URL fragment;
   - return to the page asked for, with no open redirect;
   - clear end-of-session messages; sign-in state shared across tabs.
3. **Shell:**
   - sidebar and ⌘K from one navigation model filtered by the session's permissions; ⌘K has no publishing commands;
   - user menu, breadcrumbs, mobile drawer;
   - toasts with the request id for unexpected errors;
   - step-up dialog with an automatic retry;
   - unsaved-changes guard;
   - «Дополнительно» for Owner and Admin only.
4. **Screens:**
   - Обзор;
   - Профиль и безопасность: profile, passkeys, authenticator app, recovery codes, password, sessions;
   - Пользователи: list, create, edit role and status, end sessions, reset MFA; rules from core `canManageUser`;
   - Журнал действий: Russian wording, server-side filters, cursor paging, details;
   - Система: API status;
   - «Недостаточно прав» and «Страница не найдена».
5. **Contract:** `src/lib/api/schema.gen.ts` is generated from `apps/api/openapi.json` (`npm run api:types`). CI fails on drift. The admin imports no API code.
6. **Security:**
   - cookies only; CSRF header on every change; no token or code in browser storage;
   - strict CSP for the admin host (`ADMIN_CSP`, admin-ui.md §8), also served by `vite preview`;
   - CI greps the admin bundle for secrets and server addresses.
7. **Tests:**
   - admin unit tests (11, `node:test`);
   - E2E (23): `scripts/admin-e2e.mjs` + `apps/admin/e2e/`, the built admin under its CSP, against the real API and PostgreSQL, in Chromium with a virtual WebAuthn authenticator;
   - test-only seeding helper `apps/api/test/e2e-seed.ts`;
   - new CI job `admin-e2e`.
8. **Unchanged:** `apps/web`, `packages/core`, the API code (`apps/api/src`), migrations and `openapi.json`.

### Verification (2026-10-08)

| Check | Result |
|---|---|
| `npm run lint` (typecheck web, admin incl. tests, api, core + check:deps) | pass |
| `npm test` | 43 / 43 pass (core 12, api 20, admin 11) |
| `npm run test:db` | 64 / 64 pass |
| `npm run test:e2e:admin` on a freshly provisioned database | 23 / 23 pass; no page errors, no CSP violations |
| `openapi.json`, admin API types | up to date |
| Admin bundle | builds; no secrets or server addresses |
| Public site build vs Phase C (`1147fa7`) | **byte-identical** (229 files, 180 HTML) |
| `qa-regression --base-ref 1147fa7` | **IDENTICAL to the baseline**: dist bytes, page data of 348 page loads, no-JS / motion / script-fail / 404, interactions, navigation, inquiry topics |
| DB regression: `seed → DB → export`; site from the DB export | **byte-identical** to the seed; **identical** build |

### Deviations (Phase D)

| # | Deviation | Reason |
|---|---|---|
| D-1 | Tests use `node:test` for unit tests and Playwright as a QA tool (installed `--no-save`, like the site regression), not Vitest / a Playwright dependency | Same as A-2 / C-9: no new test runner. CI installs Playwright in the E2E job |
| D-2 | **Обзор** shows only sign-in security and the available sections | The metrics of review §X need leads, SEO, translations, builds and backups (Phases E–N). No placeholder numbers |
| D-3 | **Система** shows only API liveness and response time | Builds, releases, disk, backups and the queue (approved §19) do not exist yet (Phases G, L, N) |
| D-4 | ⌘K searches sections, harmless actions and people on the client | Content search (PostgreSQL FTS, review §B) needs content endpoints (Phase E). ⌘K never offers publishing or rollback |
| D-5 | CSP `style-src 'unsafe-inline'` | Radix sets inline `style` attributes for positioning. Scripts stay `'self'` only |
| D-6 | The reset link format is fixed now: `https://admin…/reset-password#token=…` | Phase K e-mails must use it. The fragment keeps the token out of logs and Referer |
| D-7 | New users get an initial password from an Owner or Admin (C-7) | No e-mail until Phase K. The dialog generates a strong password and asks to pass it on through a protected channel |
| D-8 | The main admin chunk is about 145 kB gzip; screens behind the shell load on demand | No admin performance budget is defined. Desktop-first internal tool |
| D-9 | Node.js stays 22 (A-1 / C-1) | No runtime migration in this phase |
| D-10 | `apps/admin/tsconfig.json` gains `allowImportingTsExtensions` | `@soltex/core` sources import with `.ts` extensions; the admin reads them through Vite. No emit, no effect on the build output |

### Not done in Phase D (by design)

Content, media, translations, leads, SEO, settings, publishing, releases and preview screens; dashboard metrics; ASVS checklist (Phase M); nginx configuration (Phase N).

---

## Phase E: Content management (2026-10-08)

**Base commit:** `8527b2c`. Details: [`admin-content.md`](admin-content.md).

### What was done

1. **Content API** (`/api/v1/content/…`, tag `content`):
   - list / read / create (draft) / update / archive / restore for projects, technologies, products, EPC / EPCM stages, patents and videos;
   - list / read / update for the 14 fixed pages and detail-page templates;
   - read-only media list for pickers;
   - no hard delete. Every mutation: session + second factor, CSRF header, permission, Zod validation (`.strict()`), audit event, RFC 9457 problem with `request_id`, `X-Request-ID`.
2. **Existing tables only.** No migration: `version`, `archived_at`, `updated_by`, `source_locale` already existed (Phase B).
3. **Optimistic locking:** `ETag: "<version>"`, `If-Match` required (428), `UPDATE … WHERE version = n`, 409 `edit_conflict` with the exact Russian message.
4. **Field-level authorization in the API:** only changed fields are checked against core `SEO_FIELDS`; the route guard accepts "any of" (`content.edit` | `seo.edit`); refusals are audited after the rolled-back transaction.
5. **Translations safe by construction:** the source language (EN) is edited; approved and in-progress translations keep their text and follow list moves (`from` origins); `missing` locales mirror the source, so the Phase B export keeps all six locale rows in the same shape. Translation statuses are never changed.
6. **Slugs:** core `slugProblem` / `slugify` (route model: one language-neutral slug, `[a-z0-9-]`, ≤ 80, reserved `technology/patents`); unique per type (409 `slug_taken`); locked once a record is not a draft.
7. **Statuses:** create → draft; draft ⇄ archived; published records are edited but not archived; archived records are read-only.
8. **Pages:** core `PAGE_REGISTRY` (generated from the seed, tested against it) defines each page's slots, list item texts, images and SEO; placeholders such as `{count}` must stay intact; lists have a fixed structure.
9. **Admin «Контент»:** Страницы, Проекты, Технологии, Продукты, EPC / EPCM, Патенты, Видео. Lists with server-side search, status filter, sort and pages kept in the URL. Typed editors with labels, help, limits and counters, inline errors, dirty state, ⌘S, the unsaved-changes dialog (now a Phase D `ConfirmDialog`, no `window.confirm`), conflict banner, archive / restore confirmation, translations summary, SEO counters and warnings, media picker, read-only views per permission. No rich text editor (the content has no rich text), no raw JSON.
10. **Contract:** OpenAPI regenerated (API 0.5.0); `api-types` now also emits header parameters and record schemas.
11. **Tests:** core +5, admin unit +8, API DB +15, admin E2E +12 (`apps/admin/e2e/content.e2e.mjs`).
12. **Unchanged:** `apps/web`, the seed, migrations 0000–0003, public routes, SEO and prerender.

### Verification (2026-10-08)

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm run lint` | pass |
| `npm test` | 56 / 56 pass (core 17, api 20, admin 19) |
| `npm run test:db` | 79 tests: 78 pass, 1 skipped (backup role, no `BACKUP_DATABASE_URL` locally) |
| `npm run test:e2e:admin` | 35 / 35 pass (shell 23, content 12); no page errors, no CSP violations |
| `openapi.json`, admin API types, Drizzle schema | up to date; no drift, no new migration |
| Admin bundle | builds; no secrets or server addresses |
| Public site build vs Phase D (`8527b2c`) | **byte-identical** (229 files, 180 HTML) |
| `qa-regression --base-ref 8527b2c` | **IDENTICAL to the baseline** |
| DB regression: `seed → DB → export` (after `test:db`); site from the DB export | **byte-identical** to the seed; **identical** build |

### Deviations (Phase E)

| # | Deviation | Reason |
|---|---|---|
| E-1 | Published records cannot be archived; no publish / unpublish | Publishing, unpublish and revisions are Phase G. Archiving live content without unpublish would desynchronise the site |
| E-2 | The slug of a non-draft record is locked | Changing a live URL needs the redirect flow (Phase I) |
| E-3 | Records without a translation (`missing`) mirror the source on every save | The Phase B export requires all six locale rows with the same shape; mirroring keeps the export valid until the translation workflow (Phase F) |
| E-4 | Page lists edit item texts only; no add / remove / reorder | Page list items are tied to the design (fixed layouts); new item templates would change the public site |
| E-5 | Media picker without uploads; previews only when `VITE_MEDIA_BASE_URL` is set | Uploads, variants and the media library are Phase J |
| E-6 | List search is a source-language `ILIKE` on title, slug and key; ⌘K does not search content | PostgreSQL FTS is designed with content search later (review §B) |
| E-7 | The admin main chunk grew to about 162 kB gzip (editors are lazy) | Same as D-8: no admin budget; Vite's chunk warning is accepted |
| E-8 | `apps/admin/src/lib/unsaved.ts` became `unsaved.tsx` | The guard now renders the Phase D confirmation dialog instead of `window.confirm` |

### Not done in Phase E (by design)

Publishing, revisions and scheduling (G); preview (H); SEO checker, redirects, slug changes of live records (I); translation workflow and outdated detection (F); uploads and the media library (J); leads and e-mail (K); settings, offices, metrics and footer editing; hard delete with usages; ASVS checklist (M); deployment (N).

---

## Phase F: Translation management (2026-10-09)

**Base commit:** `6334636`. Details: [`admin-translations.md`](admin-translations.md).

### What was done

1. **State model** (`@soltex/core/domain` `translations.ts`):
   - stored `missing` / `in_progress` / `approved` (enum unchanged);
   - effective `outdated` derived from source revisions;
   - workflow (save → in progress; approve; reopen), completion (rounded down), review permission (`content.publish`).
2. **Migration `0004_translation_review`** (additive):
   - `source_revision` on the seven admin-managed entities;
   - `version`, `approved_source_revision`, `approved_by`, `edited_source_revision` on their translation tables.
3. **Outdated detection:**
   - Phase E saves raise `source_revision` only when translated source text changes;
   - every write to a language row raises its `version`;
   - existing approvals are linked to the revision by `reconcileApprovals()` (seed-hash check, same rule as the site build validator) in `db:import` and after `db:migrate`;
   - the export writes the seed-format hash for current approvals, so `seed → DB → export` stays byte-identical and export → import keeps every state.
4. **API** (tag `translations`, API 0.6.0):
   - overview (one aggregate query);
   - list with filters, sort and paging;
   - read / save / approve / reopen per record and language;
   - `If-Match` = `"<sourceRevision>.<rowVersion>"`;
   - field-level authorization, RFC 9457, audit (`translation.update` / `approve` / `reopen`).
   - The Phase E record and list responses now report the effective state (adds `outdated`).
5. **Admin «Переводы»:**
   - Обзор, Все переводы, Требуют внимания;
   - side-by-side translation editor with RTL inputs for Arabic, dirty state, conflict handling and review actions (reopen through the Phase D confirmation dialog);
   - Phase E «Языковые версии» link to the translations;
   - audit wording in Russian.
6. **Tests:** core +4, admin unit +6, API DB +15, admin E2E +10 (`translations.e2e.mjs`).
7. **Test hygiene:** a Phase D E2E step («Новый пользователь» dialog) now closes with its «Отмена» button instead of Escape; Escape was occasionally lost under load (one flaky run in five).
8. **Unchanged:** `apps/web` (no file changed), the seed, migrations 0000–0003, routes, SEO, prerender, fallback rules, release pipeline; no new dependency, role or permission.

### Verification (2026-10-09)

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm run lint` (typecheck web, admin incl. tests, api, core + check:deps) | pass |
| `npm test` | 66 / 66 pass (core 21, api 20, admin 25) |
| `npm run test:db` on a freshly provisioned database | 94 tests: 93 pass, 1 skipped (backup role: no `BACKUP_DATABASE_URL` locally) |
| `npm run test:e2e:admin` | 45 / 45 pass (shell 23, content 12, translations 10); no page errors, no CSP violations |
| `openapi.json`, admin API types | up to date (100 operations) |
| Drizzle | `drizzle-kit check` OK; `generate` → no schema changes |
| Migration on a Phase E database | 240 existing approvals linked; second run: nothing to do; export = seed |
| Admin bundle | builds; no secrets or server addresses |
| Public site build vs Phase E (`6334636`) | **byte-identical** (229 files, 180 HTML) |
| `qa-regression --base-ref 6334636` | **IDENTICAL to the baseline**: dist bytes, page data of 348 page loads, no-JS / motion / script-fail / 404, interactions, navigation, inquiry topics |
| DB regression: `seed → DB → export` after `test:db`; site from the DB export | **byte-identical** to the seed; **identical** build |

### Deviations (Phase F)

F-1 … F-8 in [`admin-translations.md`](admin-translations.md) §9. In short:
- no translation revisions yet (G), so an unapproved translation falls back to English on the site;
- approval reuses `content.publish`;
- `outdated` is derived, not stored;
- CMS approvals get their seed-format hash at export time;
- settings, offices, metrics and alt texts are not translated in the admin;
- migrated Phase E databases are reconciled conservatively;
- no source diff;
- no localized slugs, machine translation or tasks.

### Not done in Phase F (by design)

Publishing, revisions, releases, scheduling (G); preview (H); SEO checker and redirects (I); media library and alt-text translation (J); leads (K); dashboard (L); ASVS (M); deployment and backups (N); machine translation, translation tasks, translator role, localized slugs.

### Next: Phase G (publishing)

Publish / unpublish, revisions (including approved translation revisions served while a newer one is in progress), releases.
