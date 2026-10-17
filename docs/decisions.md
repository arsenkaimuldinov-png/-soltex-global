# Decision index

Status: current as of Phase M-1 (commit 959f733)

This is the index of decisions that hold for the current code base. The full reasoning stays in the source documents linked in the last column; this file does not repeat or change it.

**Archived log.** The earlier decision log from the Directus / Next.js planning stage (D-001 … D-029, September 2026) is archived in the claude.ai project as `docs/archive/decisions-2026-09-directus.md`.
- It is **superseded wherever it conflicts** with this index: no Directus, no Next.js, no ISR (P1-02, ADR-09).
- Its brand and visual decisions were checked against the code. Only those the code agrees with are listed in §8 as still in force.

**Precedence:**
1. Later phase over earlier phase.
2. `admin-architecture-approved.md` over `admin-architecture-review.md`.
3. A listed deviation over the approved architecture it deviates from.

---

## 1. Phase 1: content architecture and hosting independence (2026-10-01)

Source: [`decisions-phase1.md`](decisions-phase1.md).

| ID | Decision | Why |
|---|---|---|
| P1-01 | Netlify is demo hosting only; production on Host.KZ; no provider dependency | Client decision; portability |
| P1-02 | No third-party CMS; custom admin | Client decision (supersedes Sanity / Directus) |
| P1-03 | Content seed JSON in the stored shape is the source of truth until the database | One shape from seed to DB |
| P1-04 | Field-level localization `{en, ru, zh, tr, ar, es}` for translatable fields only | One record, six languages, shared relations |
| P1-05 | Per-record translation status with source hash; unapproved language falls back to English (canonical → EN, no hreflang) | No mixed-language pages, no duplicate content |
| P1-06 | UI strings use stable semantic keys; content never uses `t()` | Editing English does not orphan translations |
| P1-07 | Pages are fixed records with text slots, lists and media; no page builder | Editors cannot break layouts |
| P1-08 | Deterministic IDs; relations by ID; slugs only for URLs | IDs survive slug changes |
| P1-09 | Per-language snapshots at build time; English bundled, others lazy | Small bundles |
| P1-10 | Full HTML prerendering; no runtime server | SEO, works without JS, any static host |
| P1-11 | Inline motion boot script with a 4 s safety timer | No flash, never hidden content |
| P1-12 | Real 404 per language; no SPA fallback | No soft 404s |
| P1-13 | Legal pages are drafts until Soltex supplies text | No invented legal text |
| P1-14 | `LeadSubmissionService` interface; demo service by default | Backend plugs in without touching forms |
| P1-15 | Media abstraction `{ mediaId }` | Storage can change without component changes |
| P1-16 | Build-time validators fail the build | Content and SEO errors never ship |
| P1-17 | Legacy code kept, excluded from type checking, guarded against imports | No deletions without approval |
| P1-18 | Seed is source-controlled; snapshots and `dist/` are generated | A generated file is never the only copy |
| P1-19 | Inquiry topics are language-independent descriptors | Topic follows a language switch |
| P1-20 | New 404 strings need client linguistic review | Only UI texts written in Phase 1 |

## 2. Approved admin / backend architecture (2026-10-02)

Source: [`admin-architecture-approved.md`](admin-architecture-approved.md) §1. Review decisions not restated there stay valid ([`admin-architecture-review.md`](admin-architecture-review.md) §0).

