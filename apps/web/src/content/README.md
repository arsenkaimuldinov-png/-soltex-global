# src/content — content layer

The Soltex site separates **presentation**, **content**, **data** and **infrastructure**. Components render content; they never contain content and never know where it came from.

```
seed/*.json  or  a database export   stored content, all languages
  │  sources/seed.ts | sources/file.ts   ContentSource (CONTENT_SOURCE=seed | file)
  ▼
scripts/content/build-snapshots.ts   validate → normalize.ts → snapshot/<locale>.json (generated, git-ignored)
  ▼
src/i18n/bundles.ts               loads the snapshot of the visitor's language (English bundled, others lazy)
  ▼
getters.ts / useContent.ts        useContent(), usePage(key) → components
```

In production the content lives in the database and is edited in the admin. The publishing worker builds each release from a database export (`CONTENT_SOURCE=file`). The seed is the content of development builds and of the first `db:import`.

| File | Purpose |
|---|---|
| `types.ts` | Domain model: stored `*Record` types (multilingual) and resolved types (one language) |
| `locale.ts` | `Localized<T>` = `{ en, ru, zh, tr, ar, es }` |
| `normalize.ts` | Stored → resolved, for one language. Applies the publishing filter, the translation fallback and media URLs |
| `media.ts` | Media URLs (`MEDIA_BASE_URL`) and responsive `srcset` from image copies (`buildSrcSet`, `responsive`) |
| `routes.ts` | Code-owned URL patterns, the public path list, and route → content resolution |
| `getters.ts` | `createContentApi(snapshot)` and page accessors (`c`, `cr`, `list`, `media`) |
| `useContent.ts` | React hooks |
| `source.ts`, `sources/` | Content source interface; the seed and file (database export, `CONTENT_STORE_FILE`) implementations |
| `seed/` | The seed content |

## Rules

- No component imports `seed/`, `snapshot/`, `src/data/*` or a backend client. They use `useContent()` and `usePage()` only.
- Content text never goes through `t()`. `t()` is for UI strings (`src/i18n/ui`) only.
- Relations reference **IDs** (`relatedTechnologyId: "technology-pectin"`), never slugs.
- Only `published` records are rendered. Unapproved translations fall back to English for the whole record.
- Content is edited in the admin. Changing `seed/*.json` is for development only; then run `npm run content` (also runs automatically before `dev`, `lint` and `build`). The command validates IDs, slugs, relations, media references, English text, placeholders, UI keys and SEO, and **fails** on errors.

See `docs/admin-architecture-approved.md` (admin and API), `docs/admin-publishing.md` (releases) and `docs/content-inventory.md` (what is where).
