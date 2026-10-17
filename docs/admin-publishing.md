# Publishing, revisions and releases (Phase G)

Status: implemented in Phase G (2026-10-09). Builds on the approved architecture §3 (publishing
states), §4 (immutable releases, atomic switch), §5 (one heavy job at a time), §8 (role matrix),
§9 (preview) and review §M (full snapshots; restore = new revision).

The public site is a static build. Nothing an editor does in the admin reaches the site directly:
the site only ever serves **one immutable release**, and changing what it serves is an explicit,
confirmed, audited action.

```
working copy (DB) ──«Создать релиз»──▶ snapshot ──worker──▶ build ──checks──▶ ready
                                                                               │ «Опубликовать»
                                    RELEASES_DIR/current ◀── atomic symlink ───┘
```

## 1. Revisions

Every change to a translatable record (pages, projects, technologies, products, EPC/EPCM stages,
patents, videos) writes one row to `content_revisions` **in the same transaction** as the change.
A failed or refused change writes nothing (no orphan revisions); `If-Match` concurrency is
unchanged — a stale version is refused before anything is written.

| column | meaning |
| --- | --- |
| `entity_type`, `entity_id`, `entity_key` | the record |
| `number` | 1, 2, 3 … per record; `unique(entity_type, entity_id, number)` |
| `kind` | `baseline`, `import`, `create`, `update`, `archive`, `unarchive`, `publish`, `unpublish`, `translation`, `approve`, `reopen`, `restore` |
| `locale` | the language of a translation change, else null |
| `source_revision`, `entity_version` | English source revision and record version at that moment |
| `title` | the record's title at that moment (lists, search) |
| `data` (`json`) | the **full record** in seed format, all languages (review §M: full snapshots, no deltas) |
| `summary` (`jsonb`) | changed field names; `restored_from` for restores |
| `created_at`, `created_by` | author and time (`null` = system: migration, import) |

`data` is `json`, not `jsonb`, so key order is preserved exactly as exported; comparisons use a
canonical (sorted-key) serialization.

Where revisions are written:

- content editors: create, update, archive/unarchive, page update (`content/cms`);
- translations: save, approve, reopen (`content/translations`);
- publish/unpublish of a record, restore;
- `db:migrate` and `db:import`: `syncRevisions` writes a `baseline` revision for every record
  without one (existing installations get their history started at migration time) and an
  `import` revision when an import changed a record.

**Append-only.** The database refuses `UPDATE`, `DELETE` and `TRUNCATE` on `content_revisions`
for the application role (`REVOKE` plus a `publishing_append_only()` trigger). Retention: revisions
are never deleted (≈ a few KB per record version; pruning is a later, explicit decision).

### Compare and view

`GET …/revisions/{n}` returns a revision as labelled leaf values (`path`, `field`, `locale`,
`value`); `GET …/revisions/{n}/compare?with=current|m` returns only the differing leaves (max 400)
with `before`/`after`. The admin shows them as a table «Поле · Язык · Версия n · Текущая», with
Russian field labels — never raw JSON.

### Restore

`POST /api/v1/content/{type}/{id}/revisions/{n}/restore` (`content.edit`, `If-Match` required,
confirmed in the UI):

- the revision's texts, images, relations and translations become the **working copy** as a new
  revision `restore` (`summary.restored_from = n`); history is never rewritten;
- the record's **status and slug are kept** (publishing state and URLs are not changed by a
  restore);
- field-level rights apply as for an edit: restoring a different SEO title/description/OG image or
  slug needs `seo.edit` — otherwise 403 and an audited `denied`;
- if the English text changes, `source_revision` + 1 and approved translations become *outdated*
  (the restored translation texts are kept, their approval is reset);
- archived records cannot be restored (unarchive first); restoring the current version is refused;
- the **live site does not change** until a release is published.

## 2. Record publishing state

