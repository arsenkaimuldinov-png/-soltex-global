# Custom admin — architecture and integration contract

**Status: design only.** No admin, backend, API or database exists yet. This document describes how a future custom admin connects to the frontend that Phase 1 prepared. The connection should need **no changes to page components**.

```
Custom Admin UI ──► Backend API ──► Database (+ media storage)
                          │
                build-time content export (ContentStore JSON)
                          ▼
     scripts/content/build-snapshots.ts  (validate → per-language snapshots)
                          ▼
     Vite build + prerender → static dist/ → web server (Host.KZ)
```

The public site **never calls the backend at run time**. Content reaches it only through a rebuild. The one exception is the lead form, which POSTs to the lead endpoint.

## 1. Current frontend content model

| Layer | Location | Role |
|---|---|---|
| Stored content (multilingual) | `src/content/seed/*.json` | Source of truth today. Shape = `ContentStore` (`src/content/types.ts`) |
| Content source | `src/content/source.ts`, `src/content/sources/seed.ts` | `ContentSource.loadStore(): Promise<ContentStore>`. The admin adds a second implementation |
| Normalizer | `src/content/normalize.ts` | `ContentStore` → `ContentSnapshot` for one language (fallback, media URLs, publishing filter) |
| Snapshots (generated) | `src/content/snapshot/<locale>.json` | What the app bundles: resolved content of one language |
| Getters / hooks | `src/content/getters.ts`, `useContent()`, `usePage()` | The only API components use |
| Route map | `src/content/routes.ts` | URL patterns (code-owned) plus published slugs |
| UI strings | `src/i18n/ui/<locale>.json` | Stable keys, code-owned |

## 2. Entities

`Page` (pages and detail-page templates), `Project`, `Technology`, `Product`, `EpcmStage`, `Patent`, `Video`, `Media`, `Redirect`, `GlobalSettings` (with nested `metrics[]`, `offices[]`, `headquarters`, `defaultSeo`).

`Lead` and `User` are backend-only and are never part of the content store. Field-level definitions live in `src/content/types.ts`. A record-by-record inventory is in `docs/content-inventory.md`.

## 3. Stable IDs

- Every record has a deterministic ID that never changes and never depends on translated text: `project-solbar-israel`, `technology-pectin`, `product-inulin-fos`, `epcm-stage-03`, `patent-bg-66235-b1`, `video-epcm-standards`, `media-projects-solbar-israel`, `page-home`, `office-02`.
- The pattern is `^[a-z0-9]+(-[a-z0-9]+)*$`; the content build rejects anything else.
- The database may use its own surrogate keys internally, but the API **must expose these IDs unchanged**. New records get new IDs, for example `project-<slug-at-creation>`, which stay fixed even if the slug later changes.
- `slug` is only a URL concern. Changing it must create a redirect (see §11).

## 4. Relations (by ID)

| From | Field | To |
|---|---|---|
| Project | `relatedTechnologyId` | Technology |
| Technology | `relatedProjectIds[]` | Project |
| Product | `relatedTechnologyId`, `relatedProjectId` | Technology, Project |
| any | `image`, `gallery[]`, `poster`, `video`, `logo…` (`{ mediaId }`) | Media |

The content build fails on a relation that points to a missing or unpublished record. The admin should prevent such relations, or warn, before publishing.

## 5. Multilingual structure

- **Languages:** `en` (source), `ru`, `zh`, `tr`, `ar` (RTL), `es`. URL prefixes are unchanged, there are no localized slugs, and there are no IP redirects.
- **Translatable fields** are stored as `{ en, ru, zh, tr, ar, es }`. Structural fields stay plain values.
- **Translation workflow:** every entity has `translationStatus.<locale> = { status: missing | in_progress | approved, approvedSourceHash, approvedAt }`.
  - An entity is published in a language **only if that language is `approved`**. Otherwise the whole entity falls back to English: it gets `contentLocale: 'en'`, its canonical points to the English URL, and it is left out of that language's hreflang and sitemap. Pages are never a mix of languages.
  - `approvedSourceHash` is a hash of the English fields at approval time (`scripts/content/lib/source-hash.ts`). When the English text changes, the build reports the translation as outdated, and the admin should show this.
- **Placeholders:** text may contain `{name}` placeholders and `\n` line breaks. Every language must keep the same placeholders; the build enforces this.

## 6. SEO structure

- **Routable records** (pages, projects, technologies, products) have `seo = { metaTitle, metaDescription, ogImage, noindex }`. Every field is optional.
- **Defaults** are frontend-owned (`src/i18n/seo.ts`):
  - title = `"{H1} | Soltex Global"`;
  - description = the header description or overview, shortened to whole sentences.
