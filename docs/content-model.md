# Content model

Status: current as of Phase M-1 (commit 959f733)

This document lists the content entities as they are modelled in the code. It does not describe the entities the brief asked for. Sources:
- `packages/core/src/content/store.ts`: stored, multilingual `ContentStore` types;
- `packages/core/src/content/page-registry.ts`: page slots;
- `packages/core/src/content/jsonb.ts`: list schemas;
- `apps/web/src/content/`: resolved types, normalizer, routes;
- `apps/web/src/content/seed/*.json`: seed content.

Tables and columns: [`cms-schema.md`](cms-schema.md). Every record and its texts: [`content-inventory.md`](content-inventory.md). No company facts are stated here. Counts are counts of seed records only.

---

## 1. Overview

The `ContentStore` holds ten collections. It is the format of the seed, of `db:export`, of revisions and of release snapshots.

| Collection | Type | Routable | Editable in admin | Seed records | Seed status |
|---|---|---|---|---|---|
| `pages` | `PageRecord` | 11 page keys (routes) + 3 detail templates | yes: texts, list-item texts, images, SEO | 14 | 12 published; `privacy` and `terms` draft |
| `projects` | `ProjectRecord` | `/projects/:slug` | yes | 8 | all published |
| `technologies` | `TechnologyRecord` | `/technologies/:slug` | yes | 6 | all published |
| `products` | `ProductRecord` | `/products/:slug` | yes | 6 | all published |
| `epcmStages` | `EpcmStageRecord` | no | yes | 8 | all published |
| `patents` | `PatentRecord` | no (listed on home and `/technologies/patents`) | yes | 6 (4 `home`, 2 `registry`) | all published |
| `videos` | `VideoRecord` | no (home video block) | yes | 2 | all published |
| `media` | `MediaRecord` | files only | yes (media library) | 25 (23 images, 2 videos) | — |
| `settings` | `GlobalSettingsRecord` (with `metrics[]`, `offices[]`) | no | **no** (no API or screen yet) | 1 singleton: 5 metrics, 4 offices | — |
| `redirects` | `RedirectRecord` | — | yes («SEO → Редиректы») | 0 | — |

Leads and users are not content. They live only in the database and are never part of the store ([`admin-leads.md`](admin-leads.md), [`admin-auth.md`](admin-auth.md)).

---

## 2. Shared building blocks

| Concept | Definition |
|---|---|
| `Localized<T>` | `{ en, ru, zh, tr, ar, es }`. Used for every translatable field. Structural values are never localized: IDs, slugs, numbers, codes, e-mails, phone numbers, media refs |
| Stable ID | `id` such as `project-solbar-israel`, pattern `^[a-z0-9]+(-[a-z0-9]+)*$`. Stored as `key` in the database. Never changes, never derived from translated text |
| `order` | Display order in its collection (DB `position`) |
| `status` | `draft` \| `published` \| `archived` (§5) |
| `translationStatus` | Per translated locale: `{ status: missing \| in_progress \| approved, approvedSourceHash, approvedAt }` (§4) |
| `slug` | Routable types only. The same in every language (the DB stores it per translation row; export fails if languages differ) |
| `SeoRecord` | `metaTitle`, `metaDescription` (Localized or null = default template), `ogImage` (MediaRef or null), `noindex`. Present on projects, technologies, products and pages with `seo: true` |
| `MediaRef` | `{ mediaId }`, a reference to a `media` record |
| List shapes | `Localized[]` (TextListV1), `{label, value}[]` (LabelValueListV1), `{title, description}[]` (TitleDescriptionListV1) |

---

## 3. Entities

### 3.1 Project (`projects`)

