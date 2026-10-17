# Translation management (Phase F)

**Architecture:** [`admin-architecture-approved.md`](admin-architecture-approved.md) §15 (translation states), §8 (roles); review §H (translation model), §B (`translations` module), §X (admin UX).
**Builds on:** [`admin-content.md`](admin-content.md) (Phase E editors and write rules), [`admin-database.md`](admin-database.md), [`admin-auth.md`](admin-auth.md).
**Code:**
- core: `@soltex/core/domain` `translations.ts` (state model, workflow, completion, permissions);
- API:
  - `apps/api/src/content/translations/` (`document.ts`, `service.ts`) and `apps/api/src/routes/translations.ts`;
  - `content/reconcile.ts`, `content/legacy-source-hash.ts`, `content/review-tables.ts`;
- database: migration `0004_translation_review.sql`;
- admin: `apps/admin/src/features/translations/`.

Phase F manages the five translated languages (RU, ZH, TR, AR, ES) of the existing content. English is the source language: it is edited in «Контент» (Phase E) and never here. No public-site file, text, route or build step changes.

---

## 1. Translation states

| State | Stored as `tr_status` | Meaning | Counts as complete |
|---|---|---|---|
| **Нет перевода** (`missing`) | `missing` | No translation supplied. The row holds an untranslated copy of the source (the export needs all six rows in one shape). | no |
| **В работе** (`in_progress`) | `in_progress` | Translated text saved, not approved | no |
| **Устарел** (`outdated`) | `approved` | Approved, but the English text changed after the approval | no |
| **Утверждён** (`approved`) | `approved` | Approved for the current English text | **yes** |

- The database enum `translation_state` is unchanged (`missing`, `in_progress`, `approved`). `outdated` is **derived, never stored**: `approved` and `approved_source_revision < source_revision`. Statuses are never reset silently; a source edit does not rewrite any translation row.
- Mapping to approved §15.1:
  - `draft` there = `in_progress` here;
  - `missing` there ("no row") = `missing` here, because rows always exist.
- One rule everywhere:
  - `effectiveTranslationState()` in `@soltex/core/domain`;
  - the same `CASE` in the SQL of the overview and the list (`translations/service.ts`);
  - the Phase E lists and records report the same effective state.
- English fallback text is never a translation. A `missing` row is never counted and cannot be approved.

## 2. Source revision and outdated detection

**Migration 0004** (additive only) adds:

| Table | Column | Purpose |
|---|---|---|
| `pages`, `projects`, `technologies`, `products`, `epcm_stages`, `patents`, `videos` | `source_revision int NOT NULL DEFAULT 1` | Revision of the English **translatable** text |
| their `*_translations` | `version int NOT NULL DEFAULT 1` | Concurrency token of one language row |
| | `approved_source_revision int NULL` | Source revision the approval reviewed |
| | `approved_by uuid NULL → users` | Who approved |
| | `edited_source_revision int NULL` | Source revision of the translator's last save |

`settings_translations` has none of them: settings are not edited in the admin yet.

**Rules:**
- A Phase E save raises `source_revision` by one **only** when a translated source field changes:
  - collections: the fields stored in translation rows (texts, lists, SEO texts) — not slug, images, order, relations, `noindex`, status;
  - pages: header texts, copy slots, list item texts, body, SEO texts — not the badge number, images, OG image or `noindex`.
- Unchanged or unrelated changes never make translations outdated.
- Approval stores `approved_source_revision = source_revision`. A later source change makes the translation outdated; approving again records the new revision.
- Saving a translation never touches the English row (tested byte for byte).
- Every write to a language row raises its `version` (Phase E writes included).

**Why a revision and not a timestamp or a new hash:**
- A revision is explicit, cheap to compare in SQL (overview counts without loading content) and deterministic.
- The seed-format `approvedSourceHash` hashes the **whole** English record, including order, status and images. It therefore cannot satisfy "an unrelated change does not invalidate", and it stays only for seed / export compatibility (below).

**Existing approvals (seed, Phase B/E databases) — `reconcileApprovals()`:**
1. An approval without a revision is linked to the current revision exactly when its seed hash equals the hash of the current English record. This is the same rule as the site build validator (`apps/web/scripts/content/lib/source-hash.ts`, repeated in `content/legacy-source-hash.ts` and tested against all 245 seed approvals).
2. Other approvals stay unlinked and are reported as outdated.
3. It runs:
   - inside `db:import`;
   - after the migrations in `db:migrate` (idempotent; "240 existing approvals linked" on a Phase E database; settings excluded).

**Export:**
- The seed format is unchanged.
- For approvals current in the database, the export writes the seed-format hash of the exported record. The build validator therefore sees them as current, and export → import keeps every state (tested).
- Outdated approvals keep their stored hash; an approval made in the CMS that later became outdated has none. The build validator reports both as outdated.
- For the seed this reproduces the stored hashes, so `seed → DB → export` stays byte-identical.

## 3. Completion

