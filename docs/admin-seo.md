# SEO check (Phase I-1)

Status: implemented in Phase I-1 (2026-10-16). Implements approved architecture §14 (severity and
publish blocking) and the effective-text part of §15; review §J (SEO model, SEO block). Slug changes
of live records, redirects management and the nginx 404 fallback are Phase I-2.

## 1. One checker, three places

`@soltex/core/seo` → `checkSeo(store, { translationState })` is a pure function. It takes a content
store in the stored (multilingual) shape and returns:

- `pages` — the effective SEO of every public page in every language: path, served language,
  title, description, override vs default template, indexable;
- `issues` — every issue with code, severity, entity, language and editor field;
- `summary` — counts by severity.

It runs in three places with the same rules:

| Where | Input | Effect of a BLOCKING issue |
|---|---|---|
| Site build (`apps/web/scripts/content/build-snapshots.ts`) | the content source (seed or DB export) | the build fails (`content: … error(s)`, `seo: BLOCKING …`) |
| API record check (`GET /content/{type}/{id}/seo`, `setPublished`) | DB working copy, this record counted as published | «Отметить к публикации» refused (`409 seo_blocking`) |
| API site check (`GET /seo/report`, `createRelease`) | the records marked published (= the next release) | «Создать релиз» refused (`409 seo_blocking`); nothing is stored |

Preview builds are not refused: they exist to look at drafts. A preview whose content has a
BLOCKING issue fails at its build step and shows the issues.

**Parity guarantee.** The site's own templates live in `apps/web/src/i18n/seo.ts`. The client
bundle was not changed, so the published output stays byte-identical. `validate-site.ts` compares
every generated `<title>`, meta description and robots value with the checker's model and fails the
build on any difference. The snippet in the admin is therefore exactly what search engines get.

## 2. Effective texts

| | Rule |
|---|---|
| Title | SEO override of the served language, else `"{H1} \| Soltex Global"` (page header title / entity title) |
| Description | SEO override, else the header description / overview / product description shortened to whole sentences (≈160 characters) |
| Served language | the translation if its stored status is `approved` (an *outdated* translation keeps its previously approved text), else English |
| Fallback page | (not approved) canonical → English URL; skipped by the text checks and duplicate checks |
| noindex | `seo.noindex`: robots `noindex, follow`, no hreflang alternates, not in the sitemap |

Public pages are the published fixed pages with a route (`PAGE_ROUTES`) plus the published
technologies, products and projects.

## 3. Checks

**BLOCKING** (refuse publication, release and build):

| Code | Meaning |
|---|---|
| `slug_invalid`, `slug_duplicate` | slug format or reserved word; the same slug twice in a section |
| `relation_broken` | published record pointing to a missing or unpublished one |
| `media_missing` | media reference not in the library |
| `link_broken` | internal `href` of a page list pointing to no public page |
| `title_missing`, `description_missing` | empty effective title / description on an indexable page |
| `title_too_long` | title longer than 120 characters |
| `redirect_invalid`, `redirect_self`, `redirect_loop`, `redirect_shadows_page`, `redirect_target_missing` | redirect rules (path syntax of approved §11.2) |

**WARNING:**
- `title_length` (> 60), `description_length` (outside 70–160);
- `title_duplicate`, `description_duplicate` (indexable pages of one language);
- `translation_missing` (not approved, served in English), `translation_outdated`;
- `og_image_missing` (detail pages);
- `noindex_in_navigation`;
- `redirect_chain`.

**INFO:** `title_default`, `description_default` (the default template is used).

The seed has 0 blocking issues, 160 warnings (lengths) and 56 hints.

## 4. API

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/seo/report?severity&locale&type` | seo.read |
| GET | `/api/v1/content/{type}/{id}/seo` | seo.read |

- **Site report:** summary, number of pages checked, and issues. Each issue carries `record` = `{ id, title, status }` for links into the editor.
- **Record report:** `meta` per language (url, title, description, sources, indexable, served language), the record's issues, and `canPublish`.
- **Refusals:** `409 seo_blocking`, with `errors[] = { field: "<type>/<key>[:<locale>][:<field>]", message: <code> }`.
- **Release warnings:** a release records `seo_warnings:<n>` among its warnings.
- **Version:** API 0.8.0.

## 5. Admin

- **«Проверка SEO» block** in the editors of projects, technologies, products and routable pages:
  - snippet as in a search result (URL breadcrumbs, title, description), per language;
  - character counters, override vs template;
  - fallback and noindex notes;
  - the record's checks: ✗ error, ⚠ warning, ℹ hint;
  - «Перейти к полю» focuses the field.
- **«Отметить к публикации»** is disabled with «Ошибок SEO: N» while the record has errors.
- **«SEO → Проверка SEO»** (`/seo`): totals by severity, filters by severity, language and section (kept in the address), search, and links to the editors.
- **Publishing overview:** «Создать релиз» is disabled with an alert linking to the errors.

## 6. Also fixed

A record with «Не индексировать» used to fail the site build ("unexpected noindex"). Now:
- such a page is rendered `noindex`;
- it has no hreflang alternates and is not in the sitemap;
- the validator requires exactly that.

The current content has no noindex page, so the output is unchanged.

## 7. Deviations and limits (Phase I-1)

| # | Deviation | Reason / where it goes |
|---|---|---|
| I-1 | No `seo_issues` table; reports are computed per request (one export, ≈50 ms) | Always current; the dashboard (L) can use the same endpoint |
| I-2 | `missing_alt`, `image_too_large` not checked | Alt texts and file sizes belong to the media library (J) |
| I-3 | `orphan_page`, `canonical_conflict`, `hreflang_conflict` not in the checker | Canonical and hreflang are generated automatically (no override field exists), and the build validator checks the generated tags; there is no free linking in content yet |
| I-4 | SEO texts are checked per language but edited in the source editor / translations | Unchanged content model |
| I-5 | Duplicate checks ignore fallback pages | They canonicalize to English and are not indexed in that language |
| I-6 | Slug changes of live records, redirect management, lookup endpoint and nginx fallback | Phase I-2 |
