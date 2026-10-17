# @soltex/admin

Admin SPA of Soltex Global (React 19 + Vite + Tailwind 4, Russian UI). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md); this app: [`docs/admin-ui.md`](../../docs/admin-ui.md).

**Status (Phase M-1):**
- Sign-in, second factor (passkey, authenticator app, recovery code), mandatory enrollment, password reset pages, temporary initial passwords («Придумайте свой пароль»).
- Step-up dialog, sessions that end cleanly (another tab, expiry, revoke).
- Sidebar and ⌘K driven by the user's permissions; ⌘K also finds records, media files and leads.
- «Обзор» (dashboard), content editors, translations, «Публикация» (revisions, releases, preview), SEO check and redirects, «Медиатека», «Заявки».
- Profile and security: passkeys, authenticator app, recovery codes, password, sessions.
- Пользователи, Журнал действий, Система.

**Not yet:** a settings screen (lead notice recipients come from the environment).

```
npm run dev:api                          # API on 127.0.0.1:3100 (needs DATABASE_URL and keys, see .env.example)
npm run dev:admin                        # http://localhost:3001, /api is proxied to the API (same origin)
npm run build:admin                      # type check + production build → apps/admin/dist
npm run test -w @soltex/admin            # unit tests (no browser)
npm run api:types -w @soltex/admin       # regenerate src/lib/api/schema.gen.ts after an API change
npm run api:types:check -w @soltex/admin # CI check that the generated types are current
npm run test:e2e:admin                   # end to end: API + PostgreSQL + Chromium (scripts/admin-e2e.mjs)
```

Open the admin at `http://localhost:3001` (the API's default `ADMIN_ORIGIN`), not `127.0.0.1`: CSRF checks and passkeys are bound to that origin.

The admin is never indexed (`noindex` meta, `robots.txt` Disallow) and is not linked from the public site.