`POST …/{type}/{id}/publish | unpublish` (`content.publish`, `If-Match`): working copy draft ⇄
published. Publishing requires every required English field and published related records.
This only marks the record for the next release («Отметить к публикации»).

## 3. Releases

### Snapshot

«Создать релиз» (`POST /api/v1/releases`, `content.publish`) runs in one `REPEATABLE READ`
transaction: sync revisions, export the store, keep **published records only**, store it in
`content_snapshots` (`store` json + sha256 + per-record revision numbers + translation summary),
create the release `queued`. Edits made afterwards are not in the release. A newer release
supersedes still-queued older ones.

A preview build (`POST /api/v1/previews`; `content.edit`, `seo.edit` or `content.publish`) does
the same with all non-archived records, drafts promoted to published. Preview builds can never be
activated (domain rule, API rule and the `kind` check during activation).

Translation policy at publication (unchanged public fallback, `normalize.ts`): an approved
translation is shown; an *outdated* one keeps showing the previously approved text; missing or
in-progress translations fall back to English. Outdated / fallback counts per language are
release **warnings** (`translation_outdated:<l>:<n>`, `translation_fallback:<l>:<n>`).

**SEO (Phase I-1).** Before the snapshot is stored, the SEO checker runs on it. Any BLOCKING
issue refuses the release (`409 seo_blocking`, nothing stored). SEO warnings are recorded as
`seo_warnings:<n>`. «Отметить к публикации» runs the same check for the record. See
[`admin-seo.md`](admin-seo.md).

### States

```
queued ──▶ building ──▶ validating ──▶ ready ──▶ active ⇄ retired
   │           │             │           │
   ▼           ▼             ▼           ▼
superseded   failed        failed     superseded
```

| from | to |
| --- | --- |
| queued | building, failed, superseded |
| building | validating, failed |
| validating | ready, failed |
| ready | active (publish), superseded (a newer release was published) |
| active | retired (another release activated) |
| retired | active (rollback) |
| failed, superseded | — (final; «Собрать заново» creates a new release from the same snapshot) |

Transitions are defined once in `@soltex/core/domain` (`RELEASE_TRANSITIONS`) and checked on every
update together with the expected current status. Every transition is written to
`release_events` (append-only) and audited. A partial unique index allows at most one `active`
release.

Immutable columns (trigger `releases_immutable_columns`): id, key, kind, snapshot, creator, and the
artifact checksum/size once set. Releases and preview grants cannot be deleted by the app role.

### Build (worker)

`npm run worker -w @soltex/api` — one process next to the API:

- the `releases` table is the queue: the worker claims the oldest `queued` release with
  `FOR UPDATE SKIP LOCKED` while holding a **PostgreSQL session advisory lock** (`724001`), so only
  one build runs at a time, across processes;
- it writes the snapshot to an isolated workspace (`RELEASES_DIR/build/<key>`, a copy of `apps/web`
  with `CONTENT_SOURCE=file`) and runs the **existing** site build (`npm run build`: snapshots →
  vite → prerender → validate-site) with a minimal environment (no secrets) and a timeout;
- heartbeat while building; a release stuck in `building`/`validating` for 2 minutes without
  heartbeat (crashed worker) is marked `failed` (`worker_lost`) by the next worker run;
- at start the worker reconciles the database with the `current` symlink (the symlink is the truth
  of what is served);
- the workspace is always removed;
- when there is no release to build, the same worker makes image copies, sends outbox e-mail and
  anonymizes old leads ([`admin-media.md`](admin-media.md) §9, [`admin-leads.md`](admin-leads.md) §3, §5).

### Checks

Blocking **errors** (the release becomes `failed`, nothing is stored):

- content validation errors of the site build (`content: …` lines), build/prerender/site check failures, timeout;
- required files: `index.html`, `404.html`, `sitemap.xml`, `<l>.html` and `<l>/404.html` for every language;
- every published project, technology and product has its page in all 6 languages;
- no secret-like content in text files (database URLs, private keys, secret names, the configured secrets);
- at least one page.

