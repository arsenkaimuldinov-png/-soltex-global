# Soltex Global

Monorepo of the Soltex Global website platform. Source of truth for the architecture: [`docs/admin-architecture-approved.md`](docs/admin-architecture-approved.md). Phase-by-phase implementation status: [`docs/admin-architecture-implementation.md`](docs/admin-architecture-implementation.md).

| Workspace | What | Status |
|---|---|---|
| [`apps/web`](apps/web) | Public website: React 19 + Vite, static prerender, 6 languages | Production baseline (Phase 1) |
| [`apps/admin`](apps/admin) | Admin SPA (Russian UI) | Phase A shell only |
| [`apps/api`](apps/api) | API + worker (Fastify) | Phase A bootstrap only (`/api/v1/health`) |
| [`packages/core`](packages/core) | Shared domain layer: domain, validation, SEO, content | Phase A skeleton only |

## Requirements

Node.js 22 (`.nvmrc`), npm (workspaces). Run all commands from the repository root.

```
npm install
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` / `npm run dev:web` | Public site dev server, http://localhost:3000 |
| `npm run dev:admin` | Admin dev server, http://127.0.0.1:3001 |
| `npm run dev:api` | API dev server, http://127.0.0.1:3100/api/v1/health |
| `npm run build` / `npm run build:web` | Public site: content validation → vite build → prerender → validate-site → `apps/web/dist` |
| `npm run build:admin` | Admin: type check + build → `apps/admin/dist` |
| `npm run typecheck` | Type check of all workspaces (web includes content validation) |
| `npm run check:deps` | Dependency direction (core ← apps, no app → app) |
| `npm run lint` | `typecheck` + `check:deps` |
| `npm test` | Unit tests (API) |
| `npm run qa -- --base <dist>` or `--base-ref <git-ref>` | Public-site regression against a baseline (needs Playwright; see `apps/web/scripts/qa/README.md`) |
| `npm run serve:dist` | Serve `apps/web/dist` like a static host (real 404s), port 4173 |

Hosting: the public site is static (`apps/web/dist`). Netlify (`netlify.toml`) is a temporary demo only; production runs on a Host.KZ-compatible VPS (see `docs/deployment.md` and the approved architecture).
