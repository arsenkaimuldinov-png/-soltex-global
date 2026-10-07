# @soltex/api

API + background worker of Soltex Global (Fastify 5, modular monolith). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md).

**Status (Phase B):** content database (schema, migrations, roles, import/export, `docs/admin-database.md`) plus the Phase A bootstrap:
- `GET /api/v1/health` → `{ "status": "ok" }` (`Cache-Control: no-store`);
- `X-Request-ID` echoed or generated;
- configuration from environment variables (`src/config.ts`).

**Not yet:** auth, sessions, RBAC, audit log, content API endpoints, media, leads, e-mail, publishing, pg-boss (Phase C and later).

```
npm run dev:api          # from the repository root, http://127.0.0.1:3100/api/v1/health
npm run test -w @soltex/api
npm run typecheck -w @soltex/api
npm run db:migrate       # MIGRATION_DATABASE_URL (role soltex_migrate)
npm run db:import        # DATABASE_URL; seed → database (idempotent)
npm run db:export -- --out <dir> | --file <store.json>
npm run test:db          # needs a provisioned PostgreSQL 17; resets content tables
```

The API listens on `127.0.0.1` only; in production nginx is the public entry point (approved architecture §10). It sends no CORS headers.
