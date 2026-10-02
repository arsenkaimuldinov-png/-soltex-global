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
| A-3 | `packages/core` has no Zod yet | No schema exists yet; core's only allowed runtime dependency is added with the first schema | Phase B |
| A-4 | `apps/web/src/index.css` has one added line, `@source inline("outline text-wrap")` (the only edit to a site source file) | Moving the Tailwind scan root to `apps/web` dropped two unused classes; the line keeps the output byte-identical (see above) | Later cleanup task (optional) |

### Next: Phase B (database + import)

PostgreSQL 17 + DB roles (§17.1), Drizzle schema and reviewed migrations, JSONB schemas in `packages/core`, seed → DB import, export, round-trip test (export ≡ seed; build from DB IDENTICAL). See approved architecture §23.
