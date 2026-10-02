# Soltex Global: CMS / Admin + Backend Architecture (approved)

**Status:** APPROVED architecture, ready for implementation. Nothing has been implemented. Implementation starts only on a separate explicit command.
**Date:** 2026-10-02
**Base document:** `docs/admin-architecture-review.md`. This document records the corrections made after the client's review (37 points). **Sections of the review not mentioned here stay valid as written.** Where they conflict, this document wins.
**Code base:** `c685d32` plus the uncommitted Phase 1 work.

---

## Contents

1. [Architecture Decision Record](#1-architecture-decision-record)
2. [Changes after review: index](#2-changes-after-review-index)
3. [Publishing model and release state machine](#3-publishing-model-and-release-state-machine) (replaces review §L)
4. [Build pipeline and immutable releases](#4-build-pipeline-and-immutable-releases)
5. [Build safety on a shared VPS](#5-build-safety-on-a-shared-vps)
6. [Benchmark and VPS sizing](#6-benchmark-and-vps-sizing) (replaces the sizing in review §S)
7. [Authentication](#7-authentication) (replaces review §E)
8. [Authorization / RBAC](#8-authorization--rbac) (replaces review §F)
9. [Preview](#9-preview) (replaces review §N)
10. [Origins, CORS and reverse proxy](#10-origins-cors-and-reverse-proxy)
11. [Redirects and 404 fallback](#11-redirects-and-404-fallback) (replaces the serving part of review §O)
12. [Backups and recovery](#12-backups-and-recovery) (replaces review §R)
13. [Leads: data protection, consent, attribution](#13-leads-data-protection-consent-attribution) (amends review §K)
14. [SEO checks: severity and publish blocking](#14-seo-checks-severity-and-publish-blocking) (amends review §J)
15. [Translation fallback, canonical and hreflang: one algorithm](#15-translation-fallback-canonical-and-hreflang-one-algorithm) (replaces review §H fallback rule and §P)
16. [Admin UX principles](#16-admin-ux-principles) (amends review §X)
17. [Database: roles, audit log, PostgreSQL version, JSONB](#17-database-roles-audit-log-postgresql-version-jsonb) (amends review §C)
18. [Repository and shared core](#18-repository-and-shared-core)
19. [API contracts, errors, observability, rate limits, e-mail](#19-api-contracts-errors-observability-rate-limits-e-mail) (amends review §D)
20. [Hosting independence](#20-hosting-independence)
21. [Remaining blockers](#21-remaining-blockers)
22. [Decisions required from the client](#22-decisions-required-from-the-client)
23. [Implementation order](#23-implementation-order) (replaces review §Y)
24. [What will NOT be touched in the existing frontend](#24-what-will-not-be-touched-in-the-existing-frontend)
25. [Definition of Done](#25-definition-of-done)

---

## 1. Architecture Decision Record

### APPROVED

| # | Decision | Notes |
|---|---|---|
| ADR-01 | **Modular monolith**: one API process plus one worker process, from one codebase | API and worker are separate systemd units; modules are folders, not services |
| ADR-02 | **Node.js 24 LTS** | Maintenance LTS until April 2028. Moving to Node 26 LTS is a planned, tested upgrade, not part of v1 |
| ADR-03 | **Fastify 5** | — |
| ADR-04 | **PostgreSQL 17** | See §17.3 for the reasoning and the alternative |
| ADR-05 | **Drizzle ORM** + drizzle-kit (reviewed SQL migrations) | — |
| ADR-06 | **Zod** as the single schema source (validation, types, OpenAPI) | — |
| ADR-07 | **pg-boss** (job queue in PostgreSQL) | No Redis |
| ADR-08 | **React + Vite admin SPA** in Russian | — |
| ADR-09 | **Static public site** (prerender), rebuilt on publish | No SSR/ISR |
| ADR-10 | **Immutable releases** with manifest, atomic symlink switch, rollback without rebuild | §3–§4 |
| ADR-11 | **Preview** = same frontend with `CONTENT_SOURCE=preview` | §9 |
| ADR-12 | **Revisions** (full snapshots, restore = new revision) | Review §M, plus `schema_version` (§17.4) |
| ADR-13 | **RBAC** with fixed roles and permissions defined in code; field-level enforcement | §8 |
| ADR-14 | **SEO checker** in `packages/core`, shared by admin, API and build; BLOCKING / WARNING / INFO | §14 |
| ADR-15 | **Media library** (local storage behind a `StorageDriver` interface) | Review §I, plus §5 limits |
| ADR-16 | **Leads** with spam protection, notification, retention, anonymization | §13 |
| ADR-17 | **Audit log**, append-only by database permissions | §17.2 |
| ADR-18 | **Backups**: pgBackRest (full + WAL/PITR) + logical dumps + restic for media, encrypted, off-site, restore-tested, alerted | §12 |
| ADR-19 | **Host.KZ-compatible VPS** (Ubuntu LTS + nginx + systemd + PostgreSQL + filesystem / S3-compatible storage), provider-independent | §20 |
| ADR-20 | **Auth**: own session layer built only from vetted libraries (Argon2id, WebAuthn, TOTP); MFA by permission; target **OWASP ASVS Level 2** | §7 |
| ADR-21 | **Monorepo** with exactly `apps/web`, `apps/admin`, `apps/api`, `packages/core` | §18 |

### DEFERRED (not in v1)

| Deferred | Why / when |
|---|---|
| Page builder | Breaks the design system |
| Form builder | 3 fixed forms |
| CRM integration | After the lead process is agreed |
| AI features | Out of scope |
| Localized slugs | Model supports it; enabled only when there is an SEO need |
| Scheduled publishing | Cheap later with pg-boss |
| Custom roles (UI-editable) | Fixed roles cover the team |
| Advanced workflow (review/approval UI) | `in_review` is reserved in the data model |
| SSR / ISR | Static output is faster, safer, simpler |
| Redis | PostgreSQL covers queues, sessions and counters |
| Elasticsearch | PostgreSQL FTS + pg_trgm is enough |
| Microservices | Modular monolith |

---

## 2. Changes after review: index

| Client point | Where |
|---|---|
| 1 Publishing state machine | §3 |
| 2 Immutable release manifest | §4.2 |
| 3 Build safety | §5 |
| 4 VPS size + benchmark | §6 |
| 5 Auth / MFA / ASVS L2 | §7 |
| 6 RBAC permission categories | §8 |
| 7 Preview | §9 |
| 8 Origins / CORS | §10 |
| 9–10 Redirect fallback, internal targets | §11 |
| 11–13 Backups, PITR, media | §12 |
| 14–16 Lead protection, consent, UTM | §13 |
| 17 SEO severity | §14 |
| 18–19 Translation fallback, canonical/hreflang | §15 |
| 20–21 Admin UX, ⌘K | §16 |
| 22–24 Audit log, DB roles, PostgreSQL version | §17 |
| 25–27 Monorepo, core, JSONB | §17.4, §18 |
| 28–32 OpenAPI, errors, observability, rate limiting, e-mail | §19 |
| 33–34 Pipeline, immutable deploy | §4 |
| 35 Hosting | §20 |
| 36 ADR | §1 |

Superseded statements of the review (corrected here):
- "Build ~26 s": that measurement was taken under load. Measured clean: **4.4 s** (§6).
- "Hourly dump of the `leads` table": replaced by WAL archiving (§12). An hourly dump is **not** PITR.
- "HMAC preview token in the query string": replaced by an opaque, hashed, revocable token that never appears in a URL sent to a server (§9).
- "TOTP mandatory for Owner/Admin": replaced by WebAuthn + TOTP, mandatory by permission (§7).
- Review §O "if the API is down, nginx serves the static 404": now specified and tested (§11).

---

## 3. Publishing model and release state machine

### 3.1 Principle

**What the content database says and what the website shows are two different facts, stored separately.**
- *Content state* = what the editor has approved for publication.
- *Release state* = what is actually live.

The admin never says an entity is "on the site" unless the **current deployed release manifest** contains that entity revision.

### 3.2 Entity publication state (per entity, per language version)

```
                 publish                build+validate+deploy OK
   ┌───────┐  ───────────►  ┌───────────────────┐  ───────────►  ┌──────────┐
   │ draft │                │ published_pending │                │ deployed │
   └───────┘  ◄── edit ──── └───────────────────┘                └──────────┘
       ▲                        │          ▲                        │   │
       │                build/validation   │ "Повторить публикацию"  │   │ edit (draft changes;
       │                   fails           │                        │   │ live version stays)
       │                        ▼          │                        │   ▼
       │                ┌──────────────┐   │                        │ deployed + "Есть
       │                │ build_failed │───┘                        │ неопубликованные изменения"
       │                └──────────────┘                            │
       │                                         archive (+ deploy) ▼
       └──────────────────── restore ──────────────────────── ┌──────────┐
                                                               │ archived │
                                                               └──────────┘
```

| State | Meaning | Shown in the admin |
|---|---|---|
| `draft` | Never published, or the working copy differs and has not been submitted | «Черновик» |
| `published_pending` | Publish requested; revision fixed; waiting for / inside a build | «Публикуется…» with a progress indicator |
| `build_failed` | The build that contained this revision failed; the site still shows the previous live revision (or nothing) | «Публикация не завершена» · «Ошибка сборки: …» · button **«Повторить публикацию»** |
| `deployed` | The current release manifest contains this exact revision | «Опубликовано · на сайте с 10:42» |
| `archived` | Removed from the site (only after the release without it is deployed) | «В архиве» |

**Storage (no derived lies):**
- `entity.requested_revision_id`: the last revision the editor submitted for publication.
- `entity.live_revision_id`: **never written by editors.** It is recomputed only from the manifest of the release that becomes current: on deploy, on rollback, and on startup reconciliation.
- The displayed state is a function of `(working copy, requested_revision_id, live_revision_id, last build result)`, computed in one place in `packages/core`.

**Startup reconciliation:** on every API start, the API reads `/srv/soltex/current/release.json` and makes the DB match the file. The file system is the truth about what nginx serves.

### 3.3 Publication jobs (per build attempt)

`queued → snapshotting → building → validating → deploying → deployed`, or `→ failed` (with the step and the error), or `→ superseded` (coalesced into a newer job before it started).

### 3.4 Rollback

- **"Откатить сайт"** (Owner/Admin, `system.rollback`, MFA step-up): switches `current` to the previous successful release directory. **No rebuild.** The switch takes under one second.
- The DB records a `rollback` event. `live_revision_id` values are recomputed from the target release's manifest.
- Entities whose newer revision is no longer live return to `published_pending`, marked «Откачено».
- **Publishing hold:** after a rollback, automatic builds are paused until an Owner/Admin clicks «Возобновить публикации». Otherwise the next unrelated publish would immediately re-deploy the content that was just rolled back.
- The dashboard shows «Production release: R-20261002-1042-3f9c1a (откат с R-…, 11:05, Иванов)».

---

## 4. Build pipeline and immutable releases

### 4.1 Pipeline (any failure = NO DEPLOY)

| # | Step | Fails when |
|---|---|---|
| 1 | **Export**: in one `REPEATABLE READ` transaction, read all `requested` revisions → `ContentStore` (seed format) → stored as an immutable `content_snapshots` row with a SHA-256 | DB error |
| 2 | **Validate content** (`build-snapshots` + SEO BLOCKING rules, §14) | duplicate slug/ID, broken relation, placeholder mismatch, … |
| 3 | **Build** (`vite build`) into a new, empty release directory | compile error, timeout |
| 4 | **Prerender** | render error, timeout |
| 5 | **SEO validation** (`validate-site`: canonical, hreflang, sitemap, links, redirects) | any BLOCKING issue |
| 6 | **Artifact validation**: expected page count ±, every published entity × language has its HTML, 404 pages exist, no secrets, no `noindex` on production pages, total size within limits, checksum computed | mismatch |
| 7 | **Atomic deploy**: write `release.json`, `fsync`, then `ln -s releases/<id> current.tmp && mv -T current.tmp current` | — |
| 8 | Post-deploy smoke: HTTP 200 on home in all 6 languages, a 404 check, a redirect check | failure → automatic switch back to the previous release + `failed` |

The build **never** writes into the current production directory.

### 4.2 Immutable release manifest

Stored as `release.json` inside the release directory **and** as a row in `releases` (no UPDATE on manifest columns; status changes go into `release_events`).

```json
{
  "release_id": "R-20261002-1042-3f9c1a",
  "git_sha": "c685d32…",
  "content_snapshot_id": "018f…",
  "content_snapshot_sha256": "9a1b…",
  "entity_revisions": { "project-solbar-israel": 14, "page-home": 31 },
  "build_started_at": "2026-10-02T10:41:58Z",
  "build_finished_at": "2026-10-02T10:42:05Z",
  "validation_result": { "status": "passed", "blocking": 0, "warnings": 5, "pages": 174, "not_found_pages": 6 },
  "artifact_checksum": "sha256:…",
  "artifact_bytes": 152993412,
  "node_version": "24.x",
  "triggered_by": "user:…", "trigger": "publish",
  "deployed_at": "2026-10-02T10:42:06Z"
}
```

### 4.3 Layout

```
/srv/soltex/
  releases/<release_id>/      immutable; read-only after step 7 (chmod -R a-w)
  current -> releases/<id>    the only thing nginx serves
  build/<job_id>/             scratch for a running build (deleted after every job)
  media/                      originals + variants (not inside releases)
  logs/builds/<job_id>.log    bounded (§5)
```

- Keep the last **10 successful** releases. Failed release directories are deleted immediately after their log and validation report are saved.
- Videos and media are **not copied into each release**. nginx serves `/videos` and `/media` from shared, immutable storage.

  Current `dist/` is 146 MB, of which 133 MB are the two MP4s; without media a release is about 13 MB.

  This changes only where nginx reads those files. URLs are unchanged.

---

## 5. Build safety on a shared VPS

| Measure | Rule |
|---|---|
| Concurrency | **One heavy job at a time**, globally. One pg-boss queue `heavy` (builds + image variants) with concurrency 1, plus a PostgreSQL advisory lock and `flock` on `/srv/soltex/build/.lock`. A second build never starts while one runs. Builds have priority over image jobs |
| Coalescing | Publish requests are debounced (20 s). Requests arriving during a build are merged into **one** follow-up build that uses the newest revisions; older queued jobs become `superseded` |
| Process isolation | The build runs as a separate `systemd-run` transient unit under user `soltex-build`. Limits: `MemoryMax=1536M`, `MemoryHigh=1200M`, `CPUQuota=150%` (2 vCPU) / `300%` (4 vCPU), `Nice=10`, `IOWeight=50`, `TasksMax=256`. PostgreSQL and the API cannot be starved |
| Timeout | Whole pipeline 10 min (`RuntimeMaxSec`); each step has its own timeout. Measured normal: 4–10 s |
| Disk check | Before step 3: free space ≥ **max(5 GB, 3 × last release size)**, else refuse with «Недостаточно места на диске» + alert. Dashboard: WARNING < 15 %, CRITICAL < 10 % |
| Cleanup | `build/<job_id>` is always removed (also after a crash, by the next job); failed release directories are removed; releases beyond 10 are pruned |
| Logs | Per-build log capped at 1 MB (head + tail kept), last 100 build logs kept; no content payloads in logs |
| sharp (images) | `sharp.concurrency(1)`, `sharp.cache(false)`, `limitInputPixels: 50_000_000`, the stored master is normalized to ≤ 3200 px, **AVIF effort 2** (effort 4 measured 4× slower), WebP q78, one image at a time |
| Upload limits | Images 20 MB / 50 MP; videos 200 MB (admin only); PDF 20 MB |

---

## 6. Benchmark and VPS sizing

### 6.1 Measured (2026-10-02)

**Test machine:** cloud container, 2 vCPU, 8 GB RAM. Peak RSS is sampled from `/proc` for the whole process tree; "single" = largest single process.

**Site build, current content** (174 pages + 6 × 404):

| Step | Time | Peak RSS tree / single |
|---|---|---|
| content (`build-snapshots`) | 1.4 s | 227 / 96 MB |
| `vite build` | 1.6 s | 518 / 438 MB |
| prerender | 2.4 s | 367 / 230 MB |
| `validate-site` | 0.9 s | 270 / 136 MB |
| **full `npm run build`** | **4.4 s** | **511 / 452 MB** |

**Site build, scale test:** 20 × projects (160 projects, 1,092 HTML files):
- full build **10.1 s**, peak **520 MB**;
- memory stays flat and time grows roughly linearly.

The first scale run "hung" for 10 minutes. The cause was the measuring harness (an unread stderr pipe filled up by 760 expected "outdated translation" warnings), not the build. Fixed and re-measured.

**Image variants** (26 current images → AVIF q55 + WebP q78 at 480/960/1600/2400):

| Mode | Time | Peak RSS |
|---|---|---|
| serial, 1 libvips thread, AVIF effort 4 | 262 s | 174 MB |
| serial, 2 threads, AVIF effort 4 | 143 s | 203 MB |
| 2 parallel jobs | 133 s | **661 MB** |

**One 24 MP upload** (6000×4000 → master 3200 px → 4 variants):

| Formats | Time | Peak RSS |
|---|---|---|
| WebP only | 2.0 s | 208 MB |
| + AVIF effort 2 | 5.1 s | 302 MB |
| + AVIF effort 4 | 22.2 s | 331 MB |

### 6.2 Not measurable yet (components do not exist)

PostgreSQL, API, worker and concurrent admin activity are **estimates** until Phase N, where a load test is a release gate (see §25):
- k6/autocannon with 10 concurrent admin users editing and uploading;
- 20 lead submissions per minute;
- a running build and an image job at the same time.

Peak RAM is recorded per process.

| Component | Estimated steady RAM |
|---|---|
| OS + nginx + journald | 350 MB |
| PostgreSQL 17 (`shared_buffers` 1 GB on 4 GB / 2 GB on 8 GB) | 1.2–2.3 GB |
| API (Fastify) | 150–250 MB |
| Worker idle | 120 MB |
| **Peak extras** | build 520 MB **or** sharp 330 MB (never both: concurrency 1), pgBackRest/restic 150–300 MB |

Estimated peak: about 2.6–2.9 GB on 4 GB RAM.

### 6.3 Sizing decision

| | vCPU | RAM | Disk | Use |
|---|---|---|---|---|
| **BASELINE** | 2 | 4 GB | 80 GB NVMe | Works with about 1 GB headroom; builds take seconds. Acceptable only with swap 2 GB and the limits in §5 |
| **RECOMMENDED** | 4 | 8 GB | 120 GB NVMe | Headroom for PostgreSQL cache, restore tests on the same host, growth of media, slower shared vCPUs |

- VPS vCPUs are often slower than the test machine. Assume 2–3 × the measured times, which is still well under one minute.
- If the Phase N load test shows peak RAM above 70 % of the BASELINE, RECOMMENDED becomes the minimum.

---

## 7. Authentication

- **No self-written cryptography.** Only:
  - Node `crypto` (`randomBytes`, `createHash`, AES-256-GCM);
  - `@node-rs/argon2` (**Argon2id**, OWASP parameters);
  - `@simplewebauthn/server` (WebAuthn);
  - `otplib` (TOTP, RFC 6238).
- **Sessions:**
  - opaque 256-bit random token in the cookie `__Host-soltex_session` (`HttpOnly; Secure; SameSite=Strict; Path=/`);
  - the DB stores only `SHA-256(token)`;
  - rotation on login, on MFA, on privilege change; idle 8 h, absolute 7 days;
  - "log out everywhere"; a password change, MFA reset or role change revokes all sessions.
- **MFA:**
  - **WebAuthn / passkeys** are the preferred factor and **required for Owner and Admin** (at least one passkey; TOTP may be kept as a second factor);
  - **TOTP** is the fallback for others.
- **MFA is mandatory by permission**, computed in code. Any user holding any of these permissions cannot use the admin before enrolling MFA:
  - `content.publish`, `seo.publish`, `redirects.manage`;
  - `users.manage`, `settings.manage`;
  - `leads.read`, `leads.manage`, `leads.export`;
  - `system.deploy`, `system.rollback`.

  This covers Owner, Admin, Content manager, SEO specialist and Marketer. For Editor it is recommended; this is a client decision.
- **Step-up re-authentication** (MFA within the last 10 min) for:
  - user and role changes, MFA removal, lead export;
  - rollback, redirect bulk changes, settings.
- **Recovery codes:**
  - 10 one-time codes, 128-bit, stored hashed;
  - each use is audited and notified by e-mail;
  - regeneration revokes all old codes.
- **Lost device:**
  - a recovery code, or an Owner/Admin reset;
  - reset = verified out-of-band identity, all sessions revoked, MFA must be re-enrolled at next login, audit + e-mail to the user and all Owners;
  - nobody can reset their own MFA without a factor.
- **Password reset:** single-use token, 30 min, hashed; the response is identical whether or not the account exists; the reset does **not** bypass MFA.
- **CSRF:** `SameSite=Strict` + `Origin`/`Sec-Fetch-Site` check + required custom header on mutations.
- **Target: OWASP ASVS 4.0.3 Level 2.** A checklist in `docs/admin-security-asvs.md` is part of the Definition of Done.

**Required automated tests:**
- MFA enrollment and removal (with step-up);
- login with each factor and with a recovery code;
- recovery-code reuse rejected;
- lost-device reset flow;
- session invalidation after password change, role change and MFA reset;
- session fixation (pre-login token never becomes a session);
- privilege escalation (a user cannot grant themselves or others a higher role; Admin cannot modify Owner);
- password reset (expiry, reuse, enumeration);
- CSRF on every mutating route (missing header, wrong Origin);
- lockout and throttling.

---

## 8. Authorization / RBAC

### 8.1 Permissions (strings in code)

| Category | Permissions |
|---|---|
| Content | `content.read`, `content.edit`, `content.publish` |
| SEO | `seo.read`, `seo.edit`, `seo.publish` |
| Redirects | `redirects.read`, `redirects.manage` |
| Media | `media.read`, `media.upload`, `media.replace`, `media.delete` |
| Leads | `leads.read`, `leads.manage`, `leads.export` |
| Admin | `users.manage`, `settings.manage` |
| System | `system.read`, `system.deploy`, `system.rollback` |
| Audit | `audit.read` |

### 8.2 Roles (fixed sets)

| Permission | Owner | Admin | Content mgr | Editor | SEO | Marketer |
|---|---|---|---|---|---|---|
| content.read / edit / publish | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓– | ✓–– | ✓–– |
| seo.read / edit / publish | ✓✓✓ | ✓✓✓ | ✓✓– | ✓–– | ✓✓✓ | ✓–– |
| redirects.read / manage | ✓✓ | ✓✓ | ✓– | –– | ✓✓ | –– |
| media.read / upload / replace / delete | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓– | ✓✓–– | ✓––– | ✓––– |
| leads.read / manage / export | ✓✓✓ | ✓✓✓ | ––– | ––– | ––– | ✓✓✓ |
| users.manage | ✓ | ✓ (not Owners) | – | – | – | – |
| settings.manage | ✓ | ✓ | – | – | – | – |
| system.read / deploy / rollback | ✓✓✓ | ✓✓✓ | ✓✓– | ––– | ✓–– | ––– |
| audit.read | ✓ | ✓ | – | – | – | – |

- `system.deploy` = manual rebuild / retry publication.
- `content.publish` and `seo.publish` implicitly trigger a build through the publication service; they do not grant `system.deploy`.
- **Rollback is Owner and Admin only.**
- **No role has a wildcard or "admin" bypass.** Owner is a role with an explicit full list; the code has no `if (isAdmin) return true`.

### 8.3 Authorization chain (every request)

`user (active, MFA satisfied) → permissions (role) → endpoint (route declares required permission) → resource (record exists, not archived unless allowed; Owner-only targets) → field-level (allowed fields per permission; e.g. seo.edit may change only seo_*, slug, noindex, in_sitemap, alt texts)`.

- Each route declaration **must** name its permission. A test fails the build if any route lacks one.
- The role × endpoint × field matrix tests are generated from the permission map.

---

## 9. Preview

- **Same frontend.** Preview uses the same components, CSS, routing, SEO head renderer, UI translations and `normalize`. The **only** difference is `CONTENT_SOURCE=preview`: the language snapshot comes from the API instead of a bundled JSON file.
- **Preview snapshot** (`preview_snapshots`):
  - content = published content + the requesting user's draft changes for the entity;
  - built server-side with the same `normalize`;
  - bound to `user_id`, `session_id`, `entity`, `locale`; expires after 30 min.
- **Token:**
  - opaque 256-bit random value, stored hashed;
  - purpose `preview:read` for one snapshot only;
  - expires after 30 min; revocable (on logout, session revocation, or «Закрыть предпросмотр»);
  - contains no data.
- **No token in server-visible URLs:**
  1. The admin opens `https://preview.soltexglobal.co/__preview#t=<token>`. The fragment is never sent to a server and never appears in nginx logs.
  2. The preview page POSTs the token to `/api/v1/preview/session`.
  3. The API exchanges it for a cookie `__Host-soltex_preview` (HttpOnly, Secure, SameSite=Strict, 30 min) and the token is consumed.
  4. The page redirects to the target path.

  Additionally, nginx and pino never log query strings or the `Authorization`/`Cookie` headers on preview routes.
- **Headers on every preview response:**
  - `Cache-Control: no-store`;
  - `X-Robots-Tag: noindex, nofollow, noarchive`;
  - `Referrer-Policy: no-referrer`.

  Also: `robots.txt` = `Disallow: /`; `<meta name="robots" content="noindex, nofollow, noarchive">` injected by the preview mode; a «ПРЕДПРОСМОТР» banner.
- An expired or invalid session gives a 401 page in Russian with «Открыть предпросмотр заново».
- Drafts never enter the public build; the build reads only `requested` revisions (§4.1).

---

## 10. Origins, CORS and reverse proxy

| Origin | Serves | API access |
|---|---|---|
| `https://soltexglobal.co` | static site (`current`) | `POST /api/v1/public/leads` only, proxied by nginx (same origin) |
| `https://admin.soltexglobal.co` | admin SPA + `/api/v1/*` | same origin |
| `https://preview.soltexglobal.co` | preview build | `/api/v1/preview/*` only, proxied by nginx (same origin) |

- **No CORS anywhere** (no `Access-Control-Allow-Origin` header at all).
- If CORS ever becomes unavoidable, the only allowed origin is exactly `https://preview.soltexglobal.co`; never `*`, never reflected origins, never with credentials for other origins.
- nginx on each host proxies an **explicit location allowlist**: the site host cannot reach admin routes, and the preview host can reach only preview routes. The API binds to `127.0.0.1` / a unix socket.
- `/api/v1/docs` (OpenAPI UI): **disabled in production**; enabled in development and staging behind admin authentication.

---

## 11. Redirects and 404 fallback

### 11.1 Request flow (nginx, site host)

1. `try_files $uri $uri/index.html @lookup;` → **an existing static page is served immediately**; the API is not involved.
2. `@lookup`:
   - proxies to the internal-only endpoint;
   - `proxy_connect_timeout 1s; proxy_read_timeout 2s`;
   - the normalized `$uri` is passed in `X-Lookup-Path`;
   - the endpoint is reachable only through nginx (`127.0.0.1`, `internal` location).
3. API result:
   - `301/302` with `Location` → returned to the visitor;
   - `404` → `@not_found`.
4. **API down / timeout / 5xx** → `proxy_intercept_errors on; error_page 404 500 502 503 504 = @not_found;` → **a real 404, never a 502.**
5. `@not_found`:
   - the language prefix is chosen by a `map` on `$uri` (`/ru/…` → `/ru/404.html`, unknown → `/404.html`);
   - status **404**;
   - the localized 404 body produced by the build.
6. nginx `limit_req` on `@lookup` protects the DB from scanners.

### 11.2 Lookup endpoint contract

It is not a general-purpose API. It accepts a single normalized path and rejects (→ 404, logged at debug level without the value):
- anything not starting with `/`;
- `//` (protocol-relative);
- `\`;
- any scheme (`http:`, `javascript:`, …);
- CR, LF, NUL or other control characters;
- percent-encoded control characters or slashes;
- length > 2048;
- `..` segments.

The lookup is an exact match on the normalized path (trailing slash policy as in Phase 1).

### 11.3 Redirect targets (v1)

**Internal paths only.**
- DB `CHECK (to_path ~ '^/[^/\\]')` plus a Zod rule; no scheme, no host.
- `Location` is always built by the server as `https://soltexglobal.co` + path. This prevents open redirects by construction.
- External redirects are DEFERRED.

### 11.4 Tests (CI with nginx + API containers, and on staging)

- static page served with the API stopped;
- known redirect → 301 with the correct internal `Location`;
- unknown URL → 404 with the correct localized body, for all 6 language prefixes;
- **API stopped → 404, status 404, not 502**;
- API slow (> 2 s) → 404;
- injection cases from §11.2 → 404 and no `Location` header;
- redirect loop or chain rejected on save.

---

## 12. Backups and recovery

### 12.1 What, how, where

| Data | Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL, physical | **pgBackRest**: full weekly, differential daily, **continuous WAL archiving → PITR** | WAL continuous (`archive_timeout` 60 s) | PITR window 14 days; fulls 4 weeks |
| PostgreSQL, logical | `pg_dump -Fc`, encrypted with `age` | nightly | 14 daily, 8 weekly, 12 monthly (portable across major versions) |
| Media | **restic** (encrypted, deduplicated): originals **and** variants | nightly, after the DB backup | as logical dumps |
| Current release | restic (about 13 MB) | on every deploy | last 10 |
| Config (nginx, systemd, non-secret) | repository | each change | git |
| Secrets (`.env`, keys) | separate procedure (§12.5) | on change | — |
| Provider VPS snapshots | provider | provider default | **extra layer only** |

- **Off-site:** S3-compatible storage at a **different provider or data center** (pgBackRest `repo1` S3 with `repo-cipher-type=aes-256-cbc`; restic S3 backend). A 3-day local copy is kept for fast restores.
- **If off-site S3 storage is not available at launch:** WAL archiving goes to a second local disk. This is an **explicit limitation**: no protection against loss of the VPS, RPO = last off-site logical dump (24 h). It is shown on the dashboard as a WARNING until resolved.
- **RPO:** ≤ 5 min with WAL archiving (≤ 24 h under the limitation above). **RTO:** ≤ 4 h.

### 12.2 Media consistency

- Media files are **immutable**: an upload creates a new UUID path, and "replace" creates a new file and moves the pointer.
- Unreferenced files are garbage-collected only after they are older than the longest backup retention.

Therefore a DB backup taken at time T only references files that still exist in the media snapshot taken after T.

Restore order: DB, then media. The restore test verifies:
- every `storage_path` and `public_path` in the DB exists;
- every legacy URL (`/images/…`, `/videos/…`) returns 200 on the restored staging.

### 12.3 Integrity and restore tests

- Weekly: `pgbackrest verify`; `restic check --read-data-subset=10%`.
- Weekly automated **restore test** (staging, or a temporary cluster on production at low priority if no staging exists):
  1. PITR restore to "now − 1 h";
  2. migration compatibility check;
  3. row counts against the source;
  4. export → build → `validate-site`;
  5. media existence check.

  The result is recorded in `backup_runs` and shown on the dashboard.
- A quarterly manual restore drill follows the runbook `docs/admin-operations.md`.

### 12.4 Alerting

All alerts go through `NotificationService` (e-mail to ops recipients). They are also shown on the dashboard.

| Condition | Level |
|---|---|
| backup job failed | CRITICAL immediately |
| last successful DB backup older than 26 h / 36 h | WARNING / **CRITICAL** |
| WAL archive lag > 15 min | CRITICAL |
| restore test failed, or older than 8 days | CRITICAL |
| disk free < 15 % / < 10 % | WARNING / CRITICAL |
| off-site target unreachable | CRITICAL |

The VPS cannot report its own death. An **external dead-man's switch** that pings from outside (a heartbeat endpoint checked by another server or service) is a client decision (§22).

### 12.5 Secrets recovery (separate procedure)

- `.env` and the encryption keys are **never** in the regular data backups in plain text.
- An `age`-encrypted secrets bundle goes to a separate off-site location, encrypted for **two recipients**:
  - the Owner's key in a password manager;
  - an offline escrow key (printed or sealed, held by the client).
- The backup encryption passphrases are stored outside the VPS by the same two holders. **Without them, backups are useless.**
- Quarterly decrypt test of the bundle; a secret rotation runbook to run after any restore onto a new host.

---

## 13. Leads: data protection, consent, attribution

### 13.1 Protection

- **Least privilege:**
  - the API DB role cannot read leads outside the API;
  - lead endpoints require `leads.*`;
  - `leads.export` requires a step-up.
- **Encryption at rest where practical:**
  - `email`, `phone` and `message` are encrypted per column (AES-256-GCM, Node `crypto`, key from env, with a key ID for rotation);
  - an HMAC blind index on the normalized e-mail and phone supports exact-match search and duplicate detection;
  - `name` and `company` stay plain for admin search;
  - backups are encrypted (§12).
- **Logging:**
  - Fastify request logging never serializes bodies;
  - pino `redact` covers `req.headers.cookie`, `authorization`, `*.email`, `*.phone`, `*.message`, `*.name`;
  - the route `POST /public/leads` has a dedicated serializer that logs only the request ID, status and spam verdict;
  - error handlers and any error tracker (`beforeSend`) strip bodies, query strings and user data;
  - validation errors report field **names** only.
- **Test:** an integration test submits a lead with canary values and greps all log output and the error-tracker payload; any canary found fails the test.
- **Export:**
  - CSV with formula-injection escaping (`= + - @` prefixed);
  - audited with actor, time, filter and row count;
  - e-mail notice to Owners.
- **Deletion:** soft delete → after 30 days the anonymization job removes name, e-mail, phone, message, IP hash and attribution identifiers, and keeps aggregate fields (date, country, form type, status).
- **Retention:** leads older than the agreed period (proposal 24 months; client decision) are anonymized automatically.

### 13.2 Consent record

`leads` stores:
- `consent_text_version`;
- `consent_at` (server time);
- `privacy_policy_version`;
- `consent_locale`.

The versions reference `consent_texts(version, locale, text, published_at)`, which are immutable.

**Important:** the current forms have no consent checkbox. Adding one changes the forms, which requires client and legal approval (§21). Until then the backend records which privacy notice version was displayed, and leaves `consent_at` empty with `consent_basis='notice_only'`.

### 13.3 UTM attribution

**`ATTRIBUTION_ENABLED=false` by default.** It is enabled only after legal approval. With the flag off, no attribution script is shipped.

Rules once enabled:

| Topic | Rule |
|---|---|
| Collected | Allowlist only: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`; landing path (no query); referrer **origin only** (no path or query). Each value ≤ 200 chars |
| Consent | If legal requires consent for storing identifiers on the device (likely for EU visitors), nothing is stored before consent; otherwise the values are sent only with the lead |
| First touch | `localStorage`, set once, expires after 90 days, never overwritten before expiry |
| Last touch | Overwritten only by a visit with campaign parameters or an external referrer (**last non-direct click**). Direct visits and internal navigation never overwrite it |
| Direct traffic | Recorded as `direct` only when no stored touch exists |
| Cross-subdomain | None: forms exist only on `soltexglobal.co` (`www` redirects to the apex), and storage is per origin by design. No cookies, no cross-domain linking |
| Expiry / clearing | First touch 90 days; cleared after a lead is successfully submitted, or on the visitor's request via the privacy page |

---

## 14. SEO checks: severity and publish blocking

| Severity | Effect |
|---|---|
| **BLOCKING ERROR** | Publish button disabled with the reason; the build also fails on these |
| **WARNING** | Publish allowed; shown in the SEO block and on the dashboard |
| **INFO** | Hints only |

**BLOCKING (exhaustive list for v1):**
1. duplicate slug (same type + language);
2. broken relation (reference to a missing or unpublished entity, or a broken internal link);
3. invalid canonical (override pointing to a missing, redirected, noindex or non-200 URL, or to an external host);
4. broken hreflang (non-reciprocal, pointing to a noindex or non-canonical URL, or duplicate language);
5. redirect loop;
6. malformed URL (slug or redirect path fails the syntax rules of §11.2);
7. build failure (any step of §4.1);
8. missing or invalid required SEO fields on an **indexable** page (empty title or description, title > 120 chars).

**WARNING:**
- title or description outside the recommended length;
- duplicate title or description;
- missing translation, outdated translation;
- missing OG image, missing alt text, image > 2 MB;
- redirect chain (auto-collapsed);
- noindex on a page that is linked from the navigation.

**INFO:**
- orphan page;
- `lastmod` unchanged for a long time;
- suggestions (e.g. "заголовок без ключевого слова из H1").

---

## 15. Translation fallback, canonical and hreflang: one algorithm

One pure function in `packages/core/seo` (`resolveLocaleVersion(entity, locale)`) is used by `normalize`, prerender, sitemap, the admin SEO block and the validators.

### 15.1 Translation states per (entity, language)

| State | Definition |
|---|---|
| `approved` | An approved translation revision exists and its source hash matches the current source |
| `outdated` | An approved translation revision exists, but the source has changed since |
| `draft` | Never approved (or only a draft exists) |
| `missing` | No translation row |

- The site serves the **last approved translation revision**, never the working copy of a translation.
- Editing an approved translation creates a draft. The live text does not change until that draft is approved and published.

### 15.2 Rules

| Case (language L ≠ source) | Page `/L/…` | Body language | `lang` | Canonical | hreflang L | Sitemap L |
|---|---|---|---|---|---|---|
| L `approved` | localized | L | L | self | yes | yes |
| L `outdated` (default) | localized, **previous approved version** | L | L | self | yes | yes |
| L `outdated` + publisher chose «Скрыть устаревшие переводы» | source fallback | source | **source** | source URL | **no** | no |
| L `draft` / `missing` | source fallback | source | **source** | source URL | **no** | no |
| L `noindex` | served | L | L | self | **no** | no |
| canonical override set (L) | served | L | L | override | **no** | no |
| entity unpublished / archived | 404 (or 301 if the editor chose one) | — | — | — | — | — |
| source language noindex | served | source | source | self | no cluster | none |

- **Invariant: never "RU URL + EN text + RU hreflang".** A fallback page is never a member of the hreflang cluster, always canonicalizes to the source URL, and is never in the sitemap.
- **Cluster** = source + every L whose row in the table says "hreflang yes", provided the source is indexable. `x-default` = the source URL.
- With fewer than two members, no hreflang is output. Reciprocity is guaranteed because every page renders the same cluster.

**Known gap (current frontend):** on a fallback page the `<html lang>` is still L while the body is in the source language. The fix is an adapter: set `lang` on the content root of fallback pages, with no visual change. It is listed as a frontend change requiring approval (§24).

### 15.3 Tests

Table-driven unit tests cover every combination of:
- source state × target state: published / draft / outdated / missing;
- noindex (source / target), canonical override (yes / no), entity published / archived.

For each, they assert the body language, `lang`, canonical, cluster, sitemap entry and status code.

The build validator re-checks the invariants on the real output.

---

## 16. Admin UX principles

- **«Ни один экран не должен требовать знания базы данных».** No IDs, table names, JSON, UUIDs, enum values or SQL wording in the main UI. Relations are picked by title with a thumbnail; statuses are Russian words.
- Technical details (stable ID, revision number, release ID, raw JSON of a revision, request IDs) live only in a collapsed **«Дополнительно»** section, visible to Admin/Owner.
- **⌘K actions per result:** «Открыть», «Редактировать», «Предпросмотр», «Открыть на сайте».
  - **No Publish from search.**
  - Commands that change the site (publish, rollback) are not available in ⌘K. If added later, they always open the normal confirmation dialog.
- Everything else from review §X stays.

---

## 17. Database: roles, audit log, PostgreSQL version, JSONB

### 17.1 Database roles

| Role | Rights | Used by |
|---|---|---|
| `soltex_migrate` | Owns the schema; `CREATE/ALTER/DROP` | Deploy step only. Its password is **not** in the API/worker environment |
| `soltex_app` | `SELECT/INSERT/UPDATE/DELETE` on application tables; **`INSERT, SELECT` only on `audit_events`**; no `CREATE` on any schema, no `TRUNCATE`, no `ALTER/DROP` | API + worker |
| `soltex_backup` | `pg_read_all_data` (logical dumps); pgBackRest runs as the OS `postgres` user with a local socket | Backup jobs |

- Default privileges are set so that new tables created by `soltex_migrate` grant only the above.
- A CI test connects as `soltex_app` and asserts that `CREATE TABLE`, `ALTER`, `DROP`, `TRUNCATE`, and `UPDATE/DELETE` on `audit_events` all fail.

### 17.2 Audit log

- `audit_events` is append-only by permission (above).
- A `BEFORE UPDATE OR DELETE` trigger raises an error even for the table owner. Retention pruning is done only by an explicit, reviewed migration.
- Every authenticated mutation writes an audit row in the same transaction as the change.
- Recorded: actor, action, entity, revision, request ID, IP hash, user agent, summary. **No lead PII and no secrets.**

### 17.3 PostgreSQL version: **17**

| Factor | Assessment |
|---|---|
| Support | Community support until Nov 2029 |
| Maturity | Many minor releases since Sept 2024; supported by Drizzle, pg-boss, pgBackRest, WAL-G |
| Availability | Self-hosted from the official PGDG apt repository on Ubuntu 22.04/24.04. **PS.kz DBaaS versions: UNKNOWN** (must be asked) |
| Backup compatibility | pgBackRest supports 17; logical dumps (`pg_dump` 17) restore into 17 and newer |
| Migration path | Major upgrades by `pg_upgrade --link`, rehearsed on a restored copy first; logical dump as a fallback |

- **Alternative:** PostgreSQL 18, if the chosen managed provider offers only 18 (equally supported by the stack).
- **Fallback:** PostgreSQL 16 (the Ubuntu 24.04 default package) if PGDG packages are not allowed. The application uses no 17-only features, so 16–18 are interchangeable. CI runs the test suite against the chosen major version.

### 17.4 JSONB policy

JSONB is used only where the schema is deliberately flexible. Every JSONB column has:
- a named Zod schema in `packages/core/content` or `domain`;
- a `schema_version` field;
- validation on write (API) and on read in CI (a check that loads every row);
- a migration strategy: upcaster functions `vN → vN+1` applied on read, plus a batch migration in the same release that bumps the version.

| Column | Zod schema | Why JSONB |
|---|---|---|
| `*_translations.scope/results/deliverables` | `TextListV1` | ordered text lists |
| `*_translations.specs` | `SpecListV1` | label/value pairs |
| `page_translations.copy`, `lists` | registry schema per page key | slot set defined in code |
| `revisions.data` | `EntitySnapshotV1<type>` | full snapshot |
| `content_snapshots.store` | `ContentStoreV1` | build input |
| `releases.validation_result` | `ValidationResultV1` | report |
| `leads.attribution` | `AttributionV1` | flag-dependent |
| `media.variants` | `MediaVariantsV1` | format/size list |
| `audit_events.summary` | `AuditSummaryV1` | per-action details |

Restoring an old revision passes through the upcasters, so old snapshots stay restorable.

---

## 18. Repository and shared core

```
apps/web        current site (moved with git mv; regression must stay IDENTICAL)
apps/admin      React + Vite admin
apps/api        Fastify API + worker entry point
packages/core
  domain/       types, locales, permission map, roles, state machines, IDs
  validation/   shared Zod primitives and entity input schemas
  seo/          slug rules, SEO checker, canonical/hreflang algorithm, redirect graph
  content/      content schemas (store format, page-slot registry, JSONB schemas), normalize
```

- **No other packages.** Logical separation inside `core` uses subpath exports (`@soltex/core/seo`, …).
- A small check script enforces the dependency direction: `domain` ← `validation` ← `content`/`seo`; `core` never imports from `apps/*`.
- `packages/core` has no runtime dependencies other than Zod.

---

## 19. API contracts, errors, observability, rate limits, e-mail

- **OpenAPI 3.1** is generated from the same Zod schemas. `/api/v1/docs`: production disabled; development/staging admin-authenticated (§10).
- **Errors:**
  - RFC 9457 `application/problem+json` with `type`, `title` (Russian), `status`, `code`, field errors, and **`request_id`**;
  - every response carries `X-Request-ID` (generated by nginx, or accepted from the client only if it is a valid UUID);
  - the same ID is in pino logs and shown in the admin error toast («Код ошибки: 7f3c…, сообщите администратору»);
  - no stack traces, SQL or internal paths in responses.
- **Observability dashboard** («Система»):
  - API status, DB status;
  - last successful build, last failed build (with reason);
  - current production release;
  - disk usage;
  - backup status and age, WAL lag;
  - last restore test;
  - queue depth.

  No secrets, no connection strings.
- **Rate limiting** (layered, NAT-friendly):

  | Target | Limit |
  |---|---|
  | Login per IP | 30 / 15 min (offices behind one NAT stay usable) |
  | Login per account | progressive delay after 5 failures; temporary lock after 20, with notification. Lock is by account + unknown device, so a known device is not locked out by an attacker |
  | Known-device cookie | relaxes per-IP limits |
  | Admin API per session | 600 / min |
  | `POST /public/leads` per IP | 10 / hour plus honeypot and minimum fill time |
  | Global | circuit breaker on spikes |

  Counters live in PostgreSQL / process memory (no Redis).
- **E-mail:**
  1. A `LeadCreated` domain event is written to an outbox table in the same transaction as the lead.
  2. A pg-boss job calls `NotificationService` (recipients from settings, Russian templates, no PII in logs).
  3. It sends through the `EmailProvider` interface: `SmtpEmailProvider` (nodemailer) in production, `FakeEmailProvider` in tests.

  Failures are retried with backoff; the lead is never lost. System alerts (§12.4) use the same path.

---

## 20. Hosting independence

- Target: **Ubuntu LTS VPS + nginx + systemd + PostgreSQL 17 + local filesystem** (S3-compatible object storage optional via `StorageDriver`).
- No provider-specific APIs in the code. Everything provider-specific is configuration (`.env`, nginx and systemd templates).
- `docs/deployment/ps-cloud.md` and `docs/deployment/hoster.md` are **not created now**: the provider is not confirmed. Only the confirmed provider gets a note, in Phase N (contents: plan, image, firewall, SMTP ports, IPv6, snapshots, resize procedure, object storage endpoint).

---

## 21. Remaining blockers

| # | Blocker | Blocks |
|---|---|---|
| B1 | Hosting provider and plan not confirmed (PS.kz vs Hoster.kz); VPS with root required | Phase N (deployment); not the development start |
| B2 | Off-site backup storage (provider / account) not decided | Full backup design §12 (otherwise launch with the stated limitation) |
| B3 | Privacy policy, consent text, legal basis for attribution | Lead backend go-live, `ATTRIBUTION_ENABLED` |
| B4 | Consent checkbox in forms (form change) | Proper consent record §13.2 |
| B5 | SMTP sender (mailbox / service) and lead recipients | Lead notifications, system alerts |
| B6 | Admin users and roles (names, who publishes) | Phase C seed users, MFA enrollment plan |
| B7 | Linguistic review of the 4 new 404 strings (P1-20) | Content only, not architecture |
| B8 | Phase 1 work is still uncommitted (54 entries) | Phase A starts from a committed baseline; commit only on the client's command |

---

## 22. Decisions required from the client

1. Hosting provider, plan and account owner; BASELINE or RECOMMENDED size (§6.3).
2. Off-site backup location (another provider or another data center) and the budget for it.
3. External dead-man's-switch monitoring: allowed (an external service) or a second server?
4. Lead retention period (proposal: 24 months) and who may export.
5. Consent checkbox in forms: yes or no (it changes the forms).
6. Attribution: approve the rules of §13.3 for legal review; are EU visitors in scope?
7. MFA for the Editor role (recommended: yes).
8. Default for outdated translations: keep the previous approved translation (proposed) or fall back to the source.
9. Staging environment: a separate VPS (recommended) or none (restore tests then run on production at low priority).
10. Old live soltexglobal.co: replaced by this site? (needed for the redirect import).
11. Holders of the backup and secret escrow keys (two people).

---

## 23. Implementation order

Estimates are engineer-days for one senior full-stack developer.

| # | Phase | Content | Days |
|---|---|---|---|
| A | Foundation | Monorepo (`git mv` site → `apps/web`, regression IDENTICAL), `packages/core` structure + dependency check, CI, `.env.example` | 4–6 |
| B | Database + import | PostgreSQL 17, DB roles (§17.1), schema + migrations, JSONB schemas, seed import, export, round-trip test | 8–11 |
| C | API core + auth + RBAC + audit | Fastify, Zod/OpenAPI, RFC 9457 + request ID, sessions, Argon2id, WebAuthn + TOTP + recovery codes, step-up, permissions chain, audit log, rate limits, health | 12–15 |
| D | Admin shell | Layout, navigation, tables, forms, ⌘K (no publish), login + MFA screens, «Дополнительно» pattern | 6–8 |
| E | Content management | Editors for pages and collections, relations, usages, archive | 12–16 |
| G | Publishing + releases | Revisions/diff/restore, state machine (§3), content snapshots, pipeline (§4), manifest, heavy queue + systemd limits (§5), rollback + hold, reconciliation | 9–12 |
| H | Preview | Snapshots, opaque tokens + fragment exchange, preview mode, headers | 4–6 |
| I | SEO | SEO block, BLOCKING/WARNING/INFO, canonical/hreflang algorithm + matrix tests, slug dialog, redirects + nginx fallback + tests (§11) | 9–12 |
| F | Translations | Language tabs, side-by-side, approved revisions, outdated handling, queue | 5–7 |
| J | Media | Upload pipeline, sharp limits, variants, library, replace, usages, immutable storage, `srcset` | 7–9 |
| K | Leads | Public endpoint, spam, column encryption + blind index, log redaction + canary test, outbox → NotificationService → EmailProvider, retention/anonymization, export audit, consent fields, attribution behind flag | 7–9 |
| L | Dashboard + observability | Metrics, system screen (§19) | 2–3 |
| M | Security + docs | ASVS L2 checklist, ZAP, permission/route coverage tests, `admin-*.md` | 6–8 |
| N | Deployment + backups | VPS, nginx, systemd, certbot, pgBackRest + WAL, restic, secrets bundle, alerts, restore test, **load test / benchmark on the real VPS**, provider note | 7–9 |

**Order:** A → B → C → D → E → G → H → I → F → J → K → L → M → N.

**Total: about 98–131 days**, up from 86–117 because of WebAuthn, the release state machine, PITR and lead protection.

---

## 24. What will NOT be touched in the existing frontend

**Not touched:**
- design, layout and components' markup;
- CSS / Tailwind tokens;
- motion system;
- copy and translations;
- URLs and route architecture;
- the 6 languages and RTL;
- images and videos (files and URLs);
- forms' fields;
- prerender output (the regression suite must stay IDENTICAL);
- legacy files (kept per P1-17).

**Allowed, isolated adapters (each verified by the Phase 1 regression suite):**

| Change | Phase | Condition |
|---|---|---|
| Move to `apps/web` (`git mv`) | A | byte-identical build output |
| `ContentSource` `db` / `preview` implementations | B / H | components unchanged |
| `HttpLeadService` replacing the simulated service | K | same UX and messages |
| Attribution script | K | only with `ATTRIBUTION_ENABLED=true` after legal approval |
| `srcset` from media variants | J | separate visual check |
| `lang` on the content root of fallback pages (§15.2) | I | client approval |
| Consent checkbox | K | client + legal approval (B4) |
| Serving `/videos` and `/media` from shared storage | G/N | URLs unchanged |

---

## 25. Definition of Done

### Every phase

- [ ] TypeScript strict, lint and tests green in CI.
- [ ] The Phase 1 site regression suite is IDENTICAL (174 pages + 6 × 404; text, SEO, screenshots, no-JS, motion, inquiry topics).
- [ ] No secrets in the repository or in any frontend bundle; the validator passes.
- [ ] The relevant `docs/` are updated (architecture, cms-schema, routes, seo, decisions).
- [ ] No commit or push without the client's explicit command.

### v1 release (all must hold)

- [ ] Publish → site updated, or a clear «Публикация не завершена» with «Повторить публикацию». Tested by forcing a failure at each pipeline step.
- [ ] The DB never shows "deployed" for a revision that is not in the current release manifest (reconciliation test).
- [ ] Rollback switches releases without a rebuild, records the event and sets the publishing hold.
- [ ] Two simultaneous publishes give one build; a build never runs in parallel; limits from §5 are active.
- [ ] Auth tests from §7 green; ASVS L2 checklist complete with evidence; MFA enforced by permission.
- [ ] Role × endpoint × field matrix tests green; no route without a permission.
- [ ] Preview: draft visible only in preview; headers and robots verified; the token never appears in logs (log-grep test).
- [ ] No CORS headers; host-level route allowlists verified.
- [ ] Redirect / 404 tests of §11.4 green, including **API stopped → 404, not 502**.
- [ ] Canonical/hreflang matrix tests green; no fallback page in hreflang or the sitemap.
- [ ] SEO BLOCKING list enforced in the admin and in the build.
- [ ] Lead canary test: no PII in logs or error reports; export audited; retention job tested.
- [ ] `soltex_app` cannot `CREATE/ALTER/DROP/TRUNCATE` or `UPDATE/DELETE` the audit log (CI test).
- [ ] Backups: WAL archiving active (or the limitation documented and shown); off-site copy; **a successful automated restore test**; every alert of §12.4 triggered once on staging; secrets bundle decrypted in a drill.
- [ ] Load test on the real VPS recorded (peak RAM per process; build + image job + 10 admin users + leads); the sizing in §6.3 confirmed or corrected.
- [ ] Seed → DB → export round-trip deep-equal; a build from the DB is IDENTICAL to the build from the seed.
- [ ] Old URLs imported as redirects (if the client confirms the replacement).
