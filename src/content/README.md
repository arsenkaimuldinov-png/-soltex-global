# src/content — content layer

The Soltex site separates **presentation**, **content**, **data** and **infrastructure**. Components render content; they never contain content and never know where it came from.

```
seed/*.json                       stored content, all languages (source of truth until the custom admin exists)
  │  sources/seed.ts              ContentSource (a custom-admin API source plugs in here later)
  ▼
scripts/content/build-snapshots.ts   validate → normalize.ts → snapshot/<locale>.json (generated, git-ignored)
  ▼
src/i18n/bundles.ts               loads the snapshot of the visitor's language (English bundled, others lazy)
  ▼
getters.ts / useContent.ts        useContent(), usePage(key) → components
```

| File | Purpose |
|---|---|
| `types.ts` | Domain model: stored `*Record` types (multilingual) and resolved types (one language) |
| `locale.ts` | `Localized<T>` = `{ en, ru, zh, tr, ar, es }` |
| `normalize.ts` | Stored → resolved, for one language. Applies the publishing filter, the translation fallback and media URLs |
| `media.ts` | Media URL resolution (`MEDIA_BASE_URL`) |
| `routes.ts` | Code-owned URL patterns, the public path list, and route → content resolution |
| `getters.ts` | `createContentApi(snapshot)` and page accessors (`c`, `cr`, `list`, `media`) |
| `useContent.ts` | React hooks |
| `source.ts`, `sources/` | Content source interface and the seed implementation |
| `seed/` | The content itself |

## Rules

- No component imports `seed/`, `snapshot/`, `src/data/*` or a backend client. They use `useContent()` and `usePage()` only.
- Content text never goes through `t()`. `t()` is for UI strings (`src/i18n/ui`) only.
- Relations reference **IDs** (`relatedTechnologyId: "technology-pectin"`), never slugs.
- Only `published` records are rendered. Unapproved translations fall back to English for the whole record.
- Editing content: change `seed/*.json`, then run `npm run content` (also runs automatically before `dev`, `lint` and `build`). The command validates IDs, slugs, relations, media references, English text, placeholders and UI keys, and **fails** on errors.

See `docs/custom-admin-architecture.md` (future admin and API) and `docs/content-inventory.md` (what is where).
