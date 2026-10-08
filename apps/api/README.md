# @soltex/api

API + background worker of Soltex Global (Fastify 5, modular monolith). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md).

**Status (Phase C):** authentication, second factors, roles and audit log on top of the Phase B content database. Details: [`docs/admin-auth.md`](../../docs/admin-auth.md).
- users with 6 fixed roles; explicit permission matrix in `@soltex/core/domain` (no wildcard);
- Argon2id passwords, progressive delay and lock-out, password change and reset (reset e-mail from Phase K);
- server-side opaque sessions (`__Host-soltex_session`, HttpOnly, Secure, SameSite=Strict), revoke and revoke-all;
- WebAuthn passkeys (required for Owner/Admin), TOTP fallback (encrypted secret), one-time recovery codes, step-up;
- append-only `audit_events` (database trigger + grants);
- `/api/v1` with RFC 9457 errors, `X-Request-ID`, rate limits, security headers, CSRF header, no CORS;
- OpenAPI 3.1: [`openapi.json`](openapi.json) (generated, checked in CI);
- first Owner from the console: `npm run auth:bootstrap-owner`.

**Not yet:** admin UI, content API endpoints, publishing, preview, media, leads, e-mail delivery, pg-boss (Phase D and later).

```
npm run dev:api          # from the repository root, http://127.0.0.1:3100/api/v1/health
npm run test -w @soltex/api
npm run typecheck -w @soltex/api
npm run db:migrate       # MIGRATION_DATABASE_URL (role soltex_migrate)
npm run db:import        # DATABASE_URL; seed → database (idempotent)
npm run db:export -- --out <dir> | --file <store.json>
npm run test:db          # needs a provisioned PostgreSQL 17; resets content tables, adds test users
npm run openapi -w @soltex/api        # regenerate openapi.json after changing routes
npm run auth:bootstrap-owner          # first Owner; interactive, password not echoed; refuses if an Owner exists
```

The API listens on `127.0.0.1` only; in production nginx is the public entry point (approved architecture §10). It sends no CORS headers.
