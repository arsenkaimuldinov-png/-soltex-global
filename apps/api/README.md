# @soltex/api

API, background worker and preview server of Soltex Global (Fastify 5, Drizzle, PostgreSQL 17; modular monolith). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md).

**Status (Phase N-0):** `/api/v1` 0.15.0, 184 operations; migrations `0000`–`0010`.
- Authentication ([`docs/admin-auth.md`](../../docs/admin-auth.md)):
  - users with 6 fixed roles; explicit permission matrix in `@soltex/core/domain` (no wildcard);
  - Argon2id passwords, progressive delay and lock-out, password change and reset;
  - temporary initial passwords (valid 7 days, replaced at the first sign-in; migration `0010`);
  - server-side opaque sessions (`__Host-soltex_session`, HttpOnly, Secure, SameSite=Strict), idle 8 h, absolute 12 h, revoke and revoke-all;
  - WebAuthn passkeys (required for Owner/Admin), TOTP fallback (encrypted secret), one-time recovery codes, step-up.
- Content, translations, publishing (revisions, releases, preview), SEO check, redirects, media library, leads, site settings, dashboard, search and system status (see `docs/admin-*.md`).
- Hourly cleanup of expired sessions, challenges, password resets, known devices and sent outbox rows (`src/system/cleanup.ts`, [`docs/admin-database.md`](../../docs/admin-database.md) §8).
- Append-only `audit_events` (database trigger + grants).
- `/api/v1` with RFC 9457 errors, `X-Request-ID`, rate limits, security headers, CSRF header, no CORS.
- OpenAPI 3.1: [`openapi.json`](openapi.json) (generated, checked in CI).

**Not yet:** password-reset and security-alert e-mails are not sent (the notifier only logs that one was due; they move to the outbox once SMTP is known). pg-boss is not used: the worker queues on PostgreSQL tables.

```
npm run dev:api                       # from the repository root, http://127.0.0.1:3100/api/v1/health
npm run worker -w @soltex/api         # release builds, image copies, outbox e-mail, lead anonymization, cleanup
npm run preview-server -w @soltex/api # preview origin (PREVIEW_PORT, default 3102)
npm run test -w @soltex/api           # unit tests (27), including the deploy/ files check
npm run typecheck -w @soltex/api
npm run db:migrate                    # MIGRATION_DATABASE_URL (role soltex_migrate)
npm run db:import                     # DATABASE_URL; seed → database (idempotent)
npm run db:export -- --out <dir> | --file <store.json>
npm run media:variants -w @soltex/api # make all missing image copies (DATABASE_URL, MEDIA_DIR)
npm run test:db                       # needs a provisioned PostgreSQL 17; resets content tables, adds test users
npm run openapi -w @soltex/api        # regenerate openapi.json after changing routes
npm run openapi:check -w @soltex/api  # CI check that openapi.json is current
npm run auth:bootstrap-owner          # first Owner; interactive, password not echoed; refuses if an Owner exists
```

Configuration: see `.env.example`. In production the API also refuses to start without `RELEASES_DIR`, `MEDIA_DIR` and an https `PREVIEW_ORIGIN`.

The API listens on `127.0.0.1` only; in production nginx is the public entry point (approved architecture §10). It sends no CORS headers.