- The frontend owns canonical, hreflang, the sitemap and the robots meta tag. The admin cannot set a canonical URL; this is deliberate.
- `noindex` should be editable only by an SEO/admin role. `validate-site` flags any unexpected noindex.

## 7. Media structure

- `Media = { id, kind: image|video, src, width, height, alt }`.
- `src` is a site-relative path today (`/images/...`, `/videos/...`). Later it can be an absolute storage or CDN URL, or the build can prefix it with `MEDIA_BASE_URL`.
- Components only receive a resolved `{ src, width, height, alt }`.
- Uploads need the following validation: allowed types (jpg, png, webp, mp4, pdf), a maximum size, measured dimensions, and **alt text** for content images.
- The current files stay in `/public` until a media migration is approved. Videos are not moved in Phase 1.

## 8. Future API contract (read; documentation only — nothing is implemented)

All endpoints are read by the **build** (server-to-server) with a read-only token, never by browsers. Responses use the **stored** shape (`*Record` types, multilingual, including `status` and `translationStatus`), so `normalize.ts` is reused unchanged.

| Method & path | Returns |
|---|---|
| `GET /api/content/pages/:routeKey` | `PageRecord` |
| `GET /api/content/pages` | `PageRecord[]` (pages and templates) |
| `GET /api/content/projects` | `ProjectRecord[]` |
| `GET /api/content/projects/:slug` | `ProjectRecord` |
| `GET /api/content/technologies` · `/:slug` | `TechnologyRecord[]` · `TechnologyRecord` |
| `GET /api/content/products` · `/:slug` | `ProductRecord[]` · `ProductRecord` |
| `GET /api/content/epcm` | `EpcmStageRecord[]` |
| `GET /api/content/patents` | `PatentRecord[]` |
| `GET /api/content/videos` | `VideoRecord[]` |
| `GET /api/content/media` | `MediaRecord[]` |
| `GET /api/content/settings` | `GlobalSettingsRecord` |
| `GET /api/content/redirects` | `RedirectRecord[]` |
| `GET /api/content/export` | the complete `ContentStore` in one response (preferred for builds) |

- Query `?status=published` returns the publishable view. The build may also request everything and filter, because the normalizer only keeps `published` records.
- Integration point: add `src/content/sources/custom-admin.ts`, which implements `ContentSource.loadStore()` by calling `/api/content/export`, and register it in `scripts/content/build-snapshots.ts`. Select it with `CONTENT_SOURCE=admin` plus `CONTENT_API_URL` and `CONTENT_API_TOKEN` (build-time only).

## 9. Future lead API contract (documentation only)

`POST /api/leads` (called from the browser by the forms through `LeadSubmissionService`).

```json
{
  "formType": "cta_section | inquiry_modal | contact_page",
  "fields": { "name": "…", "phone": "…", "email": "…", "company": "…", "message": "…" },
  "topic": "string | null",
  "locale": "en | ru | zh | tr | ar | es",
  "pagePath": "/projects/solbar-israel",
  "antiSpam": { "token": "…", "honeypot": "", "elapsedMs": 5230 }
}
```

| Response | Meaning |
|---|---|
| `201 { "reference": "SOL-4821" }` | success |
| `422 { "error": "validation", "fields": { … } }` | invalid input |
| `429 { "error": "rate_limited" }` | too many requests |
| `5xx` | server error |

- Server-side requirements: validation, honeypot plus time check plus rate limiting plus a CAPTCHA-type check (to be chosen), storage in the `leads` table, e-mail notification, retention policy, and an access log.
- Frontend switch: implement `createHttpLeadService()` in `src/services/leads/` and select it in `src/services/leads/index.ts`. Form components do not change.
- Today `simulatedLeadService` reproduces the approved demo behaviour and **sends nothing**.

## 10. Expected CRUD operations (admin)

| Section | Operations |
|---|---|
| Dashboard | pending reviews, outdated translations, recent leads, last build status |
| Pages | edit header, text slots, lists and images of fixed pages. **Pages cannot be created or deleted**, and no section builder exists, because routes and layouts are code-owned. Legal pages: edit and publish |
| Projects / Technologies / Products | create, edit, reorder, publish/unpublish, archive (with redirect), manage relations and images |
| EPCM | edit the eight stages (fixed count unless the design changes), reorder |
| Patents | create, edit, assign placements (`home`, `registry`), publish |
| Media | upload, replace, edit alt text, see where it is used, block deleting media that is still in use |
| Videos | edit texts, poster and file reference |
| Redirects | create, edit, delete (validated: no loops or chains, never over a live URL) |
| SEO | per-record SEO fields; noindex for the SEO role only |
| Languages | per-record translation status, side-by-side English/target editor, outdated flags |
| Global settings | contacts, offices, metrics, footer texts, logos |
| Leads | list, view, export, status, retention/deletion (GDPR-style requests) |

