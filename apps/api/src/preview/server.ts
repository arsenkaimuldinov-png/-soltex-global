/**
 * Preview server (Phase G, docs/admin-publishing.md §7; approved §9–§10).
 *
 * Serves a built release or preview build of the public site — the same static files the public
 * site would serve, with the same routing (file → file.html → dir/index.html, real 404s per
 * language) — to admin users only, on its own origin (https://preview.soltexglobal.co behind
 * nginx; locally PREVIEW_PORT). It never serves the active public site and changes nothing.
 *
 *   GET  /__preview             start page: reads the token from the URL fragment (never sent to a
 *                               server) and exchanges it via POST
 *   POST /__preview/session     token → HttpOnly SameSite=Strict cookie (one-time, 30 min)
 *   GET  /__preview/close       revokes the grant, clears the cookie
 *   GET  /robots.txt            Disallow: /
 *   GET  /*                     the artifact of the granted release, or 401 in Russian
 *
 * Every response: Cache-Control no-store, X-Robots-Tag noindex/nofollow/noarchive,
 * Referrer-Policy no-referrer. Logs carry method, path (no query string) and status only.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { releaseDir } from '../publishing/artifacts.ts';
import { exchangePreviewToken, previewTarget, revokeByCookie } from '../publishing/preview.ts';

const LOCALES = ['ru', 'zh', 'tr', 'ar', 'es'];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const START_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Предпросмотр</title><script src="/__preview/start.js" defer></script></head><body style="font-family:system-ui,sans-serif;padding:2rem"><p id="m">Открываем предпросмотр…</p></body></html>`;
const START_JS = `(function(){var h=new URLSearchParams(location.hash.slice(1));var t=h.get('t');var p=h.get('p')||'/';history.replaceState(null,'',location.pathname);var m=document.getElementById('m');if(!t){m.textContent='Ссылка предпросмотра неполная. Откройте предпросмотр из админки заново.';return;}fetch('/__preview/session',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'soltex-preview'},body:JSON.stringify({token:t}),credentials:'same-origin'}).then(function(r){if(!r.ok)throw 0;location.replace(/^\\/[A-Za-z0-9\\/_-]*$/.test(p)?p:'/');}).catch(function(){m.textContent='Ссылка предпросмотра недействительна или уже использована. Откройте предпросмотр из админки заново.';});})();`;
const DENIED_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow, noarchive"><title>Предпросмотр недоступен</title></head><body style="font-family:system-ui,sans-serif;padding:2rem"><h1>Предпросмотр недоступен</h1><p>Сеанс предпросмотра истёк или закрыт. Откройте предпросмотр заново в админке («Публикация» → «Релизы»).</p></body></html>`;

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function cookieOf(req: http.IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export interface PreviewServerOptions {
  /** Logger for one line per request (method, path, status). */
  log?: (line: string) => void;
}

export function createPreviewServer(deps: Deps, options: PreviewServerOptions = {}): http.Server {
  const db = requireDb(deps);
  const root = deps.config.publishing.releasesDir;
  const secure = deps.config.publishing.previewOrigin.startsWith('https://');
  const cookieName = secure ? '__Host-soltex_preview' : 'soltex_preview';
  const log = options.log ?? (() => {});

  return http.createServer((req, res) => {
    let pathname = '/';
    const send = (status: number, body: string | Buffer, headers: Record<string, string | number> = {}) => {
      res.writeHead(status, { ...BASE_HEADERS, ...headers });
      res.end(req.method === 'HEAD' ? undefined : body);
      log(`${req.method} ${pathname} ${status}`);
    };
    const handle = async () => {
      try {
        pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://preview').pathname);
      } catch {
        return send(400, 'Bad request');
      }
      if (pathname.includes('..') || pathname.includes('\0')) return send(400, 'Bad request');
      if (pathname === '/robots.txt') return send(200, 'User-agent: *\nDisallow: /\n', { 'Content-Type': 'text/plain; charset=utf-8' });
      if (pathname === '/__preview') return send(200, START_HTML, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
      if (pathname === '/__preview/start.js') return send(200, START_JS, { 'Content-Type': 'text/javascript; charset=utf-8' });
      if (pathname === '/__preview/session') {
        if (req.method !== 'POST' || req.headers['x-requested-with'] !== 'soltex-preview') return send(403, 'Forbidden');
        const origin = req.headers.origin;
        if (origin && origin !== deps.config.publishing.previewOrigin) return send(403, 'Forbidden');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const c of req) {
          size += (c as Buffer).length;
          if (size > 2048) return send(413, 'Too large');
          chunks.push(c as Buffer);
        }
        let token = '';
        try {
          token = String((JSON.parse(Buffer.concat(chunks).toString('utf8')) as { token?: unknown }).token ?? '');
        } catch {
          return send(400, 'Bad request');
        }
        const grant = await exchangePreviewToken(db, token, deps.now());
        if (!grant) return send(401, JSON.stringify({ ok: false }), { 'Content-Type': 'application/json' });
        return send(200, JSON.stringify({ ok: true }), {
          'Content-Type': 'application/json',
          'Set-Cookie': `${cookieName}=${grant.cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${grant.maxAgeSeconds}${secure ? '; Secure' : ''}`,
        });
      }
      const cookie = cookieOf(req, cookieName);
      if (pathname === '/__preview/close') {
        if (cookie) await revokeByCookie(db, cookie, deps.now());
        return send(200, DENIED_HTML.replace('Предпросмотр недоступен</h1>', 'Предпросмотр закрыт</h1>'), {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`,
        });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed');
      const key = cookie ? await previewTarget(db, cookie, deps.now()) : null;
      if (!key) return send(401, DENIED_HTML, { 'Content-Type': 'text/html; charset=utf-8' });
      // Media library files are not in the release (approved §4.3): served from shared storage.
      if (pathname.startsWith('/media/originals/')) {
        const mediaRoot = path.resolve(deps.config.media.dir);
        const abs = path.resolve(mediaRoot, `.${pathname.slice('/media'.length)}`);
        if (!abs.startsWith(path.join(mediaRoot, 'originals') + path.sep) || !isFile(abs)) return send(404, 'Not found');
        const body = fs.readFileSync(abs);
        return send(200, body, { 'Content-Type': TYPES[path.extname(abs)] ?? 'application/octet-stream', 'Content-Length': body.length });
      }
      const dir = releaseDir(root, key);
      const base = path.join(dir, pathname);
      let file = [base, `${base}.html`, path.join(base, 'index.html')].find(isFile);
      let status = 200;
      if (!file) {
        status = 404;
        const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
        const localized = m && LOCALES.includes(m[1]!) ? path.join(dir, m[1]!, '404.html') : null;
        file = localized && isFile(localized) ? localized : path.join(dir, '404.html');
        if (!isFile(file)) return send(404, 'Not found');
      }
      if (path.basename(file) === 'release.json') return send(404, 'Not found');
      const body = fs.readFileSync(file);
      return send(status, body, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length });
    };
    handle().catch(() => {
      if (!res.headersSent) send(500, 'Internal error');
    });
  });
}