**Warnings** (do not block): translation outdated / fallback counts per language; page count
changed by more than max(5, 10 %) compared with the active release.

### Artifacts

```
RELEASES_DIR/
  releases/<key>/   immutable artifact + release.json (manifest, checksum), read-only
  current           symlink → releases/<key>   (the only thing the web server serves)
  build/<key>/      scratch workspace of a running build
  blobs/<sha256>    files ≥ 1 MB shared between releases by hard links
```

Release key: `R-YYYYMMDD-HHMMSS-<6 hex>` (preview: `P-…`). The checksum is SHA-256 over
`path\tsha256\n` of every file (sorted, manifest excluded) and is stored in the database.

### Publish (activation)

`POST /api/v1/releases/{id}/activate` (`content.publish`, `If-Match`, confirmed in the UI):

1. activation advisory lock (`724002`): a concurrent activation gets 409, never a double switch;
2. the release must be `ready`, `kind = release`, version as expected; a release whose snapshot is
   **older than the active one** is refused (stale-release protection — use rollback instead);
3. the artifact is verified against the stored checksum (missing or modified files → refused);
4. `current` is replaced atomically (`symlink current.<rand>` + `rename`);
5. smoke check of the served tree (index and 404 pages of every language);
6. one transaction: previous active → `retired`, target → `active`, other `ready` releases →
   `superseded`, events and audit.

Any failure in 3–6 switches `current` back to the previous release, writes an
`activation_failed` event and an audited failure; the site keeps serving the previous release.

### Rollback

`POST /api/v1/releases/{id}/rollback` (`system.rollback` = Owner/Admin, **step-up**: second factor
within 10 minutes; confirmed in the UI): a `retired` release becomes `active` again with exactly
the same steps 1, 3–6 — no rebuild, the stored artifact is served. Later content stays in the
admin and goes out with the next release.

### Retry

`POST /api/v1/releases/{id}/retry` (`system.deploy`): a `failed` release gets a new `queued`
release with the same snapshot.

## 4. Preview

- `POST /api/v1/releases/{id}/preview` (`content.read`) returns
  `${PREVIEW_ORIGIN}/__preview#t=<token>&p=<path>`: the one-time token is in the **URL fragment**,
  which browsers never send to a server, so it is in no server log or referrer.
- The preview origin (`npm run preview-server -w @soltex/api`, separate origin, e.g.
  `https://preview.soltexglobal.co`) serves a tiny start page (strict CSP) that removes the
  fragment from the address bar and exchanges the token by `POST /__preview/session`
  (`X-Requested-With`, origin check) for an `HttpOnly`, `SameSite=Strict` cookie
  (`__Host-soltex_preview`, `Secure` on https).
- Only hashes of token and cookie are stored (`preview_grants`). The token works once.
- A grant expires after 30 minutes and is bound to the admin **session**: logout, session revoke,
  idle timeout or a disabled user end it. `POST /api/v1/preview/revoke` closes every preview of the
  user; `/__preview/close` closes the current one.
- Every response: `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store`,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and a
  `Content-Security-Policy` (release files get the site policy `SITE_CSP`; Phase M-1);
  `/robots.txt` disallows everything; `release.json` is hidden.
- All six languages are served with the public routing rules (and localized 404s).
- The preview server logs method, path and status only — never tokens or cookies.

## 5. API

