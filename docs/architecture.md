# Architecture

Status: current as of Phase M-1 (commit 959f733)

This document describes the system as it is implemented. It does not describe plans. The approved target architecture is [`admin-architecture-approved.md`](admin-architecture-approved.md). Phase-by-phase progress is in [`admin-architecture-implementation.md`](admin-architecture-implementation.md).

---

## 1. Superseded plan: Directus + Next.js

The project brief proposed **Directus + PostgreSQL** as the CMS and **Next.js** as the frontend. Neither was built.

| Decision | Where it is recorded | Reason given there |
|---|---|---|
| No third-party CMS (Sanity / Directus rejected) | [`decisions-phase1.md`](decisions-phase1.md) P1-02 | Client decision. It replaced the Sanity/Directus recommendation of the pre-implementation specification |
| Custom admin + API on top of the Phase 1 content model | [`custom-admin-architecture.md`](custom-admin-architecture.md) | The admin plugs into the existing `ContentStore` / `ContentSource` contract, so no page component has to change |
| Static prerendered site, no SSR/ISR | [`admin-architecture-approved.md`](admin-architecture-approved.md) ADR-09, DEFERRED table | "Static output is faster, safer, simpler". The site survives API outages |
| Admin built with React + Vite (Next.js, Refine and React-Admin rejected) | [`admin-architecture-review.md`](admin-architecture-review.md) §B | One stack for the team. Refine and React-Admin impose their own UX |
| Modular monolith: Fastify 5, Drizzle, PostgreSQL 17 | approved ADR-01, ADR-03…ADR-05 | Small set of mature parts. No SaaS dependency |

**Deviations of the implementation from the approved ADR** (verified in code):

| ADR | Approved | Implemented |
|---|---|---|
| ADR-02 | Node.js 24 LTS | Node.js 22 (`.nvmrc`, README) |
| ADR-07 | pg-boss job queue | No pg-boss dependency. The `releases` table is the queue (`FOR UPDATE SKIP LOCKED` + an advisory lock, `apps/api/src/publishing/worker.ts`). E-mail uses the `outbox` table |
| ADR-11 | Preview via `CONTENT_SOURCE=preview` | Preview is a normal build of a `preview`-kind snapshot, served by a separate preview server (`apps/api/src/preview/server.ts`) |

---

## 2. Monorepo layout

npm workspaces (root `package.json`). Dependency direction is `packages/core` ← apps, with no app → app imports. `scripts/check-deps.mjs` enforces this.

| Workspace | Stack | Role |
|---|---|---|
| `apps/web` | React 19, Vite 8, Tailwind 4, React Router 7 | Public site. Prerendered to static HTML in 6 locales (`en` unprefixed; `ru`, `zh`, `tr`, `ar` (RTL), `es` prefixed). Content comes from a `ContentStore` (seed JSON or a DB export), never from the API at render time |
| `apps/admin` | React 19, Vite, Tailwind 4, TanStack Query/Table, react-hook-form + Zod, Radix UI | Admin SPA, Russian UI. Talks only to `/api/v1` on its own origin |
| `apps/api` | Fastify 5, Drizzle ORM, `pg`, Zod 4, `@node-rs/argon2`, `@simplewebauthn/server`, `otplib`, `sharp`, `nodemailer` | Three processes from one codebase: **API** (`src/server.ts`, port 3100), **worker** (`src/worker.ts`) and **preview server** (`src/preview-server.ts`, port 3102). Plus CLIs: `db:migrate`, `db:import`, `db:export`, `auth:bootstrap-owner`, `media:variants`, `openapi` |
| `packages/core` | TypeScript + Zod only (no UI, no framework) | Shared domain layer. `domain` (locales, roles/permissions, release state machine, translation states, leads, media, site CSP), `seo` (checker, meta, slug, redirects), `content` (stored `ContentStore` types, JSONB Zod schemas, page-slot registry). `validation` is still empty |

Other top-level folders:

| Folder | Contents |
|---|---|
| `apps/api/drizzle/` | SQL migrations `0000`–`0010` ([`cms-schema.md`](cms-schema.md)) |
| `apps/api/db/provision.sql` | DB roles |
| `deploy/nginx/soltexglobal.conf` | Public site host |
| `netlify.toml` | Temporary demo hosting only |
| `scripts/` | Lint guards, QA, admin E2E |

The root `drizzle/` folder only holds an empty `meta/_journal.json`. The real migrations are in `apps/api/drizzle/`.

---

## 3. Runtime components

