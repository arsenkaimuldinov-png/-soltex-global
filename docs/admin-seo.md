# SEO check, redirects and address changes (Phase I)

Status:
- **Phase I-1** (2026-10-16): the SEO check. Implements approved architecture §14 (severity and
  publish blocking) and the effective-text part of §15; review §J (SEO model, SEO block).
- **Phase I-2** (2026-10-16): address changes of published records, redirects and the nginx 404
  fallback. Implements approved §11 and review §O; see §8–§11 below.

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
| `redirect_invalid`, `redirect_self`, `redirect_duplicate`, `redirect_loop`, `redirect_shadows_page`, `redirect_target_missing` | redirect rules (§8.2) |

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
| I-6 | Slug changes of live records, redirect management, lookup endpoint and nginx fallback | Done in Phase I-2 (§8–§11) |

## 8. Redirects (Phase I-2)

The `redirects` table is the source of truth (review §O). Sources:
- `manual` — added in «SEO → Редиректы»;
- `slug_change` — created by «Изменить адрес»;
- `import` — from the content files (`redirects.json`; old soltexglobal.co addresses).

Rules belong to the working copy, like content:
- a new or changed rule reaches the site with the **next release** (the release snapshot carries the rules);
- the lookup serves only the rules of the **active** release;
- so a redirect never points to a page that is not live yet.

### 8.1 Stored form

| | Rule |
|---|---|
| Paths | Decoded (`/о-компании`, not `%D0%BE…`), no trailing slash, no `?` / `#` |
| Input | Normalized on save: a pasted `https://soltexglobal.co/…` becomes the path; escapes are decoded; reserved escapes (`%2F`, `%5C`, control characters) stay encoded and are refused |
| «На всех языках» (`allLocales`, default) | The path has **no** language prefix and the rule applies to `/x`, `/ru/x`, `/zh/x`, … (target localized the same way) |
| Single path (`allLocales` off) | One concrete pair; it may carry a prefix (`/ru/old` → `/ru/new`) |
| Status | 301 (permanent, default) or 302 (temporary) |
| Target | Internal paths only (approved §11.3). `Location` is always built by the server: `PUBLIC_SITE_URL` + the path, percent-encoded |

### 8.2 Checks on save

Every create / change runs, in one transaction:

1. **Path rules** (`redirectPathProblem`, 400 `validation_failed`, field errors):
   - the syntax of approved §11.2 (`not_absolute`, `protocol_relative`, `backslash`, `scheme`, `control`, `encoded`, `dot_segment`, `too_long`);
   - `query`, `trailing_slash`;
   - `locale_prefix` (prefix on a rule for all languages);
   - `reserved` (source `/` or `/assets/`, `/images/`, `/videos/`, `/icons/` — nginx serves those itself);
   - `self`.
2. **Duplicate source:** 409 `redirect_exists`.
3. **Chains collapsed** (`collapseRedirects`):
   - the target is followed through existing rules, so the rule points to the final page;
   - rules that pointed to the source are rewritten to that page;
   - a rule that would now point to itself is removed. Going back to an earlier address therefore reverses the old rule instead of creating a loop.
4. **SEO checker on the next release** with the change applied. A BLOCKING issue of any touched rule rolls everything back (409 `redirect_rejected`, field = `from`/`to`, message = issue code):
   - `redirect_target_missing` (not a published page);
   - `redirect_shadows_page` (the source is a live page);
   - `redirect_duplicate` (the same concrete path on some language);
   - `redirect_loop`.

The checker works on **concrete paths per language**, so for example `/ru/company` is a live page and `/old` (all languages) overlaps `/ru/old`. A chain that cannot be collapsed (mixed rule kinds) is the WARNING `redirect_chain`.

## 9. Address change of a published record

A draft changes its slug in the form. A **published** project, technology or product changes it with «Изменить адрес» (`POST /content/{type}/{id}/slug`, `redirects.manage`, If-Match):

- the dialog shows the old and new address in all six languages;
- «Создать 301-редирект со старого адреса» is on by default; switching it off shows the consequence;
- the slug changes in every language row (one slug per entity) and the record version rises;
- translations do **not** become outdated: the source text did not change;
- with the redirect:
  - `old → new` (301, all languages, `slug_change`) is created or updated;
  - older rules to the old address are rewritten to the new one;
