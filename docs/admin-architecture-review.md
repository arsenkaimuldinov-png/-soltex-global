# Soltex Global: CMS / Admin + Backend Architecture Review

**Status:** architecture review. Nothing has been implemented. Implementation starts only after this document is approved.
**Date:** 2026-10-02
**Code base:** `c685d32` plus the uncommitted Phase 1 work (content layer, prerender, validators).
**Related documents:** `docs/content-inventory.md`, `docs/custom-admin-architecture.md`, `docs/deployment.md`, `docs/decisions-phase1.md`, `docs/phase-1-baseline.md`.

---

## 0. Summary and key decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Modular monolith**: one Node.js/TypeScript process (API + background jobs) plus PostgreSQL plus a separate admin SPA. The public site stays **static** (prerender), rebuilt automatically on publish | Simple, fast, cheap to run, survives API outages, best SEO |
| 2 | **The public site does not call the API at render time.** Publish → build job (~26 s on the current content) → atomic swap of the `dist` release | Preserves current SEO, Core Web Vitals and URLs; API outage ≠ site outage |
| 3 | **PostgreSQL 17+** with normalized tables, entity + `*_translations`, FK and unique constraints. JSONB only for ordered text lists inside a translation and for revisions | Reliability, simple backups, no SaaS dependency |
| 4 | **Fastify 5 + Zod + Drizzle ORM**; OpenAPI generated from Zod; **pg-boss** for jobs (in Postgres). **No Redis, no message broker, no search cluster, no GraphQL** | Minimal set of mature parts |
| 5 | **Own session-based auth**: server-side sessions in Postgres, httpOnly cookie, Argon2id, TOTP 2FA (mandatory for Owner/Admin), throttling | No tokens in localStorage, no auth SaaS |
| 6 | **Roles and permissions are defined in code** (6 roles, granular permissions). No custom-role UI in v1 | Safer and simpler, while still granular |
| 7 | **Every save creates a revision** (full JSONB snapshot); restore = new revision. **Published version ≠ working copy**: editing a published page does not change the site until Publish | Predictability for the client, change history |
| 8 | **Preview = the same frontend build** in preview mode on `preview.` with a short-lived signed token; draft content is never part of the public build | Matches production 1:1, no draft leaks |
| 9 | **Redirects are dynamic.** nginx serves static files; unknown URLs → Node fallback, which checks the `redirects` table → 301/302, otherwise a real 404 | No nginx reload, slug change → redirect immediately |
| 10 | **Host.KZ: a VPS / cloud server is required.** Shared hosting does not fit (no SSH, no Node.js, PostgreSQL 9.2 on PS.kz shared hosting). **Which provider "Host.KZ" means must be confirmed** (see §S) | Researched, not assumed |
| 11 | **The admin is in Russian**, light, table-based, with ⌘K search, sticky action bar and an SEO block with real checks. **No page builder, no form builder** | UX > features |
| 12 | **Rich text** (only where it is really needed: legal pages, long descriptions in the future) is stored as **structured JSON (ProseMirror/TipTap) with a whitelist**, never as raw HTML | XSS is impossible by construction |

### Where I disagree with the brief (and why)

1. **"Each language has its own slug."** The model supports it (the slug lives in the translation). **But I recommend keeping slugs identical across languages for now**, exactly as on the current site:
   - Phase 1 explicitly fixed "no URL changes".
   - Cyrillic, Chinese and Arabic slugs become percent-encoded URLs.
   - The language switcher and hreflang get more complex.

   Enabling localized slugs is a separate small task (route resolution by `entity_id`), done once there is an SEO need. The admin will show the slug field per language but lock it (shared slug) until the feature is enabled.
2. **"priority / changefreq" in the sitemap.** Google ignores them. I will not implement them; we will output only `lastmod` (which matters).
3. **Free-form "canonical" field.** Canonical is computed automatically (self-canonical; for untranslated content → EN). A manual override only for the SEO role, validated (target must exist, be published, and must not be a redirect or noindex). A free-form text field is the most common source of SEO disasters.
4. **"Languages" as an admin section.** The set of languages is system configuration (code, RTL, fonts, routing). The admin gets a **"Переводы" (Translations)** section instead: a queue of missing, outdated and draft translations across all content.
5. **UI strings (buttons, labels, 404) do not go into the CMS.** They are part of the interface and change together with the code (stable keys, `src/i18n/ui/*.json`). Exception for the future: a "translator" role could edit them through a separate screen without the ability to add keys. Not in v1.
6. **"Schedule publish"** is cheap with pg-boss, but it is not a must-have. It goes to a late phase (J), behind publish/preview.
7. **"Review" workflow.** The `in_review` status is in the data model from day one, but the v1 UI is "Черновик → Опубликовано" (Draft → Published). Enable it when there is more than one approver on the team.
8. **SEO priority in the sitemap, Twitter card, OG title/description.** OG and Twitter are generated automatically from SEO fields with optional overrides. Twitter: always `summary_large_image`; no separate field is needed.
9. **Lead attachments.** Not in v1: file security, personal data and storage costs, and the current forms have no such field (the brief forbids changing forms).

---

## Content

