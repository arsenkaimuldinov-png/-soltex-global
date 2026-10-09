# Content management (Phase E)

**Architecture:** [`admin-architecture-approved.md`](admin-architecture-approved.md) §3, §8, §16, §17; review §G (content model), §H (translations), §J (SEO), §X (admin UX).
**Builds on:** [`admin-database.md`](admin-database.md) (Phase B tables, unchanged), [`admin-auth.md`](admin-auth.md) (sessions, RBAC, audit), [`admin-ui.md`](admin-ui.md) (admin shell).
**Code:**
- API: `apps/api/src/content/cms/` (`collections.ts`, `fields.ts`, `service.ts`, `pages.ts`) and `apps/api/src/routes/content.ts`;
- admin: `apps/admin/src/features/content/`;
- core: `@soltex/core/content` `PAGE_REGISTRY`, `@soltex/core/seo` slug rules and SEO guidance.

Phase E lets the team edit the existing content through the admin: 7 pages and templates of fixed structure plus six collections. It adds **no database migration** and changes nothing in the public site.

---

## 1. Scope

| Entity | List | Read | Create | Update | Archive / restore | Delete |
|---|---|---|---|---|---|---|
| Pages (11 pages + 3 detail-page templates) | ✓ | ✓ | — the page set is code-owned | ✓ texts, images, SEO | — | — |
| Projects | ✓ | ✓ | ✓ draft | ✓ | drafts | — |
| Technologies | ✓ | ✓ | ✓ draft | ✓ | drafts | — |
| Products | ✓ | ✓ | ✓ draft | ✓ | drafts | — |
| EPC / EPCM stages | ✓ | ✓ | ✓ draft | ✓ | drafts | — |
| Patents | ✓ | ✓ | ✓ draft | ✓ | drafts | — |
| Videos | ✓ | ✓ | ✓ draft | ✓ | drafts | — |

- **No hard delete.** Review §G: "Archive" by default; permanent deletion is Admin-only with a typed confirmation and a usages check, so it is not part of Phase E.
- **Status in Phase E:**
  - creating makes a `draft`;
  - a draft can be archived and restored to `draft`;
  - publishing and unpublishing belong to the publishing system (Phase G, [`admin-publishing.md`](admin-publishing.md)): the editor header has «Отметить к публикации» / «Снять с публикации» for `content.publish`; they change the working copy only, the site follows with the next release. A `published` record is edited (its working copy, §6) but not archived here;
  - an archived record is read-only until it is restored.

---

## 2. API

All routes are under `/api/v1`, declared in OpenAPI 3.1 (`apps/api/openapi.json`, tag `content`). They follow every Phase C rule: session, second factor, CSRF header, RFC 9457 problems with `request_id`, rate limits, no CORS.

| Method and path | Access | Notes |
|---|---|---|
| `GET /content/{collection}` | `content.read` | `q` (source-language title, slug, key; LIKE wildcards escaped), `status`, `sort` (`position` · `title` · `updated`), `limit` ≤ 100, `offset` → `{items, total}` |
| `GET /content/{collection}/{id}` | `content.read` | typed source-language fields; `ETag: "<version>"` |
| `POST /content/{collection}` | `content.edit` | creates a draft; 201 + ETag |
| `PATCH /content/{collection}/{id}` | `content.edit` **or** `seo.edit`, then per field | only changed fields; **`If-Match` required** |
| `POST /content/{collection}/{id}/archive` | `content.edit` | draft → archived; `If-Match` |
| `POST /content/{collection}/{id}/restore` | `content.edit` | archived → draft; `If-Match` |
| `GET /content/pages` | `content.read` | 14 fixed pages and templates |
| `GET /content/pages/{id}` | `content.read` | header, copy slots, list item texts, images, body, SEO |
| `PATCH /content/pages/{id}` | `content.edit` or `seo.edit`, then per field | `If-Match` required |
| `GET /content/media` | `media.read` | existing files for pickers (`kind`, `q`); read-only |

`{collection}` is one of `projects`, `technologies`, `products`, `epcm-stages`, `patents`, `videos`.