| Field | Type | Notes |
|---|---|---|
| `slug`, `seo`, `status`, `order`, `translationStatus` | shared | |
| `categoryNumber` | string | Display number |
| `category`, `title`, `type`, `overview`, `technology` | Localized | `technology` = short text describing the applied technology |
| `country` | Localized | **Free text** ("location as displayed"), not a reference |
| `years` | Localized | Free text |
| `capacity` | Localized \| null | Free text |
| `scope` | Localized[] | |
| `results` | Localized[] \| null | |
| `specs` | `{label, value}[]` | |
| `image`, `imagePosition` | MediaRef, CSS object-position \| null | |
| `gallery` | MediaRef[] | DB `project_gallery`, ordered |
| `relatedTechnologyId` | technology ID (required) | FK RESTRICT |

### 3.2 Technology (`technologies`)

| Field | Type | Notes |
|---|---|---|
| `slug`, `seo`, … | shared | |
| `categoryNumber` | string | |
| `categoryTitle`, `title`, `subtitle`, `overview` | Localized | |
| `patentInfo` | `{ patentNumber, location, keyPoints[] }` (Localized) \| null | Embedded text. **Not** a reference to a `patents` record |
| `rawMaterials`, `keyAdvantages`, `applications`, `productsProduced` | Localized[] | Free-text lists; `productsProduced` is not a reference to products |
| `processPrinciples` | `{title, description}[]` | |
| `relatedProjectIds` | project IDs, ordered | DB `technology_projects` |
| `image` | MediaRef | |

### 3.3 Product (`products`)

| Field | Type | Notes |
|---|---|---|
| `slug`, `seo`, … | shared | |
| `categoryNumber` | string | |
| `categoryTitle`, `title`, `description`, `productionTechnology` | Localized | |
| `rawMaterials`, `applications`, `characteristics` | Localized[] | `applications` is free text (no industry entity) |
| `relatedTechnologyId` | technology ID (required) | |
| `relatedProjectId` | project ID (required, exactly one) | |
| `image` | MediaRef | |

### 3.4 EPC/EPCM stage (`epcmStages`)

| Field | Type |
|---|---|
| `number` | "01"…"08" |
| `title`, `focus`, `description` | Localized |
| `deliverables` | Localized[] |
| `image` | MediaRef \| null |

There is no separate "Services" entity. The EPCM stages are the service model.

### 3.5 Patent (`patents`)

| Field | Type | Notes |
|---|---|---|
| `placements` | (`home` \| `registry`)[] | Where the record appears. Fields that a placement does not use are null |
| `patentNo` | string | As printed, not translated |
| `title` | Localized | |
| Home-card fields | `legalStatus` (`granted` \| `application` \| null), `statusLabel`, `patentLabel`, `jurisdiction`, `abstract` (Localized \| null), `claimsSummary` (Localized[] \| null) | |
| Registry fields | `registryNumber` (string \| null), `code`, `location`, `overview`, `industrialImplementation`, `imageCaption` (Localized \| null), `keyPillars` (`{title, description}[]` \| null), `image` (MediaRef \| null) | |

Patents have no relation to technologies or projects.

### 3.6 Video (`videos`)

| Field | Type |
|---|---|
| `number` | string |
| `category`, `title`, `headline`, `description` | Localized |
| `video`, `poster` | MediaRef (required) |

Videos are not linked to projects or technologies.

### 3.7 Page (`pages`)

Pages are fixed records with code-defined slots. There is no page builder. The set of pages and their slots is defined in `PAGE_REGISTRY` (`packages/core/src/content/page-registry.ts`), and a test keeps it in sync with the seed.

| Field | Type | Notes |
|---|---|---|
| `key` | `PageRouteKey` \| `TemplateKey` | Routes: `home`, `company`, `globalPresence`, `technologies`, `patents`, `epcm`, `products`, `projects`, `contact`, `privacy`, `terms`. Templates: `projectDetail`, `technologyDetail`, `productDetail` |
| `kind` | `page` \| `template` | |
| `header` | `{ badgeNumber, badgeLabel, title, subtitle, description, meta: {label,value}[], actionLabel }` \| null | Shared page header block |
| `copy` | slot → Localized | Named text slots, in registry order. Some slots have `{placeholders}` that must be kept |
| `lists` | listKey → items | Structured repeatable items. In the seed: `home.heroTags`, `home.keyDirections` (6), `company.capabilities`, `company.timeline` (8). **Only the texts** of these items can be edited; items cannot be added or removed |
| `media` | slot → MediaRef | e.g. `home.heroImage`, `company.provenanceImage`/`hygienicImage`/`epcmImage`, `projectDetail.archiveBandImage`, `technologyDetail.bandImage` |
| `body` | Localized[] \| null | Paragraphs for the legal pages. `null` in the seed |
| `seo` | SeoRecord \| null | null for templates |

