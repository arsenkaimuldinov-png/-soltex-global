# @soltex/web

Public website of Soltex Global: React 19 + Vite, prerendered to static HTML, 6 languages (en, ru, zh, tr, ar, es). Content layer: [`src/content/README.md`](src/content/README.md). Hosting: [`docs/deployment.md`](../../docs/deployment.md).

## Commands

Run from the repository root (`npm run <script> -w @soltex/web`) or use the root aliases.

| Script | Does |
|---|---|
| `dev` | Content snapshots, then the dev server on port 3000 |
| `content` | Build the content snapshots (`scripts/content/build-snapshots.ts`): validation and SEO check; fails on errors |
| `build` | content → `vite build` → prerender (`scripts/prerender.ts`: pages with JSON-LD, 404 pages, `sitemap.xml`, `robots.txt`) → site checks (`scripts/validate-site.ts`) → `dist/` |
| `validate` | Re-run the site checks on `dist/` |
| `serve:dist` | Serve `dist/` like the production server (real 404s), port 4173 |
| `lint` | content + type check |
| `test` | Unit tests (`test/*.test.ts`, 10: leads and attribution 6, og:image and JSON-LD 4) |

## Build variables

None of them is secret; their values end up in the generated files.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://soltexglobal.co` | Origin of canonical, hreflang, OG, JSON-LD, sitemap and robots.txt URLs |
| `CONTENT_SOURCE` | `seed` | `seed` (`src/content/seed`) or `file` (a database export) |
| `CONTENT_STORE_FILE` | — | With `CONTENT_SOURCE=file`: path of the content store JSON (`npm run db:export -- --file`) |
| `MEDIA_BASE_URL` | empty | Optional media host; empty = same origin |
| `MEDIA_ROOT` | — | Media library directory; `validate-site` checks `/media/…` references against it. The publishing worker sets it |
| `SOLTEX_LEADS_ENDPOINT` | empty | Absolute URL of `POST /api/v1/public/leads`. Empty: the forms use the demo service and nothing is sent |
| `SOLTEX_ATTRIBUTION` | empty | `true`: UTM attribution (needs the endpoint) |

In production the publishing worker builds the site with `CONTENT_SOURCE=file` and sets the other variables (see `docs/admin-publishing.md`).
