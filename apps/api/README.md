# @soltex/api

API + background worker of Soltex Global (Fastify 5, modular monolith). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md).

**Status (Phase A):** bootstrap only.
- `GET /api/v1/health` → `{ "status": "ok" }` (`Cache-Control: no-store`);
- `X-Request-ID` echoed or generated;
- configuration from environment variables (`src/config.ts`).

**Not yet:** PostgreSQL, Drizzle, migrations, auth, sessions, RBAC, audit log, content, media, leads, e-mail, publishing, pg-boss (Phase B and later).

```
npm run dev:api          # from the repository root, http://127.0.0.1:3100/api/v1/health
npm run test -w @soltex/api
npm run typecheck -w @soltex/api
```

The API listens on `127.0.0.1` only; in production nginx is the public entry point (approved architecture §10). It sends no CORS headers.