The route guard now accepts a list of permissions ("any of"); Phase C routes are unchanged.

**Request and response schemas** are generated per collection from `collections.ts` (`ProjectsCreate`, `ProjectsUpdate`, `ProjectsRecord`, … in the OpenAPI document). Unknown fields are refused (`.strict()`).

**New problem codes:**

| Code | Status | Title |
|---|---|---|
| `edit_conflict` | 409 | «Запись была изменена другим пользователем. Обновите страницу перед сохранением.» |
| `slug_taken` | 409 | «Такой адрес страницы уже занят» |
| `invalid_transition` | 409 | «Это действие недоступно для записи в текущем статусе» (archived record, published slug, archive of a published record) |
| `precondition_required` | 428 | missing or malformed `If-Match` |

Field problems carry `errors[]` with `{field, message}` codes: `required`, `not_allowed`, `taken`, `format`, `reserved`, `locked_published`, `not_an_image`, `unknown_reference`, `archived_reference`, `placeholders`, `not_on_this_page`, `structure_is_fixed`, `invalid_list_origin`. The admin translates each into Russian.

---

## 3. Content model in the editors

Every editor is a fixed, typed form made only from fields that already exist (Phase B tables, `ContentStore`). Nothing can be added from the admin.

| Collection | Fields (API names) |
|---|---|
| Projects | title, category, categoryNumber, country, years, capacity, type, position · overview, scope (list), technology, results (optional list), specs (label/value) · image, imagePosition, gallery, relatedTechnology · slug, seoMetaTitle, seoMetaDescription, ogImage, noindex |
| Technologies | title, categoryTitle, categoryNumber, subtitle, position · overview, rawMaterials, processPrinciples (title/description), keyAdvantages, applications, productsProduced, patentInfo (optional block) · image, relatedProjects (ordered) · SEO |
| Products | title, categoryTitle, categoryNumber, position · description, rawMaterials, productionTechnology, applications, characteristics · image, relatedTechnology, relatedProject · SEO |
| EPC / EPCM | number, title, focus, position · description, deliverables · image (optional) |
| Patents | title, patentNo, placements (home / registry), legalStatus, registryNumber, position · home card: statusLabel, patentLabel, jurisdiction, abstract, claimsSummary · registry: code, location, overview, keyPillars, industrialImplementation, image, imageCaption |
| Videos | number, title, category, headline, position · description · video, poster |

**Pages** come from the **page slot registry** (`packages/core/src/content/page-registry.ts`). For each page or template it lists:
- the ordered text slots (single-line or paragraph, and the `{placeholders}` the site fills in);
- the list items and their text fields;
- the named images;
- whether the page has a header, a legal body or SEO data.

The editor shows:
- **Шапка страницы:** badge, title, subtitle, description, button text, facts list;
- **Тексты страницы:** slots grouped by their first word, with Russian labels generated from the slot keys;
- the **texts of list items:** same number and order of items;
- **images**;
- the **legal body** as paragraphs;
- **SEO**.

The API refuses:
- unknown slots;
- a changed number of list items;
- a slot text that loses or adds a `{placeholder}`.

A core test checks the registry against the seed, so the code, the database and the site cannot drift apart silently.

**Rich text:** the current content is plain text (paragraph strings, line breaks), so no rich-text editor was added (review §B lists TipTap for rich text; nothing in the model needs it yet).

**JSONB is never edited as JSON.** Lists are edited item by item (add, move up/down, remove), pairs as two fields, the patent block as a small form.

---

## 4. Translations: editing the source language safely

The editors change the **source language (EN)**. A language other than EN is rendered only when its translation is `approved`; otherwise the whole entity falls back to English (Phase 1 rule).

The export requires the same shape in every language: the same list lengths and the same null-ness. So every source edit follows these rules (`apps/api/src/content/cms/fields.ts`):

