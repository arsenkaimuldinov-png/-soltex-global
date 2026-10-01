# Deployment

The site is a **static, prerendered build** with no runtime dependency on any hosting provider, CMS or backend. Any web server that can serve files over HTTPS can host it.

| Environment | Flow | Status |
|---|---|---|
| **DEMO / client preview** | GitHub → Netlify (`netlify.toml`) | **Temporary.** Used only to present the site to Soltex and get approval |
| **PRODUCTION** | `npm run build` → `dist/` → **Host.KZ** → `soltexglobal.co` | Final target. Server details **to be finalized after the exact Host.KZ hosting plan is confirmed** |

Netlify is not part of the application architecture. The only Netlify-specific file is `netlify.toml`, which holds the build command, the publish directory and the localized 404 rules. There are no Netlify Functions, Blobs, Forms, Identity or build hooks.

## Build

| | |
|---|---|
| Runtime | Node.js ≥ 20.11 (developed with Node 22 LTS) |
| Install | `npm ci` |
| Build | `npm run build`. This runs four steps: content snapshots + validation, `vite build`, prerender (`scripts/prerender.ts`) and site validation (`scripts/validate-site.ts`) |
| Output | `dist/` (upload the **contents** of this folder to the web root) |
| Local check | `npm run serve:dist` (http://localhost:4173). It behaves like the production server rules below, including real 404s |

The build **fails** if content is invalid or if any SEO, link, image or portability check fails. A failed build never produces a half-valid site.

### Environment variables (all optional, build time only)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://soltexglobal.co` | Origin used for canonical, hreflang, OG and sitemap URLs. On the demo it can stay at the production origin, which keeps demo URLs out of the canonical tags |
| `CONTENT_SOURCE` | `seed` | Content source for the build. `seed` is the JSON in `src/content/seed`. A custom-admin source is added later |
| `MEDIA_BASE_URL` | *(empty)* | Prefix for media files if they move to object storage or a CDN later. Empty means the files are served from the site |

No secrets exist in Phase 1. Future secrets (admin API token, lead endpoint keys) must only ever be **build-time or server-side** variables. They must never use the `VITE_` prefix, because those values are embedded in the browser bundle. `validate-site` fails the build if secret-looking values appear in `dist/`.

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

### nginx (example — to be finalized after the Host.KZ plan is confirmed)

```nginx
server {
  listen 443 ssl http2;
  server_name soltexglobal.co;
  root /var/www/soltexglobal/dist;

  location / {
    try_files $uri $uri.html $uri/index.html =404;
  }
  location ~ ^/(ru|zh|tr|ar|es)(/|$) {
    try_files $uri $uri.html $uri/index.html =404;
    error_page 404 /$1/404.html;
  }
  error_page 404 /404.html;

  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location ~* ^/(images|videos)/ { add_header Cache-Control "public, max-age=2592000"; }
  location ~* \.html$ { add_header Cache-Control "no-cache"; }
  gzip on; gzip_types text/css application/javascript application/json application/xml image/svg+xml;
}
server { listen 80; server_name soltexglobal.co www.soltexglobal.co; return 301 https://soltexglobal.co$request_uri; }
server { listen 443 ssl http2; server_name www.soltexglobal.co; return 301 https://soltexglobal.co$request_uri; }
```

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

## Security headers (recommended for production)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-FxjS9LAg+aftdgj8JMq5VioItakbndiIAdl0ujkCkNc='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
```

The `sha256-…` value is the hash of the small inline "motion boot" script in `index.html`. Recompute it whenever that script changes:

```
python3 -c "import re,hashlib,base64;s=open('index.html').read();m=re.search(r'<script>(.*?)</script>',s,re.S);print(base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode())"
```

Add `connect-src` / `form-action` for the future lead endpoint, and `media-src` for a future video host. `style-src 'unsafe-inline'` is needed for React inline `style` attributes.

## HTTPS and DNS (to be finalized with Host.KZ)

- An `A` (and `AAAA`, if offered) record for `soltexglobal.co` pointing to the Host.KZ server, and `www` as a redirect to the apex.
- A TLS certificate (Let's Encrypt or Host.KZ-provided) with automatic renewal.
- Before switching DNS, crawl the **currently live** soltexglobal.co and map its old URLs to the new ones with 301 redirects (redirect entity in `src/content/seed/redirects.json`; the server configuration is generated or maintained once the server type is known).

## Future backend and database requirements (not implemented)

When the custom admin is built (see `docs/custom-admin-architecture.md`), the production host needs:

- a server-side runtime for the admin API and lead endpoint (Node.js or PHP, depending on the Host.KZ plan);
- a database (PostgreSQL preferred, MySQL acceptable) with automated backups;
- storage for uploaded media (local disk with backups, or S3-compatible object storage);
- a way to **rebuild the static site after publishing**. Either:
  - a build on the server (`npm ci && npm run build` with `CONTENT_SOURCE=admin`), or
  - a CI job that builds and uploads `dist/`.

  Either way, the public site stays static and keeps working if the admin or database is down.
- outgoing e-mail (SMTP) with SPF/DKIM/DMARC for lead notifications.
