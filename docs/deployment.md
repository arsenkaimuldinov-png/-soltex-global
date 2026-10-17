# Deployment

The site is a **static, prerendered build** with no runtime dependency on any hosting provider or CMS. Its pages never depend on the backend. Two features use the API at runtime: redirects of old addresses (nginx `@lookup`) and the lead form (`POST /api/v1/public/leads`). When the API is down, unknown addresses get the 404 page, and the forms are off unless `SITE_LEADS_ENABLED` is on.

| Environment | Flow | Status |
|---|---|---|
| **DEMO / client preview** | GitHub → Netlify (`netlify.toml`) | **Temporary.** Used only to present the site to Soltex and get approval |
| **PRODUCTION** | Admin «Создать релиз» → the worker builds the release → «Опубликовать» switches `RELEASES_DIR/current` → nginx on **Host.KZ** → `soltexglobal.co` ([`admin-publishing.md`](admin-publishing.md)) | Final target. Server setup (Phase N) **to be finalized after the exact Host.KZ hosting plan is confirmed** |

Netlify is not part of the application architecture. The only Netlify-specific file is `netlify.toml`, which holds the build command, the publish directory and the localized 404 rules. There are no Netlify Functions, Blobs, Forms, Identity or build hooks.

## Build

| | |
|---|---|
| Runtime | Node.js 22 (`.nvmrc`; Vite 8 needs ≥ 22.12 or ^20.19) |
| Install | `npm ci` |
| Build | `npm run build` (repository root). This runs four steps: content snapshots + validation, `vite build`, prerender (`apps/web/scripts/prerender.ts`) and site validation (`apps/web/scripts/validate-site.ts`) |
| Output | `apps/web/dist`. In production the worker builds each release into `RELEASES_DIR/releases/<key>`; nothing is uploaded by hand |
| Local check | `npm run serve:dist` (http://localhost:4173). It behaves like the production server rules below, including real 404s |

The build **fails** if content is invalid or if any SEO, link, image or portability check fails. A failed build never produces a half-valid site.

### Environment variables (all optional, build time only)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://soltexglobal.co` | Origin used for canonical, hreflang, OG and sitemap URLs. On the demo it can stay at the production origin, which keeps demo URLs out of the canonical tags |
| `CONTENT_SOURCE` | `seed` | Content source for the build. `seed` is the JSON in `apps/web/src/content/seed`. `file` is a database export; the publishing worker always uses it |
| `CONTENT_STORE_FILE` | *(none)* | With `CONTENT_SOURCE=file`: path of the content store JSON (`npm run db:export -- --file <store.json>`) |
| `MEDIA_ROOT` | *(none)* | Media library directory. `validate-site` checks `/media/…` references against it; without it such a reference fails the build. The worker sets it to `MEDIA_DIR` |
| `MEDIA_BASE_URL` | *(empty)* | Prefix for media files if they move to object storage or a CDN later. Empty means the files are served from the site |
| `SOLTEX_LEADS_ENDPOINT` | *(empty)* | Phase K-2. Absolute URL of `POST /api/v1/public/leads`. Empty: the forms use the demo service and nothing is sent. Set by the publishing builder from the API's `SITE_LEADS_ENABLED` |
| `SOLTEX_ATTRIBUTION` | *(empty)* | Phase K-2. `true`: UTM attribution is recorded and sent with leads (needs the endpoint). Set from `ATTRIBUTION_ENABLED`. Off: no attribution code in the bundle |

The site build gets no secrets: the worker runs it with a minimal environment. Server secrets (`DATABASE_URL`, `DATA_ENCRYPTION_KEYS`, `HASH_SECRET`, `SMTP_URL`, …; see `.env.example`) exist only in the environment of the API and the worker. Secrets must never be site build variables. They must never use the `VITE_` prefix, because those values are embedded in the browser bundle. `validate-site` fails the build if secret-looking values appear in `dist/`.

## Output layout and routing

```
dist/index.html                 /
dist/company.html               /company
dist/company/global-presence.html
dist/projects/solbar-israel.html
dist/ru.html                    /ru
dist/ru/company.html            /ru/company            (same for zh, tr, ar, es)
dist/404.html                   not-found page (English)
dist/ru/404.html                not-found page per language
dist/sitemap.xml
dist/assets/*                   hashed JS/CSS (immutable)
dist/images/*, dist/videos/*    media (unchanged paths)
```

Server rule (the same on any server):

1. Serve the file if it exists.
2. Otherwise serve `<path>.html` if it exists.
3. Otherwise answer with **HTTP 404**, using `/<locale>/404.html` for URLs under `/ru`, `/zh`, `/tr`, `/ar` or `/es`, and `/404.html` for everything else.

**There is no SPA fallback** (`/* → /index.html 200`). That fallback caused soft 404s and must not be reintroduced. The client-side router still handles in-app navigation.

> A `404.html` file alone is **not** a real 404. The server must send status code 404 together with it. Check with `curl -I https://soltexglobal.co/does-not-exist` → `HTTP/2 404`.

### nginx (Phase I-2: `deploy/nginx/soltexglobal.conf`)

The site configuration is a file in the repository: `deploy/nginx/soltexglobal.conf`. It is tested automatically with the real file (`apps/api/test/nginx.db.test.ts`). It implements the rule above, plus redirects of old addresses (approved architecture §11; docs/admin-seo.md §10):

1. **Existing file:** `try_files $uri $uri.html $uri/index.html` serves the page. The API is not involved, so the site works with the admin, API or database down.
2. **Trailing slash:** a 301 to the address without the slash when that page exists. Never a directory listing.
3. **Anything else:** `@lookup` asks the API on loopback (`/internal/v1/redirect`, 1 s connect / 2 s read, rate-limited). The API answers with a 301/302 to `https://soltexglobal.co` + an internal path, or 404.
4. **404, API down, slow or failing:** status **404** with `/<locale>/404.html` (by the language prefix of the request) or `/404.html`. Never a 502.

Installation notes:
- `root` is the `current` symlink of the publishing system (`/srv/soltex/current`).
- The API listens on `127.0.0.1:3100` (`API_PORT`).
- Set `PUBLIC_SITE_URL=https://soltexglobal.co` for the API.
- Leads (Phase K): set `SMTP_URL`, `MAIL_FROM`, `LEAD_NOTIFY_TO`, `LEAD_RETENTION_MONTHS` (and `PRIVACY_NOTICE_VERSION` once the text exists) for the API and the worker. On the site host nginx proxies only `POST /api/v1/public/leads` to the API. See [`admin-leads.md`](admin-leads.md).
- Site forms (Phase K-2): `SITE_LEADS_ENABLED` and `ATTRIBUTION_ENABLED` for the worker (and the API, which reports them in «Заявки»). Both `false` until the client approves the privacy texts. A change applies from the next published release.
- Media library (Phase J): `MEDIA_DIR=/srv/soltex/media` for the API and the worker. nginx serves `MEDIA_DIR/originals/` and `MEDIA_DIR/variants/` (responsive copies, J-2) as `/media/…` (immutable, one-year cache). After the first deployment, run `npm run media:variants -w @soltex/api` once (the worker keeps them up to date afterwards). The files are not copied into releases; back them up with restic (approved §12). See [`admin-media.md`](admin-media.md).
- The file also contains the `http → https` and `www → apex` redirects.
- Certificate paths assume Let's Encrypt; adjust them to the Host.KZ setup.
- Cache headers follow the next section.
- Security headers, including the CSP, are in the file (see "Security headers" below).

### Apache `.htaccess` (example — to be finalized after the Host.KZ plan is confirmed)

```apache
Options -MultiViews
DirectorySlash Off
RewriteEngine On

# https + no www
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\. [NC]
RewriteRule ^ https://soltexglobal.co%{REQUEST_URI} [R=301,L]

# /company -> company.html (only when that file exists)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{DOCUMENT_ROOT}/$1.html -f
RewriteRule ^(.+?)/?$ $1.html [L]

# localized 404 pages (status 404 is kept by ErrorDocument)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{DOCUMENT_ROOT}/$1/404.html -f
RewriteRule ^(ru|zh|tr|ar|es)/ - [R=404,L]
ErrorDocument 404 /404.html
```

Apache's `ErrorDocument` is global. Serving the *language-specific* 404 page needs either per-language `<If>` blocks or `<Directory>` blocks with their own `ErrorDocument /ru/404.html`, depending on what the Host.KZ plan allows. Finalize this together with the plan. If it is not possible, unknown `/ru/...` URLs still return status 404 with the English 404 page, and the browser then shows the Russian message.

## Caching and compression

- `/assets/*` uses content-hashed file names: cache for one year with `immutable`.
- HTML: `no-cache`, revalidated on every visit so new deployments appear immediately.
- `/images`, `/videos`: long cache (30 days). Replace a file by changing its name.
- Compression: gzip or brotli for HTML, JS, CSS, JSON, XML and SVG. Do not compress JPEG, PNG or MP4.
- **Videos** (`/videos/*.mp4`, 56–77 MB) need HTTP **Range requests** (`Accept-Ranges: bytes`). Every standard server supports this; confirm that the Host.KZ plan does not proxy or limit large files. Moving the videos to dedicated video hosting is a separate, later task.

## Security headers

Since Phase M-1 the nginx site block (`deploy/nginx/soltexglobal.conf`) sends them:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: <SITE_CSP>
```

`SITE_CSP` is defined once in `packages/core/src/domain/site-security.ts`:
- the same text is in the nginx file, and the preview server sends it for release files;
- the policy allows the one inline script (the motion boot script of `apps/web/index.html`) by its `sha256-…` hash;
- `npm run lint` (`scripts/check-site-csp.mjs`) fails when the script, the nginx line and `SITE_CSP` disagree. Update both texts together.

What the policy allows:
- `style-src 'unsafe-inline'`: React inline `style` attributes;
- fonts from Google Fonts;
- `connect-src 'self'`: the lead form posts to the same origin.

**TLS:** TLS 1.2 and 1.3 only, the Mozilla "intermediate" settings, in the `# >>> tls` block.

**Still to set on the server (Phase N, `docs/admin-security-asvs.md` §4):**
- the admin host's own nginx block, with the admin CSP of `apps/admin/vite.config.ts` and HSTS;
- an access-log format without query strings (`$uri` instead of `$request_uri`) on the admin host. An exact e-mail or phone search in «Заявки» is in the query string;
- time synchronisation;
- separate system users;
- an external TLS test of the real certificate.

## HTTPS and DNS (to be finalized with Host.KZ)

- An `A` (and `AAAA`, if offered) record for `soltexglobal.co` pointing to the Host.KZ server, and `www` as a redirect to the apex.
- A TLS certificate (Let's Encrypt or Host.KZ-provided) with automatic renewal.
- Before switching DNS, crawl the **currently live** soltexglobal.co and map its old URLs to the new ones with 301 redirects. Enter them in «SEO → Редиректы», or import them through `redirects.json` (source `import`). nginx needs no change: the rules are served by the lookup endpoint from the active release.

## Server requirements (Phase N, not set up yet)

The admin, API and database are implemented (approved architecture: `docs/admin-architecture-approved.md`). The production host needs:

- Node.js 22 and the repository checkout (the worker runs the site build);
- PostgreSQL 17 with the three roles of `apps/api/db/provision.sql` (`soltex_app`, `soltex_migrate`, `soltex_backup`); `npm run db:migrate` applies migrations `0000`–`0010`; automated backups;
- three processes of the same codebase (systemd units), all on loopback: the API (`npm run start -w @soltex/api`, `API_PORT` 3100), the worker (`npm run worker -w @soltex/api`) and the preview server (`npm run preview-server -w @soltex/api`, `PREVIEW_PORT` 3102);
- `RELEASES_DIR` (e.g. `/srv/soltex`) and `MEDIA_DIR` (e.g. `/srv/soltex/media`) on one local filesystem, backed up;
- nginx with `deploy/nginx/soltexglobal.conf`, plus server blocks for the admin and preview hosts;
- outgoing e-mail (SMTP) with SPF/DKIM/DMARC for lead notifications.

The public site stays static and keeps working if the admin, API or database is down.