| Language state | Plain text | Optional value set / cleared | List items added / moved / removed |
|---|---|---|---|
| `approved`, `in_progress` | unchanged | cleared → cleared everywhere; set where it was empty → copy of the source | each item carries `from` (its index in the stored list, or null when new): translated items move with it, new items are source copies, removed items disappear |
| `missing` (never translated) | follows the source | follows the source | follows the source |
| new draft | all languages are source copies with status `missing` | | |

- Translation **statuses are never changed** by Phase E.
- After a source edit an approved translation keeps showing its approved text. A new list item shows the English copy in that language until it is translated.
- **Phase F** ([`admin-translations.md`](admin-translations.md)): a change of a translated source field raises the record's `source_revision`, so approved translations become **outdated** (derived, never stored); every write to a language row raises its `version`. Translations are edited and approved in «Переводы».
- The editors show each language's effective state («Исходный язык», «Переведено», «Перевод в работе», «Устарел», «Нет перевода»), each linking to the translation editor.
- Tested: after CMS writes the database still exports in the seed format. Untouched records are byte-identical; edited ones change only in the source language.

---

## 5. Admin UI

- **Sidebar «Контент»:** Страницы, Проекты, Технологии, Продукты, EPC / EPCM, Патенты, Видео. Visible with `content.read`, which every role has. ⌘K lists these sections, but there is no content search in ⌘K.
- **Lists:**
  - a table (title with public address, status, translations, order, last change and by whom);
  - search (`/` focuses it), status filter, sort, pages of 20;
  - the state lives in the address bar;
  - no technical ids.
- **Create:** a dialog asks only for what a record cannot exist without:
  - title;
  - main image, required relations, patent placements;
  - the address, when the user has `seo.edit`.

  Otherwise the address is proposed from the title (`slugify`, unique).
- **Editor:**
  - sections Основное · Содержание · Изображения и связи · SEO (patents: Карточка на главной · Запись в реестре);
  - Языковые версии; «Дополнительно» (id, key, version) for Owner and Admin;
  - every field has a label, help text, a character counter, and an error next to the field and in a toast;
  - SEO title and description show the review §J recommendations (≤ 60 / 70–160) as warnings.
- **Save:**
  - a sticky bar with the save state, «Сохранить» (⌘/Ctrl+S, never publishes) and «Отменить изменения»;
  - only changed fields are sent, with `If-Match`;
  - leaving with unsaved changes opens the admin's own dialog. The Phase D profile form now uses it too (no `window.confirm`).
- **Conflict:** «Запись была изменена другим пользователем. Обновите страницу перед сохранением.» with «Обновить». Nothing is overwritten; the user re-applies their change on the current version.
- **Read-only state** comes from the session's permissions:
  - SEO fields need `seo.edit`, every other field `content.edit`;
  - archived records are read-only;
  - the address of a non-draft record is locked;
  - a note explains why. The API enforces all of it again.
- **Archive:** a confirmation dialog states the consequences («На сайт это не влияет: черновики на сайте не показываются»). Restore has its own confirmation.
- **Published records:** an info banner says that changes are saved to the working copy and reach the site with the next published release.
- **История изменений** (Phase G): every editor shows the last 8 versions of the record with author and time; view, compare with the current version (field by field, language by language) and «Восстановить» (a new version; status and slug kept; confirmation). «Вся история» opens `/publishing/revisions/:type/:id`.
- **Media:**
  - a picker of existing files (file name, size, alt text);
  - uploads, crops and variants are Phase J;
  - previews appear when the admin build sets `VITE_MEDIA_BASE_URL` (the public site origin). The admin CSP `img-src` must then include that origin (admin-ui.md §8).
- **Mobile:** lists and editors work at 390 px (single column, no horizontal page scroll; E2E-checked).

---

## 6. Rules

