# Architecture decisions — Phase 1 (CMS readiness, hosting independence)

| # | Decision | Reason | Alternatives rejected |
|---|---|---|---|
| P1-01 | **Netlify is demo hosting only. Production goes to Host.KZ, and the app has no provider dependency.** Only `netlify.toml` is Netlify-specific. | Client decision; the code must be portable. | Netlify Functions, Blobs or Forms for leads or preview |
| P1-02 | **No third-party CMS.** A custom admin comes later; Phase 1 provides the content model, the `ContentSource` interface and the API contract. | Client decision (supersedes the Sanity/Directus recommendation of the pre-implementation specification). | Sanity, Directus |
| P1-03 | **Content seed JSON is the source of truth** (`src/content/seed`), in the *stored* shape that the future API will return. | One shape from the seed until the database exists. `normalize.ts` and the components never change. | Keeping `src/data/*.ts`; per-locale JSON files |
| P1-04 | **Field-level localization** `{ en, ru, zh, tr, ar, es }` for translatable fields only. Structural values stay typed. | Matches the editing model (one record, six languages) and keeps relations shared. | One record per language (duplicated relations) |
| P1-05 | **Per-record translation status with a source hash.** A language is published only if `approved`; otherwise the whole record falls back to English, with canonical → EN and no hreflang for that language. | Pages are never a mix of languages; untranslated pages create no duplicate-content risk; outdated translations are detectable. | Per-field fallback (mixed pages) |
| P1-06 | **UI strings use stable semantic keys** typed from `en.json`. Content text never uses `t()`. | Editing English no longer orphans translations; UI and content are separated. | English text as dictionary key (legacy) |
| P1-07 | **Pages are fixed records with named text slots, lists and media.** No page builder. | Admins edit text and images but cannot break layouts. Routes and sections stay code-owned. | Block or section builder |
| P1-08 | **Deterministic IDs** (`project-solbar-israel`, …). Relations use IDs; slugs are only for URLs. | IDs survive slug changes and translations, and map 1:1 to future database rows. | Slugs as references (legacy) |
| P1-09 | **Per-language snapshots generated at build time.** English is bundled; other languages are lazy-loaded together with their UI strings. | Same loading behaviour as before; the main bundle grows only slightly (+1.1 % gzip); language chunks are smaller than the old dictionaries. | Shipping the multilingual seed to the browser |
| P1-10 | **Full HTML prerendering at build time** (`entry-server.tsx`: `StaticRouter` + `renderToString`; browser: `hydrateRoot`). No runtime server. | SEO, accessibility, works without JavaScript, deployable to any static host. | Head-only shells (legacy); a runtime server-side-rendering server; switching to Next.js |
| P1-11 | **Inline "motion boot" script** sets `motion-ready` before first paint, with a 4-second safety timer that reveals all content if the app script never loads. | Prerendered content must neither flash nor stay hidden. The animations themselves are unchanged. | Setting classes only in the bundle (flash) |
| P1-12 | **Real 404.** The `/* → /index.html 200` fallback is removed. Every language has its own `404.html`, and the server returns status 404. Not-found documents are client-rendered rather than hydrated. | Removes soft 404s. Unknown project, technology or product slugs keep their own approved "not found" message in the browser. | SPA fallback |
| P1-13 | **Legal pages are architecture only.** The `privacy` and `terms` page records are drafts, so they have no route, no sitemap entry, and the footer keeps opening the inquiry form. They are published once Soltex supplies the text. | No invented legal text. | Placeholder legal pages |
| P1-14 | **`LeadSubmissionService` interface.** `simulatedLeadService` reproduces the demo exactly; the reference number is created on submit. | The future backend (PHP or Node, CRM) plugs in without touching forms. | Netlify Forms or Functions |
| P1-15 | **Media abstraction** (`{ mediaId }` → `MediaAsset`, optional `MEDIA_BASE_URL`). Files and paths are unchanged, and videos stay in git for now. | Admin uploads and storage can come later without component changes. | Moving media now |
| P1-16 | **Build-time validators** `build-snapshots.ts` (content) and `validate-site.ts` (output: SEO, links, assets, redirects, portability, secrets) fail the build. | Content and SEO errors can never reach production unnoticed. | Manual QA only |
| P1-17 | **Unused legacy code and data are kept, not deleted.** They will be cleaned up in a dedicated later task. Two kinds exist (see the table below): files excluded from type checking, and data kept only as migration sources. | No deletions without explicit approval. | Silent deletion |
| P1-18 | **The content seed is source-controlled; only generated output is git-ignored.** See the table below. | The seed is the CMS migration source, the local fallback, the recovery source, the source for a fresh clone and the input of the future custom-admin import. A generated file must never be the only copy of content. | Committing generated snapshots (duplicated content, risk of drift); ignoring the seed |
| P1-19 | **Inquiry topics are language-independent descriptors** (`src/services/leads/topics.ts`): a stable UI key, a page-copy key, or an entity ID + field, with parameters that are themselves entity references. The inquiry dialog resolves the descriptor in the current language on every render, and that resolved text is what goes into the lead payload. | Before, a topic was stored as already-translated text, so it stayed in the old language after a language switch (also while the dialog was open). Stable IDs fit the content architecture; resetting the topic would have lost the visitor's selection. | Resetting the topic on language change; storing translated strings |
| P1-20 | **New 404 strings** (`notFound.badge`, `notFound.title`, `notFound.description`, `notFound.backHome`) are stable UI keys. Their RU/ZH/TR/AR/ES texts were written in Phase 1 and **require client linguistic review**. This is a content-review item, not an architecture blocker. | They are the only UI texts that did not exist before Phase 1. | — |