```
completion(language) = floor( approved_for_current_source × 100 / total )
total = non-archived records of the seven types (one per record and language)
```

- English is the source and is not a backlog. Missing, in-progress and outdated translations do not count.
- The value is rounded **down**: 99.6 % shows 99 %.
- Archived records are excluded (they are read-only).
- Seed: 50 items per language, 48 approved (privacy and terms have no translations) → **96 %**.

## 4. API

All endpoints are under `/api/v1` and follow the Phase C/E conventions:
- session + second factor, CSRF header, RBAC (route and field level);
- Zod validation, RFC 9457 problems with `request_id`, `X-Request-ID`;
- audit in the transaction;
- OpenAPI tag `translations`; API version 0.13.0 (`apps/api/openapi.json`).

| Method and path | Access | Notes |
|---|---|---|
| `GET /translations/overview` | `content.read` | Counts per language and per type; one `UNION ALL … GROUP BY` query |
| `GET /translations` | `content.read` | `locale`, `type`, `state` (`missing` · `in_progress` · `outdated` · `approved` · `attention` = not approved), `entity` (record id), `q` (English title and key; LIKE wildcards escaped), `sort` (`type` · `title` · `updated` · `state`), `limit` ≤ 100, `offset` → `{items, total}` |
| `GET /content/{type}/{id}/translations/{locale}` | `content.read` | Source and target of every translatable field; `ETag: "<sourceRevision>.<rowVersion>"` |
| `PATCH /content/{type}/{id}/translations/{locale}` | `content.edit` **or** `seo.edit`, then per field | `{fields: {name: value}}`, changed fields only; **`If-Match` required** |
| `POST …/translations/{locale}/approve` | `content.publish` | `in_progress` / `outdated` → `approved`; `If-Match` |
| `POST …/translations/{locale}/reopen` | `content.publish` | `approved` / `outdated` → `in_progress`; `If-Match` |

`{type}` is one of `pages`, `projects`, `technologies`, `products`, `epcm-stages`, `patents`, `videos`. `{locale}` is a translated language; `en` and unknown codes → 400.

**Save rules:**
- The target row only.
- Structure as the source:
  - same fields — a field without source text is not translated (`not_translatable`);
  - same list lengths and item fields (`structure_is_fixed`);
  - every text non-empty (`required`) and within its limit (`too_long`);
  - the `{placeholders}` of the source kept (`placeholders`).
- Only changed values are validated, so an older translation that exceeds a limit never blocks other edits.
- Result: `in_progress`, `edited_source_revision` = current revision.
- A save without changes of a `missing` translation confirms the copy as a start (`in_progress`, needs `content.edit`).

**Concurrency:**
- The ETag combines the source revision and the row version. If either changed — another translator saved, or the English text changed — the request gets **409 `edit_conflict`**: «Запись была изменена другим пользователем. Обновите страницу перед сохранением.»
- A missing or malformed `If-Match` → 428.
- English image or order changes do not invalidate an open translation.

**Archived records:** read-only (`invalid_transition`), not counted, not listed.

The Phase E record and list responses now report the **effective** state (adds `outdated`).

## 5. Content types and fields

| Type | Translated fields | Not translated |
|---|---|---|
| Pages (14) | header badge label, title, subtitle, description, facts, button text; copy slots of the page registry; list item texts; legal body; SEO title and description (indexable pages) | page key, badge number, images, OG image, `noindex`, list structure |
| Projects | title, category, country, years, capacity, type, overview, scope, technology, results, specs, SEO texts | slug, category number, images, gallery, related technology, OG image, `noindex`, order |
| Technologies | title, category title, subtitle, overview, patent block, raw materials, process principles, advantages, applications, products produced, SEO texts | slug, category number, image, related projects, OG image, `noindex`, order |
| Products | title, category title, description, raw materials, production technology, applications, characteristics, SEO texts | slug, category number, image, relations, OG image, `noindex`, order |
| EPC / EPCM stages | title, focus, description, deliverables | number, image, order |
| Patents | title, status label, patent label, jurisdiction, abstract, claims, code, location, overview, key pillars, industrial implementation, image caption | placements, patent number, legal status, registry number, image, order |
| Videos | title, category, headline, description | number, video file, poster, order |

Slugs are identical in every language (Phase B); localized slugs are not part of Phase F. Media alt texts and settings, offices and metrics are not translated in the admin yet (§9).

## 6. Permissions

No new role or permission. The matrix of Phase C is used as follows:

| Action | Permission | Roles |
|---|---|---|
| Read overview, list, translations | `content.read` | all six |
| Save content texts of a translation | `content.edit` | Owner, Admin, Content Manager, Editor |
| Save SEO texts of a translation | `seo.edit` | Owner, Admin, Content Manager, SEO Specialist |
| Approve / return to work | `content.publish` | Owner, Admin, Content Manager |