| Rule | Implementation |
|---|---|
| **Optimistic locking** | `version` per record. GET returns `ETag: "<n>"`. PATCH, archive and restore require `If-Match`; the update is `… WHERE version = <n>` and raises the version in the same statement. A stale version → 409 `edit_conflict`; a missing header → 428 |
| **Field-level authorization** | Only fields whose value **changes** are authorised: `deniedContentFields(role, changed)` from `@soltex/core/domain`, the same list (`SEO_FIELDS`) the admin uses. A refusal is 403 with the field names and is written to the audit log (`result: denied`) outside the rolled-back write. Creating with an explicit slug or SEO text needs `seo.edit` |
| **Slugs** | `@soltex/core/seo`: lowercase Latin letters, digits, single hyphens, ≤ 80 characters; `technology/patents` reserved (`/technologies/patents` is a page); unique per type (database constraint + check → 409 `slug_taken`); one slug for all languages (localized slugs are DEFERRED). **The slug of a published record is locked** until slug changes create redirects (Phase I, review §J) |
| **References** | Images must be images (videos videos); relations must exist and not be archived; galleries and related lists without duplicates |
| **Working copy** | Edits change the content tables (the working copy) and write one revision each (Phase G). The public site changes only when a release (a snapshot of the published records) is built and published; a database export reflects the working copy |
| **Audit** | `content.create`, `content.update` (summary `fields`: the changed field names), `content.archive`, `content.restore`; denied field changes as `content.update` / `denied`. Resource type `page`, `project`, `technology`, `product`, `epcm_stage`, `patent`, `video` and the record id; request id and IP hash as in Phase C. No content text is copied into the audit log |

---

## 7. Tests

| Suite | Tests | Covers |
|---|---|---|
| `packages/core/test/page-registry.test.ts`, `slug.test.ts` | 5 | registry = seed (pages, slots in order, lists, media, placeholders, multi-line), slug rules, slugify, SEO notes |
| `apps/api/test/content.db.test.ts` | 15 | lists (search, LIKE escaping, filter, sort, paging), typed read + ETag, 404, create (draft, copies, audit), validation (required, media kind, unknown/archived reference, unknown fields), slugs (taken, reserved, format, proposed), update (only changes, version, translations untouched, audit fields), lists keep translations attached, optimistic locking (409, 428, W/ ETag), field-level authorization (Editor / SEO specialist / Marketer, audited refusals), draft vs published slug, archive / restore / read-only archive, every collection create–edit–archive, pages (registry slots, placeholders, fixed lists, templates without SEO, SEO role, no create), media picker, export still in seed format, anonymous / CSRF |
| `apps/admin/test/content.test.ts` | 8 | editors match the API model, form ↔ API (`from` origins, empty → null, untouched not sent), validation, field permissions = core rule, API field errors in Russian, page patch and changed names, page validation (placeholders), Russian page and slot labels |
| `apps/admin/e2e/content.e2e.mjs` | 12 | sign-in → «Контент» → list (search, filter); create a draft with the media picker; edit typed fields, save with ⌘S, reload persists; Editor sees SEO read-only; unsaved-changes dialog; optimistic conflict between two browsers; SEO specialist (TOTP) cannot edit content, gets «Такой адрес уже занят…», saves SEO; permission denial; archive confirmation, read-only archive, restore, no archive for published; pages (placeholder guard, header save); audit log shows the changes; mobile list and editor without horizontal scroll; no page errors or CSP violations |

`content.db.test.ts` starts from a truncated content database with the seed imported, and leaves exactly the seed behind. CI then imports and exports the same database.

---

## 8. Known limitations (by design, with the phase that lifts them)

| Limitation | Phase |
|---|---|
| No publish / unpublish, no revisions or history tab, no «Есть неопубликованные изменения» state | G |
| No preview | H |
| Slug of published records locked; no redirect dialog; no SEO checker or snippet preview | I |
| ~~Translations are not edited; no "outdated" detection~~ — done in Phase F ([`admin-translations.md`](admin-translations.md)) | F |
| No uploads, crops or variants; previews only with `VITE_MEDIA_BASE_URL` | J |
| Page list items: texts only (no adding or removing timeline entries etc.) | later, when the page design gets new item templates |
| Settings, offices, metrics, footer are not editable yet | next content task (review §X «Настройки») |
| No hard delete; no usages view («используется в 4 проектах») | with the delete flow (Admin-only, review §G) |
| ⌘K does not search content | when content search is designed (review §B: PostgreSQL FTS) |