| method | path | permission |
| --- | --- | --- |
| GET | `/api/v1/revisions` (`type`, `entity`, `kind`, `q`, paging) | content.read |
| GET | `/api/v1/content/{type}/{id}/revisions/{n}` | content.read |
| GET | `/api/v1/content/{type}/{id}/revisions/{n}/compare?with=current\|m` | content.read |
| POST | `/api/v1/content/{type}/{id}/revisions/{n}/restore` (If-Match) | content.edit (+ seo.edit per field) |
| POST | `/api/v1/content/{type}/{id}/publish` / `unpublish` (If-Match) | content.publish |
| GET | `/api/v1/publishing/overview` | content.read |
| GET | `/api/v1/releases`, `/api/v1/releases/{id}` (ETag) | content.read (artifact details: system.read) |
| POST | `/api/v1/releases` | content.publish |
| POST | `/api/v1/previews` | content.edit \| seo.edit \| content.publish |
| POST | `/api/v1/releases/{id}/activate` (If-Match) | content.publish |
| POST | `/api/v1/releases/{id}/rollback` (If-Match) | system.rollback + step-up |
| POST | `/api/v1/releases/{id}/retry` | system.deploy |
| POST | `/api/v1/releases/{id}/preview` | content.read |
| POST | `/api/v1/preview/revoke` | content.read |

Zod schemas, RFC 9457 problems, CSRF on every change; OpenAPI (`apps/api/openapi.json`; these routes
since 0.7.0, now 0.14.0) and the admin types are generated and checked in CI.

## 6. Authorization and audit

Permissions follow the approved role matrix (no `isAdmin` bypass, no wildcards). Audited actions:
`content.publish`, `content.unpublish`, `revision.restore` (success / denied), `release.create`,
`release.build`, `preview.build`, `release.activate`, `release.rollback` (success / failure with
reason), `release.retry`, `preview.grant`, `preview.revoke`. Summaries use whitelisted keys only
(`target`, `status`, `reason`, `count`, `fields`, `revision`); preview tokens never appear.

## 7. Admin («Публикация»)

- **Обзор** `/publishing`: what is live, builds in progress (polled), records changed since the
  live release (by content, not only revision number), recent and failed releases; «Создать релиз»
  (confirmation), «Предпросмотр черновиков».
- **Ревизии** `/publishing/revisions`: all revisions with filters; `/publishing/revisions/{type}/{id}`
  is the full history of one record. Editors show the last 8 versions under «История изменений».
- **Релизы** `/publishing/releases` and the release page: build steps, «Что изменится на сайте»,
  checks (errors apart from warnings), translations per language, events, technical details
  under «Дополнительно»; actions «Открыть предпросмотр», «Опубликовать», «Вернуть на сайт»
  (step-up), «Собрать заново» — each with a confirmation stating the consequences.
- ⌘K lists the screens and finds records (Phase L); there are no publish, rollback or restore
  commands.

## 8. Deployment assumptions

- `RELEASES_DIR` (required in production, e.g. `/srv/soltex`) is on one local filesystem (atomic
  rename, hard links). nginx serves `RELEASES_DIR/current` for the public site with the existing
  rules of `serve-dist`.
- `PREVIEW_ORIGIN` (https in production, different from `ADMIN_ORIGIN`) is proxied to the preview
  server on loopback (`PREVIEW_PORT`).
- The worker and the preview server run as separate processes of the same codebase (systemd units),
  with the same `DATABASE_URL` as the API. The worker needs the repository checkout (it runs the
  site build).
- In development `RELEASES_DIR` defaults to `<repo>/.releases` (git-ignored).

## 9. Known limitations and deviations

- **No pg-boss, no `flock`:** the releases table is the queue and PostgreSQL advisory locks
  serialize builds and activations (no new dependency; architecture §5 intent kept).
- The production nginx switch to `RELEASES_DIR/current` is **not verified** here; activation was
  tested against temporary release directories (DB tests and E2E) only.
- No release pruning yet: artifacts and snapshots accumulate (blobs are shared). Pruning must
  keep the active release and the rollback targets.
- No publishing hold after a rollback: the next publish simply replaces the rolled-back release.
- The preview shows the built site without an overlay banner; preview of unsaved edits is not
  possible — a preview always needs a (short) build.
- Changes are listed per record; the field-level difference is in the record's history.