The homepage is composed in code: hero, metric ribbon (settings metrics), key directions (page list), EPCM stages, video block, IP section (patents with `home` placement). Section order is not editable.

### 3.8 Global settings (`settings`)

| Field | Type |
|---|---|
| `siteName`, `primaryEmail` | string |
| `footerTagline`, `footerLocation`, `copyright`, `footerBackgroundAlt` | Localized |
| `logo`, `logoReversed`, `footerBackground` | MediaRef |
| `headquarters` | `name`, `addressLine1/2`, `shortAddress`, `jurisdiction`, `hours` (Localized), `email` (string) |
| `metrics[]` | `{ id, value: string \| null, label: Localized (may contain {highlight}), highlight: Localized \| null }` |
| `offices[]` | `{ id, order, region, title, country, address?, representative? (Localized), phone?, email, whatsapp? }` |
| `defaultSeo` | `siteTitle`, `siteDescription` (Localized) |

Settings have a `translationStatus` but no publishing status, no review columns and no revisions. **They cannot be edited in the admin** ([`admin-content.md`](admin-content.md)). Changes go through the seed and `db:import`.

### 3.9 Media (`media`)

| Field | Notes |
|---|---|
| `id`, `kind` (`image` \| `video`), `src`, `width`, `height` | `src` is a site path. Legacy files: `/images/…`, `/videos/…`. Uploads: `/media/originals/<yyyy>/<uuid>.<ext>` |
| `alt` | Localized \| null |
| `variants` | Responsive WebP copies (480/960/1600/2400 px), made by the worker; absent in the seed |

- Allowed upload types: JPEG, PNG, WebP, AVIF, MP4. **No PDF or other document types.**
- Library-only metadata (source, sha256, mime, bytes, original name) is stored in the database but not exported.
- Details: [`admin-media.md`](admin-media.md).

### 3.10 Redirect (`redirects`)

`{ id, from, to, statusCode: 301|302, allLocales }`. Both paths are locale-less and internal. The database adds `source`, `hits` and `version`. See [`admin-seo.md`](admin-seo.md).

---

## 4. Relations

```
Project ──relatedTechnologyId──► Technology ──relatedProjectIds[]──► Project
Product ──relatedTechnologyId──► Technology
Product ──relatedProjectId────► Project
Project ──image, gallery[]────► Media        Technology/Product/EpcmStage/Patent ──image──► Media
Video ──video, poster─────────► Media        Page ──media{slot}, seo.ogImage──► Media
Settings ──logo, logoReversed, footerBackground──► Media
```

- Relations always use IDs, never slugs. In the database they are FKs with `ON DELETE RESTRICT`.
- **Derived at render time, not stored:**
  - the products of a technology: `products.filter(relatedTechnologyId)` on the technology page;
  - patents by placement.
- `Technology.relatedProjectIds` and `Project.relatedTechnologyId` are maintained **independently**. They are not inverse sides of one relation.
- **Not modelled** (compared with the brief): Project → Country, Industry, Product, Services, Video or Documents; Technology → Industries or Patents; Product → Industry.

---

## 5. Publishing states

| Level | States | Effect |
|---|---|---|
| Record (`status`) | `draft` → `published`; `archived` (only from draft); restore → `draft` | Only `published` records go into a release snapshot and the site. Publishing requires the required English fields and published related records ([`admin-publishing.md`](admin-publishing.md)) |
| Live state (derived, admin) | `not_live`, `live`, `live_with_changes` | Compares the record's latest revision with the revision in the active release |
| Release | `queued` → `building` → `validating` → `ready` → `active` → `retired`; `failed`, `superseded` | The site changes only on activation |

