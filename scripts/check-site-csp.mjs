#!/usr/bin/env node
/**
 * The public site's CSP (Phase M-1): SITE_CSP in packages/core/src/domain/site-security.ts (the
 * preview server sends it) and the nginx site block (deploy/nginx/soltexglobal.conf) must be the
 * same text, and it must allow every inline script of apps/web/index.html by its hash.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'apps/web/index.html'), 'utf8');
const conf = fs.readFileSync(path.join(ROOT, 'deploy/nginx/soltexglobal.conf'), 'utf8');
const csp = conf.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1];
if (!csp) {
  console.error('check-site-csp: no Content-Security-Policy in deploy/nginx/soltexglobal.conf');
  process.exit(1);
}
const core = fs.readFileSync(path.join(ROOT, 'packages/core/src/domain/site-security.ts'), 'utf8').match(/export const SITE_CSP = "([^"]+)"/)?.[1];
if (core !== csp) {
  console.error('check-site-csp: the CSP of deploy/nginx/soltexglobal.conf differs from SITE_CSP in packages/core/src/domain/site-security.ts');
  process.exit(1);
}
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
const missing = inline.map((s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`).filter((h) => !csp.includes(h));
if (missing.length) {
  console.error(`check-site-csp: inline script(s) of apps/web/index.html not allowed by the site CSP; add ${missing.join(' ')} to script-src in deploy/nginx/soltexglobal.conf`);
  process.exit(1);
}
console.log(`check-site-csp: OK (${inline.length} inline script${inline.length === 1 ? '' : 's'} allowed by hash)`);