```
                       ┌──────────── admin origin (ADMIN_ORIGIN) ────────────┐
  editor ── browser ──►│ apps/admin SPA (static)   +   /api/v1/*  ──► API    │──► PostgreSQL 17
                       └──────────────────────────────────────────────────────┘        ▲
                                                                                        │
                        worker (same codebase) ── polls releases / outbox / media ──────┤
                          │ builds apps/web from a content snapshot                     │
                          ▼                                                             │
                 RELEASES_DIR/releases/<key>/  ──  RELEASES_DIR/current (symlink)       │
                                                        │                               │
  visitor ── soltexglobal.co (nginx) ── static files ◄──┘                               │
                 │  unknown path → @lookup → API /internal/v1/redirect (loopback) ──────┤
                 │  POST /api/v1/public/leads → API ────────────────────────────────────┘
  admin user ── preview origin (PREVIEW_ORIGIN) ── preview server ── releases/<key> (granted only)
```

| Process | Entry | Listens | Does |
|---|---|---|---|
| API | `npm run start -w @soltex/api` | `API_HOST` (default `127.0.0.1`):`API_PORT` (3100) | `/api/v1/*` for the admin (182 documented operations), the public lead endpoint, the hidden nginx redirect lookup |
| Worker | `npm run worker -w @soltex/api` | — | One loop (`workerLoop`). Builds queued releases one at a time (advisory lock `724001`). When idle, makes responsive image copies. Sends one outbox e-mail per tick. Anonymizes due leads hourly. On start, marks stale builds `failed` and reconciles the DB with the `current` symlink |
| Preview server | `npm run preview-server -w @soltex/api` | loopback:`PREVIEW_PORT` (3102) | Serves a built release or preview artifact to the holder of a one-time grant. `noindex`, `no-store`, `robots.txt` Disallow |
| nginx (site host) | `deploy/nginx/soltexglobal.conf` | 443 | Serves `/srv/soltex/current`, `/media/originals/`, `/media/variants/`. Proxies only `POST /api/v1/public/leads` and the `@lookup` fallback to the API |

The admin host's and preview host's nginx blocks are **not in the repository yet**. [`deployment.md`](deployment.md) lists them under "Still to set on the server (Phase N)".

---

## 4. Data flow

### 4.1 Editing → publishing

1. **Edit.** The admin calls `/api/v1/content/*` and `/api/v1/content/*/translations/*`, which write the entity tables in PostgreSQL. Every change writes a `content_revisions` row. Optimistic locking uses `version` + `If-Match`.
2. **Mark for publication.** `…/{id}/publish` / `unpublish` switch the working copy between `draft` and `published`. The live site does not change yet.
3. **Create a release.** `POST /api/v1/releases` exports the store, keeps published records only, stores an immutable `content_snapshots` row and queues a `releases` row (`queued`).
4. **Build (worker).** The worker claims the oldest queued release. It runs the existing `apps/web` build (content validation → `vite build` → prerender → `validate-site`) in `RELEASES_DIR/build/<key>/` with `CONTENT_SOURCE=file` and a minimal environment (no DB URL, no keys). It then validates the artifact: required files, one page per published routable record × 6 locales, secret scan, page-count drift. The artifact is stored read-only in `RELEASES_DIR/releases/<key>/` with `release.json`, and the release becomes `ready`.
5. **Preview (optional).** `POST /api/v1/releases/{id}/preview` issues a one-time token for the preview origin.
6. **Activate.** `POST /api/v1/releases/{id}/activate` atomically replaces the `current` symlink (rename). The previous release becomes `retired` and can be rolled back without a rebuild (`…/rollback`, `system.rollback` + step-up).

States and rules: [`admin-publishing.md`](admin-publishing.md).

### 4.2 What the public site needs at runtime

| Need | Served by | When the API/DB is down |
|---|---|---|
| Pages, assets, `/images`, `/videos` | Static files of `current` | Unaffected |
| `/media/originals/…`, `/media/variants/…` | nginx from `MEDIA_DIR` (outside releases) | Unaffected |
| Old addresses (redirects) | nginx `@lookup` → `GET /internal/v1/redirect` (loopback only, `X-Lookup-Path` header). Rules come from the **active release** snapshot | Real 404 with the localized 404 page (never 502) |
| Lead forms | `POST /api/v1/public/leads`. Only active when the release was built with `SITE_LEADS_ENABLED=true`; otherwise the forms use a demo service and send nothing | Form submission fails; pages are unaffected |

### 4.3 Development content flow

Without a database, `apps/web` builds from `apps/web/src/content/seed/*.json` (`CONTENT_SOURCE=seed`, default). `npm run db:import` loads the same seed into PostgreSQL. `npm run db:export` writes it back byte-identically ([`admin-database.md`](admin-database.md) §5).

---

## 5. Hosts and origins

| Host | Config | Default (dev) | Production value (from `.env.example`) |
|---|---|---|---|
| Public site | `PUBLIC_SITE_URL` (API), `VITE_SITE_URL` (build) | `https://soltexglobal.co` | `https://soltexglobal.co` (`www` and `http` → 301 to apex in nginx) |
| Admin SPA + API | `ADMIN_ORIGIN` | `http://localhost:3001` | `https://admin.soltexglobal.co` (same origin, no CORS) |
| Preview | `PREVIEW_ORIGIN` (must differ from `ADMIN_ORIGIN`) | `http://localhost:4176` | `https://preview.soltexglobal.co` |
| API process | `API_HOST`/`API_PORT` | `127.0.0.1:3100` | loopback only, behind nginx |