### P1-18 — Source-controlled vs generated

| Source-controlled (committed) | Generated / git-ignored |
|---|---|
| `src/content/seed/*.json` (content), `src/content/*.ts` (types, adapter, normalizer, getters, routes), `src/content/sources/`, `src/i18n/ui/*.json` (UI strings), `scripts/content/**` (snapshot builder, migration scripts, copy map, migration report), `scripts/prerender.ts`, `scripts/validate-site.ts`, `scripts/qa/**`, `docs/**` | `src/content/snapshot/*.json` (per-language snapshots), `dist/`, `node_modules/`, logs, caches |

**Fresh clone:** run `npm ci`, then `npm run dev`, `npm run lint` or `npm run build`. Each of these first runs `npm run content`, which validates the seed and regenerates the snapshots. Running `vite` or `tsc` directly without it fails loudly with an unresolved `snapshot/en.json` import (see `src/content/snapshot/README.md`); content never silently disappears.

Verified on 2026-10-01:
- `git check-ignore` reports none of the source files as ignored;
- a build from only the files git tracks (no snapshots present) produces all 174 pages and passes `validate-site`.

### P1-17 — Legacy kept for the later cleanup task

| Kept | Status |
|---|---|
| `src/components/{AboutModal,ContactModal,FeaturedProject,FinalCta,IndustriesModal,InsightsModal,MissionDark,SectorsGrid,VideoModal,WhySoltex}.tsx` | Not rendered. **Excluded from type checking** (`tsconfig.json` → `exclude`) only because they are legacy: they use the old English-text `t()` API |
| `src/i18n/dictionaries.ts` | Old dictionary loader, replaced by `src/i18n/bundles.ts`. **Excluded from type checking** for the same reason (it imports the removed `Dictionary` type) |
| `src/i18n/locales/*.json` | Old English-keyed dictionaries. Migration source only, not loaded |
| `src/data/*.ts`, `src/types/index.ts` | Old data and types. Migration source only (`scripts/content/migration/migrate-legacy.ts`), not imported by the site |

The content build's architecture guard (`scripts/content/build-snapshots.ts`) fails the build if any rendered code imports these legacy sources. It skips the files that `tsconfig.json` excludes.
