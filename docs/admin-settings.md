# Site settings (Phase N-0)

Status: implemented (2026-10-18), API 0.14.0.

«Администрирование → Настройки сайта» (`/admin/settings`) edits the site-wide data that used to change only through the seed: contacts, headquarters, footer texts, default SEO texts, the homepage metrics and the regional offices. Permission `settings.manage` (Owner and Admin).

**Code:**
- API: `apps/api/src/settings/service.ts`, `apps/api/src/routes/settings.ts`;
- admin: `apps/admin/src/features/settings/{model.ts,SettingsPage.tsx}`;
- tables: `settings`, `settings_translations`, `metrics`, `metric_translations`, `offices`, `office_translations` ([`cms-schema.md`](cms-schema.md) §3.4). No migration.

---

## 1. What is editable

| Part | Fields | Languages |
|---|---|---|
| Contacts | primary e-mail of the site, headquarters e-mail | one value |
| Headquarters | name, address line 1 and 2, short address, jurisdiction, hours | six |
| Footer | tagline, location, copyright | six |
| Default SEO | site title, site description (used by pages without their own SEO texts, and by the JSON-LD Organization description, [`seo.md`](seo.md) §2) | six |
| Metrics (existing records) | value (optional, e.g. `25+`) — one value; label (may contain `{highlight}`), highlight (optional) — six | |
| Offices (existing records) | e-mail, phone (optional), WhatsApp (optional) — one value; region, legal entity title, country, address (optional), representative (optional) — six | |

Not editable here: the site name (read-only in the response), logos, the footer background image and its alt text, the number and order of metrics and offices. These stay with the developer (seed + `db:import`).

## 2. API

Tag `settings`, 2 operations ([`routes.md`](routes.md) §4.14).

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/v1/settings` | `settings.manage` | The whole form: `version`, `siteName`, `primaryEmail`, `hqEmail`, `texts` per language, `metrics[]` and `offices[]` (with `key`, `position`, texts per language), `updatedAt`, `updatedBy`. `ETag` = version |
| PUT | `/api/v1/settings` | `settings.manage` + step-up | The whole form at once. `If-Match` = the version from GET. Answers the new state and `ETag` |

**Errors:** `428 precondition_required` (no `If-Match`), `409 edit_conflict` (stale version), `400 validation_failed` (invalid e-mail, empty required text in any language, over-long text, unknown field, or `records_mismatch` when `metrics`/`offices` are not exactly the existing records), `403 step_up_required` / `forbidden`, `404 not_found` (settings not imported).

## 3. Rules

- **One version for the whole form.** `settings.version` guards every part; a save with changes increments it. A save without changes returns the same version and writes nothing.
- **Step-up.** Saving needs a second factor verified within the last 10 minutes ([`admin-auth.md`](admin-auth.md) §3).
- **Six languages at once.** Every translated text must be present and non-empty in `en`, `ru`, `zh`, `tr`, `ar`, `es`; optional texts (`highlight`, `address`, `representative`) may be empty (stored as null).
- **Approvals kept.** Because every language is on the editor's screen, approved settings translations stay approved: on save the API renews `approved_source_hash` of approved `settings_translations` rows. The admin warns instead: a language tab shows a count, and an alert, when English was changed in this edit but that language was not (`translationsToCheck()`).
- **Edit only.** Metrics and offices are updated in place; none are created, deleted or reordered (`records_mismatch` otherwise).
- **No draft, no revisions.** Settings have no draft state and no `content_revisions`. A saved change reaches the site with the **next publication** (a new release); the screen and the success message say so.
- **Field errors** are shown at the field; a language tab holding an error is outlined. A conflict shows «Настройки уже изменил другой пользователь» with «Загрузить заново».

## 4. Audit

`settings.update` («Изменены настройки сайта»), with `summary.fields` = names of the changed parts only, never values: `contacts`, `texts.<locale>`, `metric.<key>`, `office.<key>` (at most 40).

## 5. Tests

| Suite | File | Tests |
|---|---|---|
| Admin unit | `apps/admin/test/settings.test.ts` | 3: form ↔ body round trip (null ↔ ""), translations to check, API field errors → form paths per language |
| API database | `apps/api/test/settings.db.test.ts` (`npm run test:db`) | 4: read in six languages with ETag; save reaches the export, audit by field names only, approvals stay current, `If-Match` (409, 428); validation (e-mail, required texts, same records, no-op save); step-up required, Content Manager forbidden |
| E2E | `apps/admin/e2e/settings.e2e.mjs` | 2 (4th Admin user of `scripts/admin-e2e.mjs`): edit an office phone and the English hours, the Russian tab asks to check the translation, save with step-up; an invalid e-mail is shown at the field and nothing is saved |

## 6. Limitations

- No creating, deleting or reordering of offices or metrics; a new office is added by the developer.
- Logos, the footer background image and its alt text are changed by the developer.
- No history or diff of settings: no revisions, no restore. The audit log records who changed which part and when.
- Lead notification recipients (`LEAD_NOTIFY_TO`) and other server settings are environment variables, not site settings.