- either way, a rule **from** the new address is removed (it would hide the page);
- a revision (`fields: ['slug']`) and the audit entry `content.slug_change` are recorded;
- the change reaches the site with the next release.

Roles without `redirects.manage` (content manager, editor, marketer) see the address read-only with the reason. PATCH of a published record's slug is refused (`locked_published`).

## 10. Lookup endpoint and nginx (approved §11)

`GET /internal/v1/redirect` is not under `/api`, is not in OpenAPI and answers only on loopback (other clients → 404). nginx passes the normalized `$uri` in `X-Lookup-Path`. The endpoint:

- **Path:** decodes the header as UTF-8; rejects every §11.2 case (→ 404, no `Location`, logged at debug level without the value).
- **Matching:** exact match on the rules of the **active release**:
  - the index is built once per release id and cached;
  - chains of an older release are followed;
  - loops are ignored;
  - the status is 302 if any hop is temporary.
- **Trailing slash:** `/x/` → the rule for `/x`, or 301 to `/x` when that page exists.
- **Hit counter:** `hits` / `last_hit_at`, updated asynchronously. Never delays or fails the redirect, and is not an edit (the version is unchanged).

**nginx:** `deploy/nginx/soltexglobal.conf`.

| Request | Result |
|---|---|
| Existing static file (`$uri`, `$uri.html`, `$uri/index.html`) | Served; the API is not involved |
| Trailing slash | 301 to the address without it when the page file exists; never a directory listing or 403 |
| Anything else | `@lookup` → API |
| `@lookup` settings | 1 s connect / 2 s read timeouts; `limit_req` 20 r/s per IP (burst 40); cookies and authorization stripped; decoded control characters refused before proxying (they would split the header) |
| API 404, 429, 5xx, timeout, down or rate-limited | **404** with the localized page: `map $request_uri` → `/ru/404.html` …, else `/404.html`. Never a 502 |

## 11. API, admin and tests (Phase I-2)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/redirects?q&source&limit&offset` (+ issue counts of all rules) | redirects.read |
| GET | `/api/v1/redirects/{id}` (ETag) | redirects.read |
| POST | `/api/v1/redirects` | redirects.manage |
| PATCH / DELETE | `/api/v1/redirects/{id}` (If-Match) | redirects.manage |
| POST | `/api/v1/content/{projects\|technologies\|products}/{id}/slug` | redirects.manage |

- **API:** version 0.9.0. Migration `0006` adds `redirects.version`. Config `PUBLIC_SITE_URL` (default `https://soltexglobal.co`, https in production).
- **Audit:** `redirect.create`, `redirect.update`, `redirect.delete` (summary `from`, `to`, number of other rules changed); `content.slug_change` (`slug`, `previous_slug`, count).

**Admin: «SEO → Редиректы»** (`/seo/redirects`, redirects.read):
- list with search;
- old and new address, «и на всех языках», code, source, hits and last hit;
- the checks of each rule;
- add / change / delete for redirects.manage;
- a collapsed chain is reported.

**Tests:**

| Area | File |
|---|---|
| Core rules | `packages/core/test/redirects.test.ts` |
| API | `apps/api/test/redirects.db.test.ts` |
| nginx with the real config file, static site and API | `apps/api/test/nginx.db.test.ts`. Covers approved §11.4: static page with the API stopped, 301 in all languages, localized 404 for six prefixes, API stopped → 404, API slow → 404, injection → 404 without `Location`. Skipped when nginx is not installed |
| E2E | `apps/admin/e2e/redirects.e2e.mjs` |

### Deviations (Phase I-2)

| # | Deviation | Reason |
|---|---|---|
| I-7 | The query string of an old address is not carried over to the target | Exact match on the path (§11.2); campaign parameters on old addresses are not known to exist |
| I-8 | The dialog shows the address from the working copy, not the live one | They differ only when the slug was changed again before the next release; both rules are collapsed anyway |
| I-9 | Redirect rules are not versioned in the content history | The audit log records every change with `from` / `to` |
| I-10 | External redirect targets are not supported | DEFERRED by approved §11.3 |
