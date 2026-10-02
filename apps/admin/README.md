# @soltex/admin

Admin SPA of Soltex Global (React + Vite, Russian UI). Architecture: [`docs/admin-architecture-approved.md`](../../docs/admin-architecture-approved.md).

**Status (Phase A):** application shell only — one placeholder screen. No login, auth, RBAC, data, CRUD, editor, media, translations, dashboard, publishing or preview yet (Phase C/D and later).

```
npm run dev:admin        # from the repository root, http://127.0.0.1:3001
npm run build:admin      # type check + production build → apps/admin/dist
```

The admin is never indexed (`noindex` meta, `robots.txt` Disallow) and is not linked from the public site.