| ID | Decision | Current status |
|---|---|---|
| ADR-01 | Modular monolith: one API process plus one worker | In force |
| ADR-02 | Node.js 24 LTS | **Not yet:** the repo runs Node 22 (`.nvmrc`), deviations A-1 / C-1 / D-9 |
| ADR-03 | Fastify 5 | In force |
| ADR-04 | PostgreSQL 17 | In force (DB-1) |
| ADR-05 | Drizzle ORM with reviewed SQL migrations | In force |
| ADR-06 | Zod as the single schema source (validation, types, OpenAPI) | In force |
| ADR-07 | pg-boss job queue | **Superseded by G-1 / K-2:** the releases and outbox tables are the queues, with advisory locks |
| ADR-08 | React + Vite admin SPA in Russian | In force |
| ADR-09 | Static public site, rebuilt on publish; no SSR / ISR | In force |
| ADR-10 | Immutable releases, atomic symlink switch, rollback without rebuild | In force ([`admin-publishing.md`](admin-publishing.md)) |
| ADR-11 | Preview = the same frontend built from the working copy | In force |
| ADR-12 | Revisions as full snapshots; restore = new revision | In force |
| ADR-13 | RBAC with fixed roles and permissions in code | In force |
| ADR-14 | One SEO checker in `packages/core` for admin, API and build | In force |
| ADR-15 | Media library behind a storage interface | In force |
| ADR-16 | Leads with spam protection, notification, retention, anonymization | In force; site forms switched off until legal texts are confirmed (K-1) |
| ADR-17 | Append-only audit log | In force (DB-11: triggers) |
| ADR-18 | Backups (pgBackRest, dumps, restic) | Phase N, not implemented |
| ADR-19 | Host.KZ-compatible VPS (Ubuntu, nginx, systemd, PostgreSQL) | In force (`deploy/nginx`) |
| ADR-20 | Own session auth (Argon2id, WebAuthn, TOTP), MFA by permission, ASVS L2 target | In force; reviewed in [`admin-security-asvs.md`](admin-security-asvs.md) |
| ADR-21 | Monorepo: `apps/web`, `apps/admin`, `apps/api`, `packages/core` | In force |
| Deferred | Not in v1: page builder, form builder, CRM, AI features, localized slugs, scheduled publishing, custom roles, review workflow UI, SSR/ISR, Redis, Elasticsearch, microservices | approved §1 |
| R0-2 | The site never calls the API at render time (only redirects lookup and lead POST) | review §0 |
| R0-12 | Rich text, if needed, as whitelisted structured JSON, never raw HTML (no editor installed today) | review §0; admin-ui §1 |
| R0-d1 | Slugs identical across languages | review §0 "disagreements" 1 |
| R0-d3 | Canonical computed, no free-form field | review §0 "disagreements" 3 |
| R0-d5 | UI strings stay in code, not in the CMS | review §0 "disagreements" 5 |

## 3. Database (Phase B)

Source: [`admin-database.md`](admin-database.md) §4.

| ID | Decision |
|---|---|
| DB-1 | PostgreSQL 17; nothing 17-specific used |
| DB-2 | UUIDv7 generated by the application |
| DB-3 | Slug in the translation row, identical in all languages |
| DB-4 | `page_translations.copy` is an ordered array `[{slot, text}]` |
| DB-5 / B-1 | `page_list_items.structure` is `json`, not `jsonb` (key order is content) |
| DB-6 | Fixed-shape JSONB re-read through Zod for canonical key order |
| DB-7 | Media and redirects exported sorted by key / path |
| DB-8 | Import never deletes |
| DB-9 | Translation statuses `missing` / `in_progress` / `approved`; `outdated` derived |
| DB-10 | Secrets stored only as hashes or ciphertext |
| DB-11 | Audit log protected by triggers |
| DB-12 | Users are disabled, never hard-deleted |
| B-2 | `schema_version` per table |

## 4. Phase deviations still in force

Source: [`admin-architecture-implementation.md`](admin-architecture-implementation.md), plus the phase docs named. Resolved deviations (A-3, D-2, D-3, D-4, E-5, J-1, I-2, I-6) are omitted.

