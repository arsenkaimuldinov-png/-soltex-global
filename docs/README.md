# Documentation index

Status: current as of Phase M-1 (commit 959f733)

**Current** documents describe the code as it is and are kept in sync with it. **Historical** documents record a past state, plan or review. They are kept for reasoning and traceability; where they conflict with a current document, the current one wins.

The Directus / Next.js planning documents of September 2026 are not in the repository. They are archived in the claude.ai project under `docs/archive/` and are superseded (see [`decisions.md`](decisions.md)).

## Start here

| File | Status | Content |
|---|---|---|
| [`architecture.md`](architecture.md) | Current | System overview: apps, packages, data flow, build and publishing |
| [`decisions.md`](decisions.md) | Current | Index of decisions in force, with sources; accepted risks |
| [`admin-guide-ru.md`](admin-guide-ru.md) | Current | Руководство пользователя админки (на русском) для редакторов и администраторов |

## Site: content, routes, SEO, design

| File | Status | Content |
|---|---|---|
| [`content-model.md`](content-model.md) | Current | Content entities, fields and relations as modelled in code |
| [`cms-schema.md`](cms-schema.md) | Current | PostgreSQL schema of the admin / API |
| [`routes.md`](routes.md) | Current | Public site, admin and API routes |
| [`seo.md`](seo.md) | Current | Head tags, hreflang, sitemap, redirects, security headers, checks, known gaps |
| [`design-system.md`](design-system.md) | Current | Colours, type, layout, breakpoints, radius/shadow, imagery; admin styling |
| [`components.md`](components.md) | Current | Component inventory of `apps/web` and `apps/admin`; reuse rules |
| [`motion-system.md`](motion-system.md) | Current | Motion tokens, reveal primitives, page transitions, reduced motion |
| [`design-v1-implementation.md`](design-v1-implementation.md) | Current | Status of Design Direction V1.0 on the site: pass 1 changes and open items |
| [`i18n-architecture.md`](i18n-architecture.md) | Current | Languages, UI strings vs content, translation status and fallback |
| [`i18n-terminology.md`](i18n-terminology.md) | Current | Terminology map for the five translations |
| [`deployment.md`](deployment.md) | Current | Demo (Netlify) vs production (Host.KZ, nginx, releases); build and headers |

## Admin and API (by subsystem)

| File | Status | Content |
|---|---|---|
| [`admin-architecture-approved.md`](admin-architecture-approved.md) | Current (target) | Approved backend / admin architecture (ADR-01…21); source of truth for intent |
| [`admin-architecture-implementation.md`](admin-architecture-implementation.md) | Current | Implementation log per phase (A–M-1) with deviations |
| [`admin-database.md`](admin-database.md) | Current | Database tables, import / export, DB decisions (Phase B) |
| [`admin-auth.md`](admin-auth.md) | Current | Sessions, MFA, roles, permissions, audit (Phase C) |
| [`admin-ui.md`](admin-ui.md) | Current | Admin stack, API contract, routes, dashboard, ⌘K (Phases D, L) |
| [`admin-content.md`](admin-content.md) | Current | Content editors and write rules (Phase E) |
| [`admin-translations.md`](admin-translations.md) | Current | Translation workflow (Phase F) |
| [`admin-publishing.md`](admin-publishing.md) | Current | Revisions, releases, preview, rollback (Phase G) |
| [`admin-seo.md`](admin-seo.md) | Current | SEO checker, redirects, address changes, nginx fallback (Phase I) |
| [`admin-media.md`](admin-media.md) | Current | Media library, responsive copies, image checks (Phase J) |
| [`admin-leads.md`](admin-leads.md) | Current | Lead intake, protection, notifications, site forms, attribution (Phase K) |
| [`admin-security-asvs.md`](admin-security-asvs.md) | Current | OWASP ASVS 4.0.3 L2 review, ZAP scan, open security points (Phase M-1) |

## Historical

| File | Status | Content |
|---|---|---|
| [`decisions-phase1.md`](decisions-phase1.md) | Historical (still referenced) | Phase 1 decisions P1-01…P1-20; indexed in `decisions.md` |
| [`admin-architecture-review.md`](admin-architecture-review.md) | Historical | Architecture review before approval (2026-10-02); valid where the approved document does not override it |
| [`custom-admin-architecture.md`](custom-admin-architecture.md) | Historical | Phase 1 design-only integration contract for a future admin; superseded by the implemented admin |
| [`content-inventory.md`](content-inventory.md) | Historical | Phase 1 inventory of every rendered text and where it moved |
| [`phase-1-baseline.md`](phase-1-baseline.md) | Historical | Regression baseline before the Phase 1 refactor (c685d32) |
| [`qa-pre-presentation.md`](qa-pre-presentation.md) | Historical | Pre-presentation QA of 2026-09-26 |
| [`copy-audit.md`](copy-audit.md) | Historical | English copy audit (report only); open fact conflicts V1–V17 still unresolved |
| [`project-image-mapping.md`](project-image-mapping.md) | Historical | Evidence for the project image assignments (2026-09-25) |
