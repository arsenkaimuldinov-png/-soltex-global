#!/usr/bin/env node
/**
 * Local production preview that behaves like a conventional web server (no Netlify, no SPA
 * fallback): resolves  $uri → $uri.html → $uri/index.html, and answers unknown URLs with
 * HTTP 404 + the localized 404 page. Mirrors the nginx/Apache rules in docs/deployment.md.
 *
 *   node scripts/serve-dist.mjs [dir=dist] [port=4173]
 * No dependencies. For local testing only — not a production server.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 4173);
const LOCALES = ['ru', 'zh', 'tr', 'ar', 'es'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.includes('..')) { res.writeHead(400); return res.end(); }
  const base = path.join(ROOT, pathname);
  let file = [base, `${base}.html`, path.join(base, 'index.html')].find(isFile);
  let status = 200;
  if (!file) {
    status = 404;
    const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
    const localized = m && LOCALES.includes(m[1]) ? path.join(ROOT, m[1], '404.html') : null;
    file = localized && isFile(localized) ? localized : path.join(ROOT, '404.html');
    if (!isFile(file)) { res.writeHead(404); return res.end('Not found'); }
  }
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && status === 200) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Number(s), end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT} (static, real 404)`));