| ID | Decision | Why | Where |
|---|---|---|---|
| A-1, C-1, D-9 | Node.js stays 22 | No runtime migration inside feature phases | implementation log |
| A-2, C-9, D-1 | `node:test` instead of Vitest; Playwright as a QA tool, not a dependency | No extra test runner | implementation log |
| A-4 | `@source inline("outline text-wrap")` in `apps/web/src/index.css` | Byte-identical site CSS after the move to the monorepo | implementation log |
| C-2 | No `SESSION_SECRET`; opaque tokens hashed in DB | Nothing is signed | implementation log |
| C-3 | TOTP via otplib v13 | Maintained, RFC 6238 | implementation log |
| C-5 | Session cookie `__Host-soltex_session`, `Path=/` | Required by `__Host-` | implementation log |
| C-6 | Rate limits in memory; per-account counters in PostgreSQL | One API process, no Redis | implementation log |
| C-7, D-7 | Users created by Owner/Admin with an initial password | No invitation e-mail yet | implementation log |
| C-8 | First factor can be enrolled right after the password | New users have no factor | implementation log |
| C-10 | `audit_events` not partitioned | Tiny volume | implementation log |
| D-5 | Admin CSP `style-src 'unsafe-inline'` | Radix inline positioning styles | implementation log |
| D-6 | Reset link `…/reset-password#token=…` | Token stays out of logs and Referer | implementation log |
| D-8, E-7 | No admin performance budget; screens lazy-loaded | Internal desktop tool | implementation log |
| E-4 | Page lists: edit item texts only, no add / remove / reorder | Items are tied to fixed layouts | [`admin-content.md`](admin-content.md) |
| F-1 … F-8 | Translation limits (approval via `content.publish`, `outdated` derived, no localized slugs or MT) | See source | [`admin-translations.md`](admin-translations.md) §9 |
| G-1 … G-7 | Releases table as job queue; no pruning; no post-rollback hold; preview needs a build | No new dependency | [`admin-publishing.md`](admin-publishing.md) §9 |
| I-1 … I-10 | SEO computed per request; no alt check; query string not carried; external redirect targets deferred | See source | [`admin-seo.md`](admin-seo.md) §7, §11 |
| J-2 … J-10 | Media: contextual alt texts; no PDFs; no video transcoding; WebP copies only; `srcset` on content images | See source | [`admin-media.md`](admin-media.md) §8, §12 |
| K-1 … K-9 | Leads: site forms off until legal texts (B3); outbox via worker; no CAPTCHA; attribution off | See source | [`admin-leads.md`](admin-leads.md) §9 |
| L-1 … L-5 | Search by `ILIKE`; backups shown «Не настроены»; SEO numbers computed per load | See source | implementation log, Phase L |

## 5. Phase M-1: security review (2026-10-17)

Sources: [`admin-security-asvs.md`](admin-security-asvs.md), implementation log, Phase M-1.

| ID | Decision | Why | Code |
|---|---|---|---|
| M1-S1 | Session lifetime: **absolute 12 hours**, **idle 8 hours**. Supersedes "absolute 7 days" in approved §7 | ASVS 3.3.2 (L2) | `apps/api/src/auth/sessions.ts` (`ABSOLUTE_TIMEOUT_MS`, `IDLE_TIMEOUT_MS`) |
| M1-S2 | Initial passwords set by an Owner/Admin are temporary: **changed at first sign-in** (right after the second factor), and **expire after 7 days** | ASVS 2.3.1 | `apps/api/src/auth/login.ts` (`INITIAL_PASSWORD_TTL_MS`); admin `/change-password` |
| M1-S3 | A new password must differ from the current one | ASVS 2.3.1 | `apps/api/src/auth/passwords-flow.ts` |
| M1-S4 | Opening a lead is audited (`lead.view`) | ASVS 8.3.5 | admin-security-asvs §1 |
| M1-S5 | Public site CSP: one text in core (`SITE_CSP`) and nginx; inline boot script allowed by hash; lint check | ASVS 14.4.3 | `packages/core/src/domain/site-security.ts`, `scripts/check-site-csp.mjs` |
| M1-S6 | nginx TLS 1.2 / 1.3 only (Mozilla intermediate) | ASVS 9.1 | `deploy/nginx/soltexglobal.conf` |
| M1-S7 | SMTP to another host requires STARTTLS, TLS 1.2+ | ASVS 9.2 | admin-security-asvs §1 |
| M1-S8 | `sql.raw` review gate in `npm run lint` | ASVS 5.3.4 | `scripts/check-sql-raw.mjs` |
| M-1 | **Accepted:** no antivirus scan of uploads | Images are re-encoded; videos only from staff; ClamAV optional in Phase N | open point S-1 |
| M-2 | **Accepted:** no breach-corpus password lookup; local common-password list | No third-party calls | S-5 |
| M-3 | **Accepted risk:** `style-src 'unsafe-inline'` on admin (Radix, D-5), site (React `style` attributes) and preview. Scripts stay `'self'` (+ one hash) | ZAP alert 10055, Medium | admin-security-asvs §3 |
| M-4 | ZAP ran on loopback in development mode | Phase N repeats it on the real host | implementation log |
| M1-P | **Accepted partial:** Google Fonts stylesheet without SRI | Dynamic stylesheet | ASVS 14.2.3 |

