/**
 * Content Security Policy of the public site (Phase M-1, review §Q). Sent by nginx on the site host
 * (deploy/nginx/soltexglobal.conf, the same text) and by the preview server for release files.
 * scripts/check-site-csp.mjs (npm run lint) fails when the two differ or when an inline script of
 * apps/web/index.html is not allowed by its hash. Inline style attributes come from React; fonts
 * from Google Fonts; the lead form posts to the same origin.
 */
export const SITE_CSP = "default-src 'self'; script-src 'self' 'sha256-FxjS9LAg+aftdgj8JMq5VioItakbndiIAdl0ujkCkNc='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

/** Pages that are not the site (preview start, errors): nothing but inline styles. */
export const PLAIN_PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