Revisions (`content_revisions`) cover the seven admin-managed types: pages, projects, technologies, products, EPCM stages, patents and videos. Settings, media and redirects are not revisioned.

---

## 6. Translations

- **Six locales.** English (`en`) is the source; `ru`, `zh`, `tr`, `ar`, `es` are translations. Locale codes: `packages/core/src/domain/locales.ts`. Adding a language takes a migration plus site configuration ([`i18n-architecture.md`](i18n-architecture.md)).
- **Stored states:** `missing`, `in_progress`, `approved`. The effective state `outdated` is derived: approved against an older `source_revision` of the English text.
  - Saving a translation sets `in_progress`.
  - Approving or reopening needs `content.publish`.
  - Details: [`admin-translations.md`](admin-translations.md).
- **Rendering rule** (`apps/web/src/content/normalize.ts`): a record is shown in locale L only if its L translation is `approved`. Otherwise the **whole record** falls back to English, never a mix. Its canonical points to English, and it is left out of L's hreflang and sitemap.
- **What is translated:**

| Text | Translated? |
|---|---|
| Content fields (`Localized`) | yes |
| UI strings (buttons, labels, 404) | not content: they live in `apps/web/src/i18n/ui/<locale>.json` and are not in the CMS |
| IDs, slugs, numbers, `patentNo`, e-mails, phones | never |

---

## 7. Brief entities not implemented

The brief lists more entities than the code has. The state of each:

| Brief entity | State | What exists (verified) |
|---|---|---|
| **Industries** | **NOT IMPLEMENTED** as an entity | No table, store type or route. Industry-like information appears only as free text: product `applications`, technology `applications`. `apps/web/src/components/IndustriesModal.tsx` and `SectorsGrid.tsx` (data from `apps/web/src/data/soltexData.ts`) hold **hardcoded** sector lists, but no page or component imports them (unused) |
| **Countries / Locations** | **NOT IMPLEMENTED** as an entity | `Project.country` is free Localized text. `settings.offices[]` (4 offices: region, title, country, address, contacts) is the only structured location data. It is rendered on `/company/global-presence` and cannot be edited in the admin. No country table, no project↔country relation |
| **Insights / Articles** | **NOT IMPLEMENTED** | No table, type, route or admin screen. `apps/web/src/components/InsightsModal.tsx` holds hardcoded sample articles and is imported nowhere (unused). Whether its texts are real company content is **UNKNOWN** |
| **Team** | **NOT IMPLEMENTED** | No entity, page list or slot for people. Only generic mentions of "team" inside page copy texts |
| **Documents / PDF library** | **NOT IMPLEMENTED** | `media_kind` is `image` \| `video`. Upload types exclude PDF (DB CHECK and `MEDIA_TYPES`). No document field on any entity. The seed has no PDF references |
| Services | Partial | Modelled as EPC/EPCM stages (§3.4). There is no separate service entity |
| Company information | Partial | `company` and `globalPresence` pages (slots + `capabilities` and `timeline` lists) and `settings` (HQ, metrics, offices). Settings are not editable in the admin |
| Navigation | NOT IMPLEMENTED as content | Navigation is code (`Navbar`, `Footer`) with UI-string labels |
| Contact / Leads | Implemented | Leads are a database-only domain, not content ([`admin-leads.md`](admin-leads.md)). Contact details are in `settings` (not editable in the admin) |

**Legacy hardcoded data:** `apps/web/src/data/soltexData.ts` and `pagesData.ts` still exist.
- `soltexData.ts` is imported only by components that no page renders: `MissionDark`, `SectorsGrid`, `WhySoltex`, `FinalCta`, `FeaturedProject`.
- `pagesData.ts` is imported nowhere.
- Their figures and texts are not part of the content model and must not be treated as verified company facts.