**Why approval uses `content.publish`:**
- An approved translation is what the site may serve in that language; anything else falls back to English (approved §15.2). Approval is therefore part of the publishing gate, and `content.publish` is the reviewer permission that already exists.
- `content.publish` requires MFA.
- It is exported once as `TRANSLATION_REVIEW_PERMISSION`.

**Enforcement:**
- Field-level rules are enforced by the API: only changed fields are checked; a refusal is 403 with `errors[{field, message: 'not_allowed'}]` and is audited (`translation.update`, result `denied`).
- The SEO specialist cannot change content texts through the translation API. The Marketer cannot change anything.
- Refusals of the route permission are audited as `access.denied` (Phase C).

## 7. Audit

| Action | Summary (no content texts) |
|---|---|
| `translation.update` | `locale`, `fields`, `previous_status`, `status`, `revision`; denied attempts with the refused `fields` |
| `translation.approve` | `locale`, `previous_status` (`in_progress` / `outdated`), `status`, `revision` (the reviewed source revision) |
| `translation.reopen` | `locale`, `previous_status`, `status` |

`resourceType` / `resourceId` are those of the record (`project`, `page`, …). The admin audit log shows them in Russian («Изменён перевод · проект · арабский · утверждён → в работе»).

## 8. Admin

New sidebar section **Переводы**:

1. **Обзор** — per-language completion cards (approved / outdated / in progress / missing, each a link to the filtered list) and a section × language table.
2. **Все переводы** — table with search (`/`), language, section and state filters, sort, pages; filters in the address; `?entity=` shows the translations of one record.
3. **Требуют внимания** — everything not approved, outdated first.
4. **Translation editor** (`/translations/{type}/{id}/{locale}`):
   - language tabs, with EN linking to the source editor;
   - a state banner with the explanation;
   - field by field: the English source (read-only, `lang="en"`) next to the target input;
   - list items aligned item by item; «Скопировать исходный» per field;
   - character counters, placeholder reminder, "same as English" hint;
   - errors next to the field;
   - dirty state, ⌘S, the unsaved-changes dialog (also when switching languages), the conflict banner;
   - «Утвердить перевод» / «Вернуть в работу» for reviewers (approve is disabled while there are unsaved changes; reopen asks through the Phase D confirmation dialog);
   - read-only views for roles without the right.
   - **Arabic:** the target inputs get `dir="rtl" lang="ar"`; the source and the admin layout stay left-to-right. Nothing of the public site changes.
5. **Content editors (Phase E)**: «Языковые версии» shows the effective state per language, links to each translation and to the record's translation list.

No machine translation, no translation tasks, no rich-text editor (the content is plain text).

## 8a. Publication (Phase G)

- Translation saves write revisions of kind `translation` (with the language), approve/reopen revisions `approve` / `reopen`; they appear in the record's history and can be compared and restored with the record.
- A release includes the translation rows as they are at snapshot time. The release page shows per language how many translations are approved, outdated, in progress or missing, and the checks list `translation_outdated` / `translation_fallback` warnings (they never block a release).
- Restoring a record version restores its translation texts; if the English text changes, approvals become outdated.

## 9. Known limitations and deviations

| # | Limitation / deviation | Reason, phase |
|---|---|---|
| F-1 | No translation revisions: saving changes the working row; while a translation is not approved, the site (after the next build) shows English for that record and language (Phase 1 fallback). Approved §15.1 "serve the previous approved revision while outdated / in draft" needs revisions | **Partly lifted in Phase G:** every translation save, approval and reopen writes a revision, and a release is a snapshot. An *outdated* translation keeps its previously approved text on the site; an *in-progress* rework of an approved translation is still not served from the previous approved revision (it falls back to English) — see [`admin-publishing.md`](admin-publishing.md) §3 |
| F-2 | Approval uses the existing `content.publish` permission, not a dedicated reviewer permission or a "Translator" role | No new roles in this phase; review §F: a translator role can be added later without architecture change |
| F-3 | `outdated` is derived (source revision), not a stored enum value; the seed-format hash is kept only for compatibility | Avoids rewriting translation rows on every source edit; deterministic, SQL-countable |
| F-4 | An approval made in the CMS stores no seed-format hash; the export computes it while the approval is current | The hash covers the whole exported record; computing it per approval would need a full export in the transaction |
| F-5 | Settings, offices, metrics and media alt texts are not translated in the admin | They are not editable in the admin yet (Phase E §8) |
| F-6 | A Phase E database migrated to 0004: approvals are linked through the seed hash. An English edit made in Phase E (or a change of order or images, which the old hash also covers) marks those translations outdated — conservative | The database did not record what an old approval reviewed |
| F-7 | "Source changed since the last save" is shown for in-progress translations, but the translation editor shows no diff of the English text | The record's «История изменений» compares English versions field by field (Phase G, [`admin-content.md`](admin-content.md) §5); a diff inside the translation editor is not built |
| F-8 | Localized slugs, machine translation, translation tasks and assignments are not implemented | Out of scope (approved: deferred) |