Routes on each host: [`routes.md`](routes.md).

---

## 6. Security layers (summary)

The full review is [`admin-security-asvs.md`](admin-security-asvs.md) (OWASP ASVS 4.0.3 L2, Phase M-1).

| Layer | Implementation |
|---|---|
| Network | API, worker and preview server bind to loopback. On the site host, nginx exposes only `POST /api/v1/public/leads` (rate-limited 10 r/m, 32 KB). `/internal/v1/redirect` answers only loopback callers |
| Sessions | Server-side sessions in PostgreSQL. Only the SHA-256 of the token is stored. HttpOnly `__Host-` cookie (secure cookies required in production). Idle and absolute expiry |
| Authentication | Argon2id passwords (common-password list), lockout with known-device bypass. Second factor: passkeys (WebAuthn), TOTP (secret AES-256-GCM encrypted) and recovery codes. Step-up for sensitive actions. Temporary initial passwords (migration 0010). Details: [`admin-auth.md`](admin-auth.md) |
| Authorization | 6 code-defined roles × 21 permissions (`packages/core/src/domain/permissions.ts`). Enforced per route (`x-soltex-access` in OpenAPI) and per field (SEO fields need `seo.edit`) |
| CSRF | State-changing admin requests need `x-requested-with: soltex-admin`. Origin checks in `apps/api/src/http/security.ts` |
| Rate limits | Global 600/min per session or IP, plus per-route limits (`apps/api/src/routes/rate-limits.ts`) |
| Data at rest | Lead e-mail, phone, message and notes encrypted per column (AES-256-GCM, `DATA_ENCRYPTION_KEYS`). HMAC blind indexes. IPs only as keyed hashes ([`admin-leads.md`](admin-leads.md)) |
| Database | Three roles. The app role cannot change the schema. Append-only audit log, revisions, snapshots and release events enforced by grants **and** triggers ([`cms-schema.md`](cms-schema.md) §5) |
| Logging | pino with redaction of cookies, authorization, bodies and lead fields. URLs logged without query strings |
| Headers | Site: CSP (`SITE_CSP`, checked by `scripts/check-site-csp.mjs`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options. Admin CSP is defined in `apps/admin/vite.config.ts` (nginx block pending) |
| API docs | `/api/v1/docs/openapi.json` only when `API_DOCS=authenticated` (forced `off` in production) |
| Build isolation | The site build gets no secrets. Artifact validation fails on secret-like strings |

---

## 7. Deployment (summary)

- Production target: a Host.KZ-compatible VPS. Server setup (Phase N) is **not done**.
- The server runs nginx, PostgreSQL 17 with the three roles of `provision.sql`, and three systemd units (API, worker, preview server), with `RELEASES_DIR=/srv/soltex` and `MEDIA_DIR=/srv/soltex/media` on one filesystem.
- Netlify (`netlify.toml`) is a temporary demo of the seed build only.

Full details: [`deployment.md`](deployment.md).

---

## 8. Where to read more

| Topic | Document |
|---|---|
| Approved architecture (source of truth) | [`admin-architecture-approved.md`](admin-architecture-approved.md), [`admin-architecture-review.md`](admin-architecture-review.md) |
| Implementation status per phase | [`admin-architecture-implementation.md`](admin-architecture-implementation.md) |
| Admin ↔ frontend contract (Phase 1) | [`custom-admin-architecture.md`](custom-admin-architecture.md) |
| Database tables, roles, import/export | [`admin-database.md`](admin-database.md), [`cms-schema.md`](cms-schema.md) |
| Content editing API and rules | [`admin-content.md`](admin-content.md) |
| Content entities and fields | [`content-model.md`](content-model.md), [`content-inventory.md`](content-inventory.md) |
| Translations workflow | [`admin-translations.md`](admin-translations.md), [`i18n-architecture.md`](i18n-architecture.md), [`i18n-terminology.md`](i18n-terminology.md) |
| Revisions, releases, preview, rollback | [`admin-publishing.md`](admin-publishing.md) |
| SEO checks, slugs, redirects | [`admin-seo.md`](admin-seo.md) |
| Media library | [`admin-media.md`](admin-media.md) |
| Leads | [`admin-leads.md`](admin-leads.md) |
| Authentication, MFA, sessions | [`admin-auth.md`](admin-auth.md) |
| Admin UI conventions | [`admin-ui.md`](admin-ui.md) |
| Security review | [`admin-security-asvs.md`](admin-security-asvs.md) |
| Public, admin and API routes | [`routes.md`](routes.md) |
| Hosting, nginx, headers | [`deployment.md`](deployment.md) |
| Frontend motion / design | [`motion-system.md`](motion-system.md), [`design-v1-implementation.md`](design-v1-implementation.md) |