## 11. Draft / publish concept

- `status`: `draft` → `published` → `archived`. Only `published` is built.
- Editing a published record should create a draft version, so the live content does not change until the next publish and rebuild. Publishing triggers a rebuild and deploy, ideally debounced so that a batch of publishes produces one build.
- Slug change: keep the old slug and create a 301 redirect `old → new` in every language automatically.
- Archive: removes the page and creates a 301 to the listing page, or to a chosen target.
- Rollback: restore a previous record version and rebuild. The previous static build can also be redeployed directly.

## 12. Authentication boundary

- The admin and API live on a separate host or path (for example `admin.soltexglobal.co`) and are never linked from the public site.
- Admin users need individual accounts and a 2FA requirement; there are no shared logins. Roles: Administrator, Editor, Translator, SEO, Sales (leads only), Viewer.
- **Build tokens** are read-only and server-side only. **The public site has no credentials at all.** `validate-site` fails the build if token-like strings appear in `dist/`.
- The lead endpoint is the only public write endpoint. It must have rate limiting and abuse protection.

## 13. Future database mapping (database engine to be decided after the Host.KZ plan)

| Table | Key columns | Notes |
|---|---|---|
| `pages` | id, key (unique), kind, status, order, header_* fields, seo_* | fixed set of rows |
| `page_copy` | page_id, key, (translatable) | text slots |
| `page_list_items` | page_id, list, position, data (JSON) | structured lists |
| `projects` | id, slug (unique), status, order, category_number, image_id, image_position, related_technology_id, seo_* | |
| `project_scope`, `project_results`, `project_specs`, `project_gallery` | project_id, position, … | ordered child rows |
| `technologies` | id, slug, status, order, category_number, image_id, patent_number_*, … | children: raw_materials, principles, advantages, applications, outputs |
| `technology_projects` | technology_id, project_id, position | M:N |
| `products` | id, slug, status, order, category_number, image_id, related_technology_id, related_project_id | children: raw_materials, applications, characteristics |
| `epcm_stages` | id, number, order, image_id | child: deliverables |
| `patents` | id, placements, patent_no, legal_status, registry_number, image_id | children: claims, key_pillars |
| `videos` | id, number, order, video_media_id, poster_media_id | |
| `media` | id, kind, src/storage_key, width, height, mime, size, checksum | + `media_alt` translations |
| `redirects` | id, from_path (unique), to_path, status_code, all_locales | |
| `global_settings` | single row + `offices`, `metrics` tables | |
| `translations` | entity_type, entity_id, field, locale, value | **or** one `<table>_translations` table per entity (choose with the DB) |
| `translation_status` | entity_type, entity_id, locale, status, approved_source_hash, approved_at | |
| `leads` | id, reference, form_type, fields…, topic, locale, page_path, created_at, status, retention_until | never exported to the site |
| `users`, `roles`, `audit_log`, `content_versions` | | admin only |

## 14. Migration path: seed JSON → database

1. Create the schema.
2. Import `src/content/seed/*.json` with a one-off importer, preserving IDs, order, `translationStatus` and media paths. The importer is the inverse of the export endpoint.
3. Implement `GET /api/content/export`, then verify that the export is **deep-equal to the seed JSON**.
4. Add the `custom-admin` content source and build with `CONTENT_SOURCE=admin`. The Phase 1 regression suite (`scripts/qa/`) must report **IDENTICAL** compared with the seed build.
5. Freeze the seed. From then on the database is the source of truth, and the seed JSON remains as a fallback snapshot.

## 15. What remains frontend-owned (code)

- Layout and components, design tokens (green and beige), typography, motion system and RTL behaviour.
- Route patterns and URL structure, the language list, and SEO templates (title/description defaults, canonical, hreflang, sitemap, robots).
- UI strings: navigation, buttons, form labels and messages, accessibility labels and badges.
- Icons for metrics, EPCM stages, capabilities, technology cards and patents, which are mapped by ID or position. Section order and which sections a page has; there is no page builder.
- Form fields and validation (UX), lead service selection, and hosting configuration.

## 16. What becomes admin-owned

- All entity content: projects, technologies, products, EPCM stages, patents and videos.
- Page header texts, text slots, lists and images; legal page texts.
- Global settings: contacts, offices, metrics, footer texts, logos and SEO defaults.
- Media library and alt texts; SEO overrides; redirects; translation status; publishing.
- Leads, which are read and managed in the admin and never rendered on the site.