## 6. Design pass 1 (2026-10-02)

Source: [`design-v1-implementation.md`](design-v1-implementation.md).

| ID | Decision |
|---|---|
| DV-1 | Hero without adjective tag row; headline in one colour |
| DV-2 | Stat band without pictograms; figures never animated |
| DV-3 | Technology cards with index numbers, no botanical icons, no hover shadow |
| DV-4 | EPCM strip: numbered circle nodes joined by hairlines; circles only as nodes / markers, never as icon containers |
| DV-5 | Patent cards as records, no illustrations |
| DV-6 | Section headings start-aligned |

**Open:**
- the typography pass (sentence case);
- technology photography and hierarchy;
- footer ground;
- inner-page cleanup;
- which logo rule set is current (D-006 "radius 0, no exceptions" vs the current brief).

## 7. Motion

Source: [`motion-system.md`](motion-system.md).

One easing, transform / opacity / clip-path only, one IntersectionObserver, View Transitions for page changes, reduced-motion respected, content never gated on JS.

## 8. Archived (Directus-era) decisions checked against the code

| Archived ID | Decision | Status in code |
|---|---|---|
| D-004 | Client-supplied logo is the source of truth, never redrawn | **In force.** The site renders the supplied 1280 × 440 raster (`/images/soltex-global-logo*.png`) as `<img>` from settings |
| D-005 | Favicon from the symbol | **In force (partial):** `.ico`, PNG 16 / 32 / 180 / 192 / 512 and maskable 512 exist. No 48 px PNG, no 1200 × 630 OG image |
| D-002 | IA: Technology / Product / EPCM as separate axes; `/company`, `/technologies`, `/epcm` | **Routes in force.** The planned 301s (`/services`, `/tech`, `/about`) do not exist (`redirects.json` is empty) |
| D-003 | No global site search | **In force.** The planned `/products` type-ahead is not implemented |
| D-011 | Publish states `draft → published → archived` | **In force** (`PublishStatus` in `packages/core/src/content/store.ts`). The planned 410 for archived records is not implemented |
| D-017 | Navigation is code, not CMS content | **In force** (`NAVIGATION_PAGES` in `@soltex/core/seo`) |
| D-006 | Radius 0, no exceptions | **Not in force as written:** square buttons and cards, but circles as markers (DV-4). Open |
| D-007 | Source Serif 4 / Archivo / IBM Plex Mono | **Not in force:** the site uses Plus Jakarta Sans, JetBrains Mono and system serif / mono stacks ([`design-system.md`](design-system.md) §2) |
| D-008 | Measured logo palette (`#06452A`, gold `#B89863` / `#7E5F24` / `#C4A87A`) | **Not in force:** the code uses `#0E482C` and golds `#B89758` / `#BA9B60` / `#D4B982` |
| D-013 | Products as schema.org `TechArticle` | **Not implemented:** no JSON-LD at all ([`seo.md`](seo.md) §2) |
| D-016 | Leads not stored in the CMS | **Superseded** by ADR-16 (leads in the database, own admin section) |
| D-015, D-018, D-022, D-023, D-029, … | Directus- and Next.js-specific mechanics | **Superseded** by P1-02, ADR-09 |

## 9. Open client decisions

Approved §21–§22:
- hosting plan;
- off-site backups and dead-man's switch;
- lead retention and consent checkbox;
- attribution legal basis;
- MFA for the Editor role;
- staging;
- old-site redirect import;
- key escrow holders;
- legal page texts;
- SMTP sender.

Also the content conflicts registered in `copy-audit.md` and the project's `CONTENT-TRUTH.md`.
