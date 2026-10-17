# Soltex Global

Monorepo of the Soltex Global website platform. Source of truth for the architecture: [`docs/admin-architecture-approved.md`](docs/admin-architecture-approved.md). Phase-by-phase implementation status: [`docs/admin-architecture-implementation.md`](docs/admin-architecture-implementation.md).

| Workspace | What | Status (Phase N-0) |
|---|---|---|
| [`apps/web`](apps/web) | Public website: React 19 + Vite, static prerender, 6 languages | Built from the seed or from a database export; robots.txt, JSON-LD and og:image on every page |
| [`apps/admin`](apps/admin) | Admin SPA (Russian UI) | Sign-in, content, translations, publishing, SEO and redirects, media, leads, overview, users, audit log, site settings, system status |
| [`apps/api`](apps/api) | API, background worker and preview server (Fastify 5, PostgreSQL 17) | `/api/v1` 0.14.0, 184 operations; migrations `0000`–`0010` |
| [`packages/core`](packages/core) | Shared domain layer: domain, validation, SEO, content | Domain rules, SEO checker, redirects, content schemas (`validation` still empty) |

Server files (nginx, systemd, backup / update / smoke scripts, env templates) are in [`deploy/`](deploy); the server itself is not set up yet. See [`docs/deployment.md`](docs/deployment.md) and the step-by-step [`docs/deploy-runbook-ru.md`](docs/deploy-runbook-ru.md).

## Requirements

Node.js 22 (`.nvmrc`), npm (workspaces). PostgreSQL 17 for the API. Run all commands from the repository root.

```
npm install
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` / `npm run dev:web` | Public site dev server, http://localhost:3000 |
| `npm run dev:admin` | Admin dev server. Open http://localhost:3001 (not 127.0.0.1: CSRF checks and passkeys are bound to that origin) |
| `npm run dev:api` | API dev server, http://127.0.0.1:3100/api/v1/health |
| `npm run content` | Build the content snapshots of the site (validation + SEO check) |
| `npm run build` / `npm run build:web` | Public site: content validation → vite build → prerender → validate-site → `apps/web/dist` |
| `npm run build:admin` | Admin: type check + build → `apps/admin/dist` |
| `npm run build:all` | Both builds |
| `npm run validate` | Re-run the site checks on `apps/web/dist` |
| `npm run typecheck` | Type check of all workspaces (web includes content validation) |
| `npm run check:deps` | Dependency direction (core ← apps, no app → app), reviewed `sql.raw` uses, and site CSP consistency (`scripts/check-*.mjs`) |
| `npm run lint` | `typecheck` + `check:deps` |
| `npm test` | Unit tests of core, api, admin and web (132: core 46, api 27, admin 49, web 10) |
| `npm run test:db` | API database tests (166: 165 pass, 1 skipped by design; file list in `apps/api/package.json` `test:db`; needs a provisioned PostgreSQL 17) |
| `npm run test:e2e:admin` | End-to-end tests: API + PostgreSQL + Chromium (104; `scripts/admin-e2e.mjs`) |
| `npm run db:migrate` / `db:import` / `db:export` | Database migrations, seed import, content export (see `apps/api/README.md`) |
| `npm run openapi` | Regenerate `apps/api/openapi.json` |
| `npm run auth:bootstrap-owner` | Create the first Owner from the console |
| `npm run qa -- --base <dist>` or `--base-ref <git-ref>` | Public-site regression against a baseline (needs Playwright; see `apps/web/scripts/qa/README.md`) |
| `npm run serve:dist` | Serve `apps/web/dist` like a static host (real 404s), port 4173 |

The worker and the preview server run with `npm run worker -w @soltex/api` and `npm run preview-server -w @soltex/api`.

Hosting: the public site is static. In production the publishing worker builds each release and nginx serves the active one (`RELEASES_DIR/current`). Netlify (`netlify.toml`) is a temporary demo only; production runs on a Host.KZ-compatible VPS (see `docs/deployment.md` and the approved architecture).