- A. [Recommended architecture](#a-recommended-architecture)
- B. [Technology stack](#b-technology-stack)
- C. [Database model](#c-database-model)
- D. [API architecture](#d-api-architecture)
- E. [Authentication](#e-authentication)
- F. [Authorization / RBAC](#f-authorization--rbac)
- G. [Content model](#g-content-model)
- H. [Translation model](#h-translation-model)
- I. [Media model](#i-media-model)
- J. [SEO model](#j-seo-model)
- K. [Leads model](#k-leads-model)
- L. [Publishing model](#l-publishing-model)
- M. [Revision model](#m-revision-model)
- N. [Preview architecture](#n-preview-architecture)
- O. [Redirect architecture](#o-redirect-architecture)
- P. [Sitemap / hreflang / canonical](#p-sitemap--hreflang--canonical)
- Q. [Security architecture](#q-security-architecture)
- R. [Backup strategy](#r-backup-strategy)
- S. [Deployment for Host.KZ](#s-deployment-for-hostkz)
- T. [Development workflow](#t-development-workflow)
- U. [Testing strategy](#u-testing-strategy)
- V. [Migration from the current frontend](#v-migration-from-the-current-frontend)
- W. [Risks and mitigations](#w-risks-and-mitigations)
- X. [Admin information architecture and UX](#x-admin-information-architecture-and-ux)
- Y. [Implementation phases and estimates](#y-implementation-phases-and-estimates)
- Z. [What we are NOT building yet](#z-what-we-are-not-building-yet)

---

## Inventory of what exists today (analysis result)

| Area | State after Phase 1 | Conclusion for the CMS |
|---|---|---|
| Entities | Page (11 pages + 3 detail-page templates, 203 text slots), Project ×8, Technology ×6, Product ×6, EpcmStage ×8, Patent ×6 (4 home + 2 registry), Video ×2, Media ×24, GlobalSettings (contacts, 4 offices, 5 metrics, HQ), Redirect ×0 | Model is ready (`src/content/types.ts`), maps 1:1 to tables |
| Relations | By stable ID: Project→Technology; Technology→Projects[]; Product→Technology, Project; all→Media | FK + junction tables |
| Translations | Field level `{en,ru,zh,tr,ar,es}` + `translationStatus` per entity with source hash | Move to `entity_translations` (1 row per language) |
| UI strings | 209 keys `src/i18n/ui/*.json`, typed | **Stay in code** |
| Hardcoded content | None left in rendered components (architecture guard in the build) | — |
| SEO | Templates in `src/i18n/seo.ts`, per-entity overrides (`seo`), prerender of canonical/hreflang/sitemap, `validate-site.ts` | Same functions reused for the SEO checker in the admin |
| Forms | 3 forms (CTA: name+phone; modal: name+phone+topic; contact: name, phone, email, company, message) → `LeadSubmissionService` (simulated) | HTTP implementation + attribution |
| Inquiry topics | Language-independent descriptors (`topics.ts`) | Lead stores the resolved text + the descriptor |
| Media | `/public/images/*` (4.4 MB), 2 MP4s (77 + 56 MB) in git, `media.json` with dimensions | Import "as is", URLs unchanged |
| Build | content → vite → prerender (174 pages + 6×404) → validate: **~26 s** | On-publish rebuild is realistic |
| Hosting | Static, no SPA fallback, real 404s; nginx/Apache rules described | Add API + fallback for redirects |

---

## A. Recommended architecture

```
                    ┌────────────────────────── VPS (Host.KZ) ──────────────────────────┐
 Visitor ──HTTPS──► │ nginx ── static files: /srv/soltex/web/current (prerendered dist) │
                    │   │  ├─ /api/v1/public/*  (lead form, redirect fallback) ──┐      │
                    │   │  └─ unknown URL → @fallback ─────────────────────────────┤      │
                    │   │                                                       ▼      │
 Editor ──HTTPS──►  │   ├─ admin.soltexglobal.co → admin SPA (static)   Node.js API     │
                    │   │                         /api/v1/* ───────────► (Fastify,      │
                    │   └─ preview.soltexglobal.co → preview build       modular        │
                    │                             (same frontend)        monolith)      │
                    │                                                    │  │  │        │
                    │                      PostgreSQL ◄──────────────────┘  │  │        │
                    │                      /srv/soltex/media (files) ◄──────┘  │        │
                    │                      job: site build → releases/<ts> ◄───┘        │
                    └───────────────────────────────────────────────────────────────────┘
                              │ nightly encrypted backups (DB + media) → off-site storage
```

**API modules** (folders inside one application, not services):
`auth`, `users`, `audit`, `content` (pages, projects, technologies, products, epcm, patents, videos, settings), `translations`, `media`, `seo` (checker, redirects, sitemap preview), `leads`, `publishing` (revisions, publish, builds, preview tokens), `search`, `system` (health, backup status).

**Repository: minimal npm-workspaces monorepo** (no Nx/Turborepo):

```
apps/web     ← current site (moved with git mv, unchanged)
apps/admin   ← React 19 + Vite admin
apps/api     ← Fastify + Drizzle + pg-boss
packages/core← shared code: locales, domain types, Zod schemas, slug/SEO rules,
               normalize (moved from src/content), page-slot registry
```

Why a monorepo: the admin, API and site build must use **the same** types, validation and SEO rules. Copying them would guarantee they drift apart.

---

## B. Technology stack

| Layer | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Runtime | **Node.js 24 LTS**, TypeScript strict | Bun, Deno | Already in use (build, prerender); predictable LTS; easy to hire for |
| HTTP | **Fastify 5** (+ `@fastify/helmet`, `cookie`, `rate-limit`, `multipart`, `static`) | Express 5, NestJS, Hono | Fast, built-in schema validation and pino logging, mature plugins; NestJS is heavy for this size |
| Validation | **Zod** (shared between admin, API and build) → OpenAPI via `fastify-type-provider-zod` | TypeBox, Valibot | One source of truth; the content layer is already TS-typed |
| DB | **PostgreSQL 17+** | MySQL/MariaDB | Better JSONB, FTS, trigram, constraints, transactional DDL; PS.kz also offers managed PostgreSQL |
| ORM / queries | **Drizzle ORM** + drizzle-kit (SQL migrations, reviewed and committed) | Prisma, Kysely, TypeORM | SQL-first, light runtime, no codegen engine; transparent SQL. Kysely is a valid alternative |
| Jobs | **pg-boss** (queue in Postgres) | BullMQ+Redis, cron | No Redis; covers rebuilds, image processing, e-mail and scheduling |
| Auth | **Own implementation** of sessions (Postgres) + `@node-rs/argon2` + `otplib` (TOTP) | Lucia (no longer maintained as a library), Auth.js, Keycloak | Small, auditable code; no external IdP |
| Images | **sharp** (libvips) | ImageMagick | Already in the project; AVIF/WebP, resize, EXIF stripping |
| File type detection | `file-type` (magic bytes) | by extension | Upload security |
| E-mail | `nodemailer` over SMTP (provider to be decided) | e-mail API services | No lock-in |
| Search (⌘K) | **PostgreSQL FTS + pg_trgm** | Meilisearch, Elasticsearch | Content volume is tiny; one more service is not justified |
| Cache | None in v1 (static site already cached by nginx) | Redis | YAGNI |
| Logs | **pino** JSON → journald/logrotate | ELK | Minimalism |
| Errors | Structured logs + optional Sentry or self-hosted GlitchTip | — | Decide at deployment |
| Admin UI | **React 19 + Vite + Tailwind 4** (same stack as the site), React Router, **TanStack Query**, **TanStack Table**, **react-hook-form + Zod**, **Radix UI** primitives (accessibility), **TipTap** (restricted schema) | Next.js, Refine, React-Admin | One stack for the team; Radix provides WCAG-correct dialogs, menus and focus; React-Admin and Refine impose their own UX |
| Tests | **Vitest**, API integration against real Postgres, **Playwright** (admin E2E + existing site regression suite) | Jest, Cypress | Fast, a single runner |
| CI | GitHub Actions (tests, build, artifacts) | — | Repository is already on GitHub |
| Process | systemd units (api, worker) | PM2, Docker | Fewer layers on a single VPS; Docker optional |

---

## C. Database model

Principles:
- UUIDv7 primary keys for new records.
- Content entities also keep the **stable text ID** (`key`, e.g. `project-solbar-israel`, unique, immutable). Phase 1 IDs are preserved.
- Every table has `created_at/updated_at/created_by/updated_by`.
- Content entities additionally have `status`, `published_at`, `archived_at`, `version` (optimistic locking) and `source_locale`.

### Core tables (simplified; exact DDL in `docs/admin-database.md` during implementation)

```
users(id, email UNIQUE, name, password_hash, role, totp_secret_enc, totp_enabled,
      status[active|disabled], last_login_at, failed_logins, locked_until, …)
sessions(id_hash PK, user_id FK, created_at, last_seen_at, expires_at, ip, user_agent, mfa_passed)
password_resets(token_hash PK, user_id, expires_at, used_at)
audit_events(id, at, actor_id, action, entity_type, entity_key, revision_id, summary, diff JSONB, ip, ua)   -- append-only

languages(code PK, name, dir, is_default, enabled, position)          -- 6 rows, from config

-- the same pattern for every content type:
projects(id, key UNIQUE, status, source_locale, position, category_number, image_id FK media,
         image_position, related_technology_id FK technologies, published_revision_id FK,
         published_at, archived_at, version, timestamps…)
project_translations(project_id FK, locale FK, slug, title, category, country, years, capacity,
         type, overview, technology_summary, scope JSONB(string[]), results JSONB(string[]),
         specs JSONB([{label,value}]),
         seo_title, meta_description, og_title, og_description, og_image_id FK media,
         noindex bool, in_sitemap bool, canonical_override,
         tr_status[draft|in_review|approved], source_hash, approved_at, approved_by,
         PRIMARY KEY(project_id, locale), UNIQUE(locale, slug))
project_gallery(project_id, media_id, position)
technology_projects(technology_id, project_id, position)               -- junction tables with FKs

technologies / technology_translations   (+ patent_info, principles JSONB, …)
products / product_translations           (+ related_technology_id, related_project_id)
epcm_stages / epcm_stage_translations     (number, position, image_id; deliverables JSONB)
patents / patent_translations             (placements text[], patent_no, legal_status, …)
videos / video_translations               (video_media_id, poster_media_id)
pages / page_translations                 (key: home|company|…; copy JSONB {slot: text};
                                           lists JSONB; header fields; SEO fields)
page_media(page_id, slot, media_id)
settings (single row) / settings_translations; offices / office_translations;
metrics / metric_translations

media(id, key UNIQUE, kind, original_filename, storage_path, public_path (legacy URL),
      mime, bytes, width, height, sha256, variants JSONB, uploaded_by, timestamps)
media_translations(media_id, locale, alt, title, caption)

revisions(id, entity_type, entity_id, number, data JSONB (full snapshot incl. translations),
          created_at, created_by, kind[save|publish|restore|import], note)
site_builds(id, status, trigger, started_at, finished_at, release, log, error)
redirects(id, from_path UNIQUE, to_path, status_code[301|302], source[manual|slug_change|import],
          hits, last_hit_at, timestamps, created_by)
seo_issues(id, entity_type, entity_id, locale, code, severity, message, detected_at)  -- materialized

leads(id, reference UNIQUE, status, form_type, locale, page_path, topic_text, topic_ref JSONB,
      name, company, email, phone, country, message, consent bool, consent_version, consent_at,
      attribution JSONB {first:{…}, last:{…}}, gclid, fbclid, landing_page, referrer,
      ip_hash, user_agent, spam_score, spam_reasons text[], assigned_to FK users,
      notified_at, created_at, updated_at, deleted_at)
lead_events(id, lead_id, at, actor_id, type[status|note|assign], data JSONB)
```

**Indexes and constraints:**
- `UNIQUE(locale, slug)` per type;
- FKs `ON DELETE RESTRICT` for content relations (a referenced item cannot be deleted silently);
- `pg_trgm` GIN on `title` / lead `name`, `company` and `email` for search;
- partial indexes on `status`;
- `CHECK` on enum values.

**JSONB is used deliberately for:**
1. Ordered text lists inside a translation (`scope`, `results`, `deliverables`). Normalizing every line into its own table brings no value.
2. Page slots (`copy`): the slot set is **defined in code** (registry with a Zod schema), the DB stores only values.
3. Revision snapshots.
4. Attribution.

Everything else is columns.

---

## D. API architecture

- **REST + JSON, versioned `/api/v1`.** Resource-oriented, predictable for an admin SPA. GraphQL and tRPC add no value here.
- **Contracts:** Zod schemas → automatic validation → **OpenAPI 3.1** (`/api/v1/docs`, available to authenticated admins only) → typed client for the admin.
- **Errors:** RFC 9457 `application/problem+json`, with `code` and field-level errors (shown in Russian in the admin).
- **Lists:** `?page=&limit=` (≤100), `?sort=updated_at:desc`, `?status=`, `?locale=`, `?q=`; response is `{items, page, limit, total}`.
- **Concurrent edits:** `If-Match: <version>` → `409 Conflict` ("Материал изменён другим пользователем").
- **Rate limits:** login 5/min/IP + 10/hour/account; public lead endpoint 5/10 min/IP; admin API 300/min/session.

| Group | Endpoints (main) |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/2fa`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password-reset/{request,confirm}` |
| Content | `GET/POST /content/{type}`, `GET/PATCH /content/{type}/{id}`, `POST …/{id}/publish`, `…/unpublish`, `…/archive`, `…/restore`, `GET …/{id}/revisions`, `POST …/{id}/revisions/{rev}/restore`, `GET …/{id}/usages` |
| Pages | `GET /pages`, `GET/PATCH /pages/{key}` (fixed set, no POST/DELETE) |
| Translations | `GET /translations/queue?status=missing\|outdated\|draft`, `PATCH /content/{type}/{id}/translations/{locale}` |
| Media | `POST /media` (multipart), `GET /media?q=&kind=`, `PATCH /media/{id}`, `POST /media/{id}/replace`, `DELETE /media/{id}` (blocked if used) |
| SEO | `GET /seo/issues`, `POST /seo/check/{type}/{id}` (draft check), `GET/POST/PATCH/DELETE /redirects`, `GET /seo/sitemap-preview` |
| Leads | `GET /leads`, `GET/PATCH /leads/{id}`, `POST /leads/{id}/notes`, `GET /leads/export.csv` |
| Publishing | `GET /builds`, `POST /builds` (manual rebuild), `POST /preview/tokens` |
| Search | `GET /search?q=` (⌘K) |
| Admin | `GET/POST/PATCH /users`, `GET /audit` |
| System | `GET /health` (public, no details), `GET /system/status` (admin: DB, disk, last backup, last build) |
| **Public** | `POST /public/leads`, `GET /public/redirect?path=` (internal, nginx fallback), `GET /preview/content?locale=&token=` |

---

## E. Authentication

- **Sessions:** a random 256-bit token; the DB stores only its SHA-256. Cookie `__Host-soltex_session`: `HttpOnly; Secure; SameSite=Strict; Path=/`.
  - Idle timeout 8 hours, absolute timeout 7 days.
  - The session ID is rotated on login and on privilege changes.
  - "Log out of all devices"; a password change revokes all sessions.
- **Passwords:** Argon2id (OWASP parameters), minimum 12 characters, plus a check against a local list of the most common passwords. Passwords live nowhere in code; the first Owner is created with a CLI command (`api user:create --role owner`).
- **2FA (TOTP):**
  - mandatory for Owner and Admin, optional for others;
  - recovery codes (hashed);
  - the TOTP secret is encrypted with AES-256-GCM using a key from env.
- **Brute force:** throttling by IP and by account, temporary lockout with exponential backoff, generic error messages (no user enumeration), every attempt goes to the audit log.
- **CSRF:** SameSite=Strict, plus an `Origin`/`Sec-Fetch-Site` check, plus a mandatory `X-Requested-With`-style header for mutating requests. The admin and API live on one origin (`admin.soltexglobal.co/api`), so CORS stays off.
- **Password reset:** single-use token, 30 minutes, stored as a hash; the same response whether or not the e-mail exists.
- **No JWT and nothing in localStorage.**

---

## F. Authorization / RBAC

Permissions are strings in code (`content.edit`, `content.publish`, `seo.edit`, `redirects.manage`, `media.upload`, `media.delete`, `leads.view`, `leads.manage`, `users.manage`, `settings.edit`, `audit.view`, `system.view`, `builds.trigger`). Roles are fixed permission sets.

| Role (in the UI) | Content (edit / publish) | SEO and redirects | Media | Leads | Settings | Users, audit |
|---|---|---|---|---|---|---|
| **Владелец** (Owner) | ✓ / ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (only the Owner manages Owners) |
| **Администратор** (Admin) | ✓ / ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (cannot touch Owners) |
| **Контент-менеджер** (Content manager) | ✓ / ✓ | view, edit SEO texts | ✓ | — | view | — |
| **Редактор** (Editor) | ✓ / — (saves drafts, requests publication) | view | upload | — | — | — |
| **SEO-специалист** (SEO specialist) | view; edits **SEO fields and slugs** / publishes **SEO changes** | ✓ | view, alt texts | — | — | — |
| **Маркетолог** (Marketer) | view | view | view | ✓ (incl. attribution, export) | — | — |

- Enforcement is on the server in every handler (`requirePermission`), plus **field-level** rules on PATCH: an SEO specialist may change only `seo_*`, `slug`, `noindex`, `in_sitemap` and alt texts.
- The UI hides what is not allowed, but security does not rely on that.
- Tests cover the matrix "role × endpoint", generated automatically from the permission map.
- A "Переводчик" (Translator) role, editing only translations, can be added later without changing the architecture.

---

## G. Content model

**Content (CMS)** vs **system (code)**:

| CMS | Code |
|---|---|
| Texts of pages (slots), projects, technologies, products, EPCM, patents, videos | Components, layout, Tailwind, motion, icons |
| Images and videos (references), alt texts | Route patterns (`/projects/:slug`), list of languages, RTL |
| SEO fields, slugs, redirects, sitemap inclusion | SEO templates (title/description defaults), canonical/hreflang logic |
| Contacts, offices, metrics, footer, legal texts | UI strings (buttons, labels, forms, 404) |
| Order of items, publication, archiving | Page set and slot set (registry), form fields |

- Fixed pages (`home`, `company`, … and the 3 detail-page templates) are records with **slots defined in code**. The admin shows a form generated from the slot registry: label in Russian, hint, length limit, single-line or multi-line field.
- The admin **cannot create a new page with arbitrary blocks.** That is deliberate (no page builder).
- **Statuses:** `draft` · `published` · `archived`. The derived state "published with unpublished changes" is shown as "Есть неопубликованные изменения". `in_review` is reserved.
- **Deletion:** "Archive" by default (+ redirect to the listing page). "Delete permanently" is Admin+ only, with the record name typed as confirmation, and only if nothing references it (FK RESTRICT + `usages` check: "Эта технология используется в 4 проектах").

---

## H. Translation model

- `entity` + `entity_translations(locale)`: one record, up to 6 translation rows. No duplication of the entity itself.
- **The source language is configurable** (`source_locale` per entity, EN for the current content). The architecture does not assume EN is always the source.
- **Translation status per language:** `draft` → (`in_review`) → `approved`.
  - On approval, the **hash of the source-language fields** is stored. When the source changes, the translation becomes **"Устарел"** (outdated): flagged and queued in "Переводы", while still shown on the site (better than English) until updated.
  - A language is published only if its translation is `approved`. Otherwise the whole entity falls back to the source language (canonical → source URL, excluded from hreflang and the sitemap for that language). This is the Phase 1 logic, unchanged.
- **Translation editor:** side-by-side "исходный язык | целевой язык", field by field, with "Скопировать исходный" (copy source) and character counters.
- For Arabic, the field uses `dir="rtl"` and an RTL preview.
- Placeholders `{name}` and `\n` are validated (same set as in the source).
- UI strings stay in code (see the "Where I disagree" list in §0).

---

## I. Media model

- **Storage:** VPS disk `/srv/soltex/media/originals/<yyyy>/<uuid>.<ext>` plus `/variants/…`, behind a `StorageDriver` interface (`local` now, `s3` later, e.g. PS.kz Object Storage). Public URL via nginx `/media/…`.
- **Existing files are imported "as is" with their current URLs** (`/images/...`, `/videos/...`, `public_path`). No re-encoding, no URL changes. The two MP4s are not re-uploaded.
- **Upload pipeline:**
  1. Size limit: images 20 MB, PDF 20 MB, video 200 MB (admin only).
  2. Type is determined by **magic bytes**, against an allowlist: JPEG, PNG, WebP, AVIF, MP4, PDF.
  3. **SVG is forbidden in v1** (XSS vector).
  4. The file is renamed to a UUID; the original name is kept only in the DB.
  5. sharp: auto-rotate, **EXIF/GPS stripped**, variants generated (AVIF + WebP at 480/960/1600/2400 px, JPEG fallback) by a background job.
  6. Dimensions, sha256 (duplicate detection) and size are recorded.
- **Warnings:** "Изображение > 2 МБ", "ширина < 1600 px для hero", "нет alt-текста".
- **Usage references:** computed by query (FKs plus slots), shown as "Используется: Проект Solbar Israel, Страница О компании". Deletion is impossible while the file is used. "Заменить" (replace) keeps the ID and all references.
- **Responsive images on the site:** the frontend media abstraction (Phase 1) gets `srcset` from `variants`. This is a separate, verifiable step, done without changing the look.
- **Documents (PDF):** served with `Content-Disposition` and `X-Content-Type-Options: nosniff`.

---

## J. SEO model

| Field (per translation) | Default / rule |
|---|---|
| `seo_title` | default `"{H1} | Soltex Global"`; counter, recommended length ≤ 60 |
| `meta_description` | default: first sentences of the description; counter 70–160 |
| `slug` | lowercase Latin, digits and hyphens; unique per (type, language); change → redirect dialog |
| canonical | **automatic**; `canonical_override` only for SEO role / Admin, validated |
| `noindex` | SEO role only; automatically removes the page from the sitemap and hreflang |
| `in_sitemap` | true; editable for edge cases |
| `og_title` / `og_description` / `og_image` | default = SEO title/description/hero image; override optional |
| Twitter | `summary_large_image` automatically from OG |
| hreflang | **always automatic** from published translations, never edited by hand |
| lastmod | from `published_at` of the language version |

**SEO block in the editor:**
- a realistic snippet (title / URL / description at real truncation lengths);
- counters;
- check list (✓/⚠/✗) linking to the field;
- translation status per language;
- the **"Изменить slug"** button opens a dialog: old/new URL, "будет создан 301-редирект", list of all 6 language URLs.

**SEO checker:** one library in `packages/core`, shared by admin, API and build.

| Code | Severity | Check |
|---|---|---|
| `missing_title` / `missing_description` | ERROR | empty SEO title / description |
| `title_length` / `description_length` | WARNING | outside the recommended range |
| `duplicate_title` / `duplicate_description` | WARNING | same as on another page of the same language |
| `duplicate_slug` | ERROR | (unique constraint) |
| `missing_translation` / `outdated_translation` | WARNING | — |
| `missing_og_image` | WARNING | — |
| `image_too_large`, `missing_alt` | WARNING | — |
| `broken_internal_link` | ERROR | links in slots/rich text, `href` of cards, references to unpublished items |
| `noindex_in_sitemap`, `canonical_conflict` | ERROR | — |
| `hreflang_conflict` | ERROR | non-reciprocal or pointing to noindex |
| `redirect_loop` / `redirect_chain` | ERROR | — |
| `orphan_page` | WARNING | no internal links point to it |

- Checks run on every save (for the draft) and after every build (for the site, `validate-site.ts`). Results go into `seo_issues`.
- Every issue has a severity, a description in Russian, the affected entity and language, and a **"Исправить" (Fix)** button that opens the editor on the right field.
- **Publishing with SEO ERRORs is blocked**; WARNINGs are allowed.

---

## K. Leads model

- **Frontend:** `HttpLeadService` replaces `simulatedLeadService`. Form fields stay unchanged.
- **Attribution:** a small script on the site records:
  - **first-touch** (first visit: `utm_*`, `gclid`, `fbclid`, referrer, landing page, date) in localStorage for 90 days;
  - **last-touch** in sessionStorage.

  Both are sent with the lead. This is first-party data with no third-party cookies. The privacy policy must mention it; the policy text is still missing (legal pages are drafts). **Legal review is required**, especially for visitors from the EU.
- **Server (`POST /api/v1/public/leads`):**
  1. Zod validation; length limits; payload ≤ 20 KB.
  2. Spam checks: honeypot field, minimum fill time (≥ 3 s), rate limit by IP hash, link/keyword heuristics.
  3. Then: `spam_score`, `status = spam` or `new`.
  4. The lead is saved, **then** an e-mail goes to the managers (address list in settings).
  5. If e-mail fails, the lead stays in the DB, is flagged "уведомление не отправлено" and retried by a job.
  6. The response carries the reference `SOL-2026-000123`.
- **CAPTCHA** (e.g. Cloudflare Turnstile) only if spam gets through: it is an external service and affects UX.
- **Statuses (UI):** Новый, В работе, Квалифицирован, Успешно, Отказ, Спам. Plus assignee, notes and a history (`lead_events`).
- **Personal data:** IP is stored only as a salted hash. Retention period (e.g. 24 months) to be agreed. CSV export for Marketer/Admin only, recorded in the audit log. Lead deletion = soft delete, then anonymized by a job.
- **Attachments:** not in v1 (see "Where I disagree" in §0).

---

## L. Publishing model

1. **Сохранить черновик** (Save draft): saves the working copy (normalized tables) and creates a revision `save`. **The site does not change.**
2. **Предпросмотр** (Preview): see N.
3. **Опубликовать** (Publish):
   1. validation (Zod, relations: referenced items must be published; SEO ERRORs block);
   2. revision `publish`, with `published_revision_id` and `published_at` set;
   3. enqueue `site.build`;
   4. confirmation dialog when the change is significant (slug, noindex, unpublishing).
4. **Build job** (debounced ~20 s so that several publications become one build):
   1. export the **published revisions** → `ContentStore`, the same format as the seed;
   2. run the existing pipeline: `build-snapshots` → `vite build` → `prerender` → `validate-site`;
   3. on success, atomically switch the symlink `web/current` → `releases/<ts>`; keep 10 releases;
   4. on failure, the site stays on the previous release and the admin shows the error ("Сайт не обновлён: …").

   Time on current content: about 26 s.
5. **Снять с публикации** (Unpublish): the page leaves the build; the system offers a 301 to the listing page.
6. **Rollback of the whole site:** "Откатить сайт к предыдущей версии" (Admin), a symlink switch in under 1 s.

**Why not SSR / ISR:**
- Static output delivers maximum speed and SEO.
- An API outage does not affect the site.
- No server rendering means less attack surface.
- The current prerender and validators keep working.

---

## M. Revision model

- Every save and publish writes a full JSONB snapshot of the entity, including all translations and relations.
- **Diff** is computed when viewing ("Мощность: 500 t → 800 t"), field by field and language by language.
- **Restore** creates a new revision (`kind = restore`) from the old one; history is never rewritten.
- **Retention:** all `publish` revisions forever; `save` revisions 180 days or the last 50 per entity (cleanup job).
- The audit log records the fact of the action; the revision holds the content.

---

## N. Preview architecture

1. The editor clicks "Предпросмотр".
2. The API issues a preview token: HMAC-SHA256 over `{entity, locale, user_id, session_id, exp: 30 min}` with a key from env, bound to the editor's session.
3. A new tab opens `https://preview.soltexglobal.co/<path>?pt=<token>`.
4. `preview.` serves **the same frontend build** with `CONTENT_SOURCE=preview`. The only difference: the language snapshot is not a bundled JSON file but comes from `GET /api/v1/preview/content?locale=…` with the token. The response = published content + the editor's drafts, run through the same `normalize`.
5. Components, CSS, motion and RTL are 100% the same as in production.
6. Draft safety:
   - drafts never enter the public build (the build reads only published revisions);
   - `preview.` sends `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`;
   - an invalid token gives 401;
   - a "ПРЕДПРОСМОТР" banner is shown (preview build only).

---

## O. Redirect architecture

- **The `redirects` table is the source of truth.** Sources: manual, `slug_change` (automatic), `import` (old soltexglobal.co URLs).
- **Serving:** nginx `try_files $uri $uri.html $uri/index.html @fallback;` → `@fallback` proxies to `GET /api/v1/public/redirect?path=`:
  - a redirect is found → `301`/`302 Location`;
  - otherwise the localized `404.html` with **status 404**.

  If the API is down, nginx serves the static 404 (`error_page`). No nginx reload, no generated configs.
- **Slug change:**
  - the dialog shows the URLs in all languages;
  - creating the 301 is enabled by default;
  - existing redirects pointing to the old URL are **rewritten** to the new one (no chains).
- **Validation on save:**
  - loops;
  - chains (collapsed automatically);
  - duplicate `from`;
  - target exists and is published;
  - `from` does not shadow a live page.

  The same checks run in `validate-site.ts` at build time.
- **Hit counter** (async), so the SEO specialist can see which redirects are still in use.

---

## P. Sitemap / hreflang / canonical

All of these are generated at **build** time from published content by the existing `prerender.ts` / `seo.ts`; the admin only shows a preview.

- **Sitemap:** only indexable, canonical, published pages; `lastmod`; hreflang alternates. When pages exceed 50,000, it becomes a sitemap index (not needed in the foreseeable future).
- **hreflang:**
  - a cluster from the entity's languages that are published and approved, plus x-default = the source language;
  - reciprocity is guaranteed because it is computed from a single set;
  - noindex languages are excluded.
- **Canonical:**
  - self by default;
  - a language without an approved translation → canonical to the source language;
  - an override is allowed only to a valid URL.
- **robots.txt:** generated with a link to the sitemap. Staging and preview are fully `Disallow` plus `X-Robots-Tag`.
- **Broken links are prevented by:**
  - relations by ID;
  - automatic redirects on slug change;
  - FK RESTRICT on deletion;
  - the build validator, which fails the build on a broken link (the site stays on the previous release).

---

## Q. Security architecture

**OWASP Top 10 / ASVS level 2 (target):**

| Risk | Measures |
|---|---|
| A01 Broken access control | Server-side checks in every handler, field-level rules, role × endpoint matrix tests, admin on its own subdomain, no IDOR (permission check on every `id`) |
| A02 Crypto | TLS 1.2+ (HSTS), Argon2id, hashed session and reset tokens, encrypted TOTP secrets and backups |
| A03 Injection | Parameterized queries only (Drizzle); `sql.raw` banned by a lint rule; Zod on all input |
| XSS | React escaping; **no `dangerouslySetInnerHTML` with user data**; rich text as ProseMirror JSON with a whitelist (paragraph, h2/h3, lists, bold/italic, link with `https:`/relative URLs only, `rel="noopener"`); strict CSP on the admin and the site (hash for the inline motion script) |
| CSRF | SameSite=Strict + Origin check + custom header |
| A04 Insecure design | Archive instead of delete, confirmations, published version separated from drafts, revisions |
| A05 Misconfiguration | helmet headers, debug and stack traces off in production, `/api/v1/docs` only behind auth, `server_tokens off` |
| A06 Vulnerable components | `npm audit` / Dependabot in CI, pinned versions, monthly updates |
| A07 Auth failures | §E: throttling, 2FA, session rotation |
| A08 Integrity | CI builds artifacts; deploy with checksums; migrations reviewed and committed |
| A09 Logging | audit log (append-only, the DB role has no UPDATE/DELETE on it) plus pino logs; alerts on repeated login failures |
| A10 SSRF | The server makes no requests to user-supplied URLs (no "upload from URL" in v1) |
| Uploads | magic bytes, allowlist, no SVG, UUID names, served from a separate path with `nosniff` and no execution (nginx serves `/media` as static only) |
| Path traversal | Storage keys are generated by the server; incoming paths are never joined with the file system |
| Preview tokens | HMAC, 30 minutes, bound to the session; never written to logs |
| Secrets | `.env` (mode 600) outside the repo, separate per environment; DB user has minimal privileges (app ≠ migrator); nothing secret in Vite env (`VITE_*`); the site validator checks `dist/` |
| Admin surface | `admin.` subdomain; optional IP allowlist in nginx; `noindex`; no links from the site |

---

## R. Backup strategy

| What | How | Retention | Location |
|---|---|---|---|
| PostgreSQL | `pg_dump -Fc` nightly, plus a light **hourly** dump of the `leads` table | daily ×14, weekly ×8, monthly ×12 | encrypted (age/GPG), to off-site storage (e.g. PS.kz Object Storage or another provider) **plus** a local copy for 3 days |
| Media | `restic` incremental snapshots | as above | off-site |
| Configuration | repository (code, nginx/systemd templates) + encrypted copy of `.env` | each change | off-site |
| VPS | provider snapshots (PS.kz VPS: 2 daily + 2 weekly) | provider default | **an extra layer, not the main one** |

- **RPO:** ≤ 1 hour for leads, ≤ 24 hours for content.
- **RTO:** ≤ 4 hours (new VPS + restore by the runbook in `docs/admin-operations.md`).
- **Restore is verified automatically:**
  - weekly, a job restores the latest dump into a temporary database on staging, runs the migration check and a smoke test (record counts, export → build → validate);
  - the result is shown on the admin dashboard ("Последняя проверка восстановления: OK, 2 дня назад").

  A backup without a tested restore does not count.
- **The static site is protected separately:** the last 10 releases are kept, and any release can be rebuilt from the DB or from the seed in the repository.

---

## S. Deployment for Host.KZ

### What was found (research of 2026-10-02)

- **`host.kz` redirects to `ps.kz` (PS Cloud Services).** There is also an unrelated provider, **Hoster.kz**. Confirm which provider and plan the client means.
- **PS.kz shared hosting:**
  - PHP + Plesk, MySQL/MariaDB, **PostgreSQL 9.2**;
  - **no SSH access**; no Node.js runtime listed.

  → **Not suitable** for the recommended architecture (and should not be).
- **PS.kz VPS:**
  - root access, Ubuntu 22.04 / Debian / AlmaLinux;
  - local backups (2 daily + 2 weekly);
  - from about 3,120 ₸ per month.
- **PS.kz also has:** managed DBaaS (PostgreSQL, hourly/monthly billing) and S3-compatible Object Storage; data centers in Almaty, Astana and Tashkent.
- **Hoster.kz:** Cloud VPS from 1 vCPU/1 GB to 8 vCPU/32 GB on NVMe, from about 3,100 ₸ per month; data centers in Almaty, Astana and Karaganda.

### Conclusion and recommendation

> **Production needs a VPS / cloud server, not shared hosting.**

| Environment | Configuration (minimum → recommended) |
|---|---|
| **Production** | VPS **2 vCPU / 4 GB RAM / 60–80 GB NVMe** (the build and sharp need memory), Ubuntu 24.04 LTS (or 22.04), nginx, Node.js 24 LTS (systemd: `soltex-api`, `soltex-worker`), PostgreSQL 17 (on the same VPS, or the provider's managed PostgreSQL if budget allows), media on disk, Let's Encrypt (certbot) |
| **Staging** | Separate small VPS **1–2 vCPU / 2 GB**, its own DB with anonymized copies; `staging.` + `preview-staging.` behind basic auth |
| **Development** | Local (Docker Compose for PostgreSQL only, or a local Postgres) |
| **Off-site backups** | Object storage of the provider **in a different data center** or with a different provider |

**Domains (proposal):**
- `soltexglobal.co` (site + `/api/v1/public/*` on the same origin for forms, no CORS);
- `admin.soltexglobal.co` (admin + API);
- `preview.soltexglobal.co`;
- `staging.soltexglobal.co`.

Questions for the provider (not assumed):
- whether outgoing SMTP is allowed (ports 25/587);
- whether IPv6 is available;
- what DDoS protection is included;
- whether the VPS can be resized without migration;
- whether the managed PostgreSQL is version 16 or 17+.

Netlify stays a demo only until the switchover; after launch the demo is shut down so the internet does not get a duplicate of the site.

---

## T. Development workflow

- Monorepo, `main` is protected, short-lived branches + PRs. CI runs:
  - lint and typecheck;
  - unit and integration tests (Postgres service container);
  - admin and site builds;
  - site regression suite (Phase 1 QA);
  - Playwright E2E.
- **Migrations:** drizzle-kit generates SQL, a person reviews it, the file is committed.
  - They are applied automatically on deploy, before the new version starts.
  - Destructive changes use the expand → migrate → contract pattern.
- **Environments:**
  - `.env.example` documents every variable;
  - production and staging databases are never shared;
  - development data comes from the seed (`npm run db:seed` = Phase 1 seed import).
- **Deploy:** GitHub Actions builds artifacts, rsync over SSH to `releases/<sha>`, migrations, `systemctl reload`, health check, automatic rollback on failure. The first deploys are run manually by the runbook; automation follows.

---

## U. Testing strategy

| Level | What we test |
|---|---|
| Unit (Vitest) | slug rules, SEO checker, normalize/fallback languages, placeholders, permissions, redirect graph (loops/chains), attribution, spam heuristics |
| Integration (API + real Postgres) | CRUD of every entity, translations, publish/unpublish/archive/restore, revisions and restore, optimistic locking, media upload (valid and malicious files: polyglot, SVG, oversized), leads (spam, rate limit), redirects on slug change |
| Auth / RBAC | login/logout, 2FA, lockout, session expiry, reset; **role × endpoint matrix** and field-level rules (SEO specialist cannot change content text) |
| Migrations | applying from scratch, up from the previous version, **round-trip seed → DB → export → deep-equal with the seed** |
| Build / SEO | export → build → `validate-site` (canonical, hreflang, sitemap, noindex, links, 404); Arabic RTL |
| E2E (Playwright) | SEO workflow (edit title/description/slug → preview → publish → URL + redirect on the site); lead from all 3 forms with UTM → appears in the admin with attribution; preview does not leak to the public site; 404 status |
| Regression of the site | the existing Phase 1 suite: 174 pages, text/SEO identical, screenshots, no-JS, motion, language switching, inquiry topics |
| Security | `npm audit`, ZAP baseline scan on staging, manual check against an ASVS checklist before launch |

---

## V. Migration from the current frontend

1. **Phase 1 already prepared the content layer.** `ContentSource` gets a third implementation, `db`; components do not change.
2. **Import:**
   - `src/content/seed/*.json` → DB by stable IDs (idempotent, in a transaction);
   - all 6 languages, translation statuses and media with their `public_path`;
   - the first revision `import`, published.
3. **Equivalence check (automatic, blocks the switchover):**
   - entity counts, texts in all languages, routes, SEO and media match;
   - `export(DB)` is **deep-equal** to the seed;
   - a build from the DB passes the Phase 1 regression suite as **IDENTICAL**;
   - the video files and their URLs are unchanged.
4. **Switchover:** `CONTENT_SOURCE=db` in the production build. The seed stays in git as the fallback / disaster-recovery source.
5. Changes to the site are only adapters:
   - `HttpLeadService` + attribution script;
   - preview mode;
   - `srcset` from media variants (separate visual check).

   Everything else (design, copy, URLs, translations, motion) is untouched.
6. **Before switching DNS:** crawl the current live soltexglobal.co and import old URLs into `redirects`.

---

## W. Risks and mitigations

| Risk | Probability / impact | Mitigation |
|---|---|---|
| "Host.KZ" means a plan without root/Node (shared) | medium / high | Decided now: **a VPS is required**; confirm provider and plan before Phase S |
| Single VPS = single point of failure | medium / medium | Static site + releases, off-site backups, tested restore, RTO 4 h; HA when the business needs it |
| Build on the server (CPU spike, failures) | low / medium | Debounce, separate worker process, timeout, site stays on the previous release |
| Self-written auth has holes | medium / high | Minimal and proven patterns, ASVS checklist, tests, 2FA, no "smart" schemes |
| Editors break layout with long texts | high / medium | Length limits per slot in the registry, warnings, preview |
| SEO regression from slug changes | medium / high | Automatic 301s, no chains, validator, ERRORs block publishing |
| Scope creep ("one more feature") | high / high | Phases with Definition of Done, the "not now" list (§Z) |
| Translation process (6 languages) | high / medium | "Переводы" queue, outdated flags, fallback without mixed languages |
| Data loss during migration | low / critical | Round-trip test + regression suite as a blocking gate |
| Backups made but never checked | medium / critical | Automatic weekly restore with a dashboard status |
| Personal data and UTM without a privacy policy | medium / medium | Legal texts are a blocker before launch of the lead backend |
| Team / bus factor | medium / medium | The `docs/admin-*.md` documents, simple stack, runbooks |

---

## X. Admin information architecture and UX

**Sidebar (Russian):**

```
SOLTEX ADMIN                                  ⌘K Поиск
────────────────────
Обзор                    (dashboard)
Контент
  Страницы               (11 pages + 3 templates)
  Проекты
  Технологии
  Продукты
  EPC / EPCM             (8 stages, reorder)
  Патенты
  Видео
Медиатека
Переводы                 (queue: missing / outdated / drafts)
Заявки                   (leads; counter of new ones)
SEO
  Проблемы               (issues, with filters)
  Перенаправления
  Индексация             (sitemap/hreflang preview, noindex list)
Настройки                (company, contacts, offices, metrics, footer, legal pages, form recipients)
Администрирование
  Пользователи
  Журнал действий
  Система                (builds, backups, health)
```

**Dashboard (every number links to a filtered list):**
- "Новые заявки: 3 (непрочитанных 2)";
- "SEO-ошибки: 0 · предупреждения: 5";
- "Нет перевода RU: 4 материала";
- "Переводы устарели: 2";
- "Черновики: 6 · Есть неопубликованные изменения: 2";
- "Изображения > 2 МБ: 3";
- "Последняя публикация сайта: 10:42, успешно (26 с)";
- "Резервная копия: сегодня 03:00 · проверка восстановления: OK";
- "Недавно изменено" (5 rows).

No decorative charts.

**Editor (one screen per entity):**
- tabs: Основное · Контент · SEO · Медиа · Переводы · История;
- **sticky action bar:** status, "Сохранить черновик" (⌘S), "Предпросмотр", "Опубликовать" / "Снять с публикации", the "…" menu (Archive, Duplicate);
- a language switcher above the fields (EN · RU · ZH · TR · AR · ES with ✓/⚠/✗ indicators).

**Principles:**
- light theme, neutral background, thin borders, dense but readable tables;
- clear statuses (dot + text, not color alone);
- breadcrumbs;
- an empty state with the next step;
- every destructive action is a dialog stating its consequences (usages, redirects);
- unsaved changes → warning when leaving the page.

**Keyboard:**
- ⌘/Ctrl+K: search and commands;
- ⌘/Ctrl+S: save draft (never publish);
- Esc: close a dialog;
- `/`: focus the search field in lists;
- arrows/Enter: navigate results;
- no single-key shortcuts for dangerous actions.

**Accessibility (WCAG 2.2 AA):**
- Radix primitives (focus trap, aria);
- labels on every field;
- errors next to the field and in a summary;
- contrast ≥ 4.5:1;
- visible focus;
- `dir="auto"`/`rtl` in Arabic fields.

**Devices:** desktop/laptop first; tablet fully supported; mobile: viewing leads and basic edits.

---

## Y. Implementation phases and estimates

Estimates are engineer-days for one senior full-stack developer. The ranges reflect the confirmed scope; they are not a commitment.

| Phase | Content | Days | Exit criterion |
|---|---|---|---|
| **A. Foundation** | monorepo (move the site to `apps/web` with git mv, regression IDENTICAL), `packages/core`, CI, `.env` scheme | 4–6 | site regression unchanged |
| **B. Database + import** | schema, migrations, import of seed → DB, export, round-trip test | 7–10 | export ≡ seed, build from DB IDENTICAL |
| **C. API core + auth + RBAC + audit** | Fastify, Zod/OpenAPI, sessions, 2FA, roles, audit log, health | 8–11 | auth/RBAC tests green |
| **D. Admin shell** | layout, navigation, tables, forms, dialogs, ⌘K, login/2FA | 6–8 | basic UX accepted by the client |
| **E. Content management** | editors for pages (slot registry) and 6 collections, relations, usages, archive | 12–16 | CRUD of all entities, E2E |
| **F. Translations** | language tabs, side-by-side, statuses, outdated, queue | 5–7 | — |
| **G. Revisions + publishing + builds** | revisions/diff/restore, publish/unpublish, build job, releases, rollback | 7–9 | publish → site in < 1 min |
| **H. Preview** | tokens, preview mode of the frontend, `preview.` | 4–5 | draft visible in preview, not on the site |
| **I. SEO** | SEO block, snippet, slug dialog, redirects + nginx fallback, issues, dashboard | 8–11 | SEO workflow E2E |
| **J. Media** | upload pipeline, variants, library, replace, usages, srcset on the site | 7–9 | security tests for uploads |
| **K. Leads** | public endpoint, spam, e-mail, attribution, statuses, export | 5–7 | lead from all 3 forms with UTM |
| **L. Dashboard + search polish** | metrics, links to issues | 2–3 | — |
| **M. Security + tests + docs** | ASVS checklist, ZAP, `admin-*.md` documents | 6–8 | — |
| **N. Deployment Host.KZ + backups** | VPS, nginx, systemd, certbot, backups + automatic restore check, runbooks | 5–7 | restore verified |
| **(later) scheduled publishing, Review, Translator role, localized slugs** | — | 2–4 each | — |

**Total: about 86–117 days** (≈ 4–6 months for one developer, ≈ 2.5–3.5 months for two).

**Recommended order:** A → B → C → D → E → G → H → I → F → J → K → L → M → N. Publishing and preview come before SEO and media because they are needed for safe work on real content from the start.

---

## Z. What we are NOT building yet

| Not building | Why |
|---|---|
| Page builder / visual blocks | Breaks the design system; contradicts the brief |
| Form builder | 3 forms with fixed fields; settings (recipients, consent text) are enough |
| Editable roles in the UI | Risky; fixed roles cover the team |
| Review workflow (UI) | One approver; data model ready (`in_review`) |
| Scheduled publishing | Nice to have; cheap later with pg-boss |
| Localized slugs (enabled) | No URL changes; model ready |
| UI strings in the CMS | Interface ≠ content |
| Redis, Elasticsearch, message brokers, microservices, GraphQL, Kubernetes | Volume and load do not need them |
| SSR / ISR | Static output is faster, more reliable and simpler |
| Real-time co-editing | Optimistic locking (409) is enough |
| SVG uploads, "upload from URL" | XSS / SSRF |
| Lead attachments | Security and personal data; no field in the forms |
| CRM integration, webhooks | After the lead process is agreed |
| Analytics inside the admin | GA / Search Console do it better; the admin shows attribution per lead |
| English admin UI | Not needed; strings are kept in one file, so it is possible later |
| AI features | Out of scope |
| HLS video / transcoding | The current MP4s are approved; a separate task |

---

## Open questions for the client (before implementation)

1. **Which provider and plan is "Host.KZ"** (PS.kz / Hoster.kz / other)? Is a VPS with root available? Who owns the account?
2. Who will use the admin (names/roles), and how many people approve publications?
3. Recipient e-mails for leads; SMTP (which mailbox or service sends the e-mail)?
4. Privacy policy and consent text (needed for leads and UTM): who provides them, and by when?
5. Lead retention period.
6. Is the old live soltexglobal.co being replaced by this site (needed to build the redirect map)?
7. Budget for staging (a separate VPS) and off-site backups.
