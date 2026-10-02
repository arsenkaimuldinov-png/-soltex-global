# @soltex/core

Shared domain layer of the Soltex Global platform. Source of truth for the architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md) (§18).

**Status (Phase A):** skeleton only. The four layers exist and export nothing yet. No frontend code was moved here.

## Layers

| Subpath | Contents (from Phase B on) | May import |
|---|---|---|
| `@soltex/core/domain` | domain types, locales, permission map, roles, publication/translation state machines, IDs | nothing else in core |
| `@soltex/core/validation` | shared Zod primitives, entity input schemas | `domain` |
| `@soltex/core/seo` | slug rules, SEO checker, canonical/hreflang algorithm, redirect graph | `domain`, `validation` |
| `@soltex/core/content` | content store format, page-slot registry, JSONB schemas, `normalize` | `domain`, `validation` |

`seo` and `content` do not import each other. If one ever needs the other, the shared part moves down into `domain`.

## Dependency direction

```
apps/web     apps/admin     apps/api
      \          |          /
       ▼         ▼         ▼
           packages/core
```

- Applications may import `@soltex/core/*`.
- `packages/core` **never** imports from `apps/*` or `@soltex/web|admin|api`.
- Applications do not import each other.

## What core must not contain

- React, React DOM, Vite, Tailwind or any UI code.
- DOM or browser APIs: `window`, `document`, `localStorage`, …. `tsconfig.json` has `lib: ["ES2022"]` and `types: []`, so these do not compile.
- Node-only APIs (`fs`, `path`, `process`). Core must run in the browser (admin), in Node (API, build) and in tests.
- Runtime dependencies other than Zod (added when the first schema arrives).

## Checks

- `npm run check:deps` (repository root): runs `scripts/check-deps.mjs`, which enforces all rules above and the layer table. CI runs it.
- `npm run typecheck -w @soltex/core`.
