/**
 * nginx fallback (Phase I-2, approved §11.4) with the real configuration of
 * deploy/nginx/soltexglobal.conf, a small static release and the real API on loopback:
 *   - a static page is served with the API stopped;
 *   - a known redirect → 301 with an internal Location (all languages; trailing slash);
 *   - an unknown URL → 404 with the localized not-found page, for all six language prefixes;
 *   - API stopped → 404 (not 502); API slow (> 2 s) → 404;
 *   - injection cases of §11.2 → 404 without a Location header.
 * Skipped when nginx is not installed (CI installs it; production uses the same file).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { closeTestDb, DB_ENABLED, makeApp, type TestApp } from './helpers.ts';
import { activateWorkingCopy, resetToSeed } from './release-helpers.ts';

const NGINX = ['/usr/sbin/nginx', '/usr/local/sbin/nginx', '/opt/homebrew/bin/nginx', '/usr/local/bin/nginx'].find((p) => fs.existsSync(p));
const CONF = path.resolve(import.meta.dirname, '../../../deploy/nginx/soltexglobal.conf');
const LOCALES = ['en', 'ru', 'zh', 'tr', 'ar', 'es'] as const;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

/** Raw GET (no redirect following, no URL normalization by the client). */
function get(port: number, rawPath: string): Promise<{ status: number; location?: string; body: string; ms: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: rawPath, headers: { host: 'soltexglobal.co' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, location: res.headers.location, body, ms: Date.now() - start }));
    });
    req.on('error', reject);
    req.end();
  });
}

function writeSite(root: string) {
  const page = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), `<!doctype html><title>${text}</title><p>${text}</p>`);
  };
  page('index.html', 'HOME en');
  page('company.html', 'COMPANY en');
  page('company/history.html', 'HISTORY en');
  page('projects/solbar-israel.html', 'ISRAEL en');
  for (const l of LOCALES.filter((x) => x !== 'en')) {
    page(`${l}.html`, `HOME ${l}`);
    page(`${l}/company.html`, `COMPANY ${l}`);
  }
  for (const l of LOCALES) page(l === 'en' ? '404.html' : `${l}/404.html`, `NOT FOUND ${l}`);
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/app-abc123.js'), 'console.log(1)');
}

describe('nginx fallback (Phase I-2, approved §11.4)', { skip: (!DB_ENABLED && 'DATABASE_URL not set') || (!NGINX && 'nginx is not installed') }, () => {
  let t: TestApp;
  let dir: string;
  let apiPort: number;
  let webPort: number;
  let slow: http.Server | null = null;

  const nginx = (...args: string[]) => spawnSync(NGINX!, ['-p', dir, '-c', path.join(dir, 'nginx.conf'), ...args], { encoding: 'utf8' });

  before(async () => {
    t = await makeApp({ PUBLIC_SITE_URL: 'https://soltexglobal.co' });
    await resetToSeed(t);
    const db = t.deps.db!;
    await db.insert(s.redirects).values([
      { key: 'redirect-old-company', fromPath: '/old-company', toPath: '/company', allLocales: true },
      { key: 'redirect-ru-only', fromPath: '/ru/staraya', toPath: '/ru/company', allLocales: false },
      { key: 'redirect-temp', fromPath: '/promo', toPath: '/projects/solbar-israel', allLocales: false, statusCode: 302 },
    ]);
    await activateWorkingCopy(t);

    apiPort = await freePort();
    webPort = await freePort();
    await t.app.listen({ host: '127.0.0.1', port: apiPort });

    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-nginx-'));
    fs.chmodSync(dir, 0o755);
    const root = path.join(dir, 'site');
    writeSite(root);
    for (const sub of ['logs', 'tmp']) fs.mkdirSync(path.join(dir, sub));

    // The production file with local values: no TLS, no host redirects, local root and upstream.
    let site = fs.readFileSync(CONF, 'utf8');
    site = site.replace(/# >>> tls[\s\S]*?# <<< tls/, `listen 127.0.0.1:${webPort};`);
    site = site.replace(/# >>> host-redirects[\s\S]*?# <<< host-redirects/, '');
    assert.ok(site.includes('root /srv/soltex/current;') && site.includes('server 127.0.0.1:3100;'), 'markers of the production file');
    assert.ok(site.includes('alias /srv/soltex/media/originals/;'), 'media location of the production file');
    const media = path.join(dir, 'media');
    fs.mkdirSync(path.join(media, 'originals/2026'), { recursive: true });
    fs.writeFileSync(path.join(media, 'originals/2026/0b1c2d3e-0000-4000-8000-000000000001.webp'), 'RIFF....WEBP');
    fs.mkdirSync(path.join(media, 'variants/0b1c2d3e-0000-4000-8000-000000000001/abcdef012345'), { recursive: true });
    fs.writeFileSync(path.join(media, 'variants/0b1c2d3e-0000-4000-8000-000000000001/abcdef012345/480.webp'), 'RIFF....WEBP');
    fs.writeFileSync(path.join(media, 'secret.txt'), 'not public');
    site = site
      .replace('root /srv/soltex/current;', `root ${root};`)
      .replace('server 127.0.0.1:3100;', `server 127.0.0.1:${apiPort};`)
      .replace('alias /srv/soltex/media/originals/;', `alias ${media}/originals/;`)
      .replace('alias /srv/soltex/media/variants/;', `alias ${media}/variants/;`);
    fs.writeFileSync(path.join(dir, 'site.conf'), site);
    const mime = ['/etc/nginx/mime.types', '/usr/local/etc/nginx/mime.types', '/opt/homebrew/etc/nginx/mime.types'].find((p) => fs.existsSync(p));
    fs.writeFileSync(
      path.join(dir, 'nginx.conf'),
      [
        process.getuid?.() === 0 ? 'user root;' : '',
        'worker_processes 1;',
        `pid ${dir}/nginx.pid;`,
        `error_log ${dir}/logs/error.log warn;`,
        'events { worker_connections 64; }',
        'http {',
        mime ? `  include ${mime};` : '',
        '  access_log off;',
        ...['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map((x) => `  ${x}_temp_path ${dir}/tmp/${x};`),
        `  include ${dir}/site.conf;`,
        '}',
      ].join('\n')
    );
    const check = nginx('-t');
    assert.equal(check.status, 0, check.stderr);
    const start = nginx();
    assert.equal(start.status, 0, start.stderr);
    for (let i = 0; i < 50; i++) {
      try {
        await get(webPort, '/');
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  });

  after(async () => {
    if (dir) {
      nginx('-s', 'stop');
      await new Promise((r) => setTimeout(r, 200));
    }
    slow?.close();
    await t.app.close().catch(() => {});
    await resetToSeed(t);
    await closeTestDb();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  test('static pages are served without the API (extension-less, language roots, assets)', async () => {
    for (const [p, text] of [['/', 'HOME en'], ['/company', 'COMPANY en'], ['/company/history', 'HISTORY en'], ['/ru', 'HOME ru'], ['/ar/company', 'COMPANY ar'], ['/projects/solbar-israel', 'ISRAEL en']]) {
      const r = await get(webPort, p!);
      assert.equal(r.status, 200, p);
      assert.ok(r.body.includes(text!), p);
    }
    const asset = await get(webPort, '/assets/app-abc123.js');
    assert.equal(asset.status, 200);
  });

  test('media library files: served from shared storage with a long cache; nothing else under /media', async () => {
    const r = await new Promise<http.IncomingMessage>((resolve, reject) =>
      http.get({ host: '127.0.0.1', port: webPort, path: '/media/originals/2026/0b1c2d3e-0000-4000-8000-000000000001.webp' }, resolve).on('error', reject)
    );
    r.resume();
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['content-type'], 'image/webp');
    assert.match(String(r.headers['cache-control']), /immutable/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    const v = await new Promise<http.IncomingMessage>((resolve, reject) =>
      http.get({ host: '127.0.0.1', port: webPort, path: '/media/variants/0b1c2d3e-0000-4000-8000-000000000001/abcdef012345/480.webp' }, resolve).on('error', reject)
    );
    v.resume();
    assert.deepEqual([v.statusCode, v.headers['content-type']], [200, 'image/webp']);
    assert.match(String(v.headers['cache-control']), /immutable/);
    for (const p of ['/media/secret.txt', '/media/originals/2026/missing.webp', '/media/originals/../secret.txt']) {
      const x = await get(webPort, p);
      assert.notEqual(x.status, 200, p);
      assert.ok(!x.body.includes('not public'), p);
    }
  });

  test('known redirects: 301 / 302 with the internal Location, in every language; trailing slash', async () => {
    for (const l of LOCALES) {
      const pre = l === 'en' ? '' : `/${l}`;
      const r = await get(webPort, `${pre}/old-company`);
      assert.deepEqual([r.status, r.location], [301, `https://soltexglobal.co${pre}/company`], l);
    }
    assert.deepEqual(Object.values(await get(webPort, '/ru/staraya')).slice(0, 2), [301, 'https://soltexglobal.co/ru/company']);
    assert.equal((await get(webPort, '/zh/staraya')).status, 404, 'a single-path rule is not expanded');
    assert.deepEqual(Object.values(await get(webPort, '/promo')).slice(0, 2), [302, 'https://soltexglobal.co/projects/solbar-israel']);
    assert.deepEqual(Object.values(await get(webPort, '/company/')).slice(0, 2), [301, 'https://soltexglobal.co/company']);
    assert.deepEqual(Object.values(await get(webPort, '/es/company/')).slice(0, 2), [301, 'https://soltexglobal.co/es/company']);
    assert.deepEqual(Object.values(await get(webPort, '/old-company/')).slice(0, 2), [301, 'https://soltexglobal.co/company']);
    // the hit counter is updated asynchronously
    let hits = 0;
    for (let i = 0; i < 50 && !hits; i++) {
      hits = (await t.deps.db!.select().from(s.redirects).where(eq(s.redirects.key, 'redirect-old-company')))[0]!.hits;
      if (!hits) await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(hits >= 6);
  });

  test('unknown URLs: status 404 with the localized not-found page, all six languages', async () => {
    for (const l of LOCALES) {
      const pre = l === 'en' ? '' : `/${l}`;
      const r = await get(webPort, `${pre}/does-not-exist`);
      assert.equal(r.status, 404, l);
      assert.ok(r.body.includes(`NOT FOUND ${l}`), `${l}: ${r.body.slice(0, 80)}`);
      assert.equal(r.location, undefined);
    }
    assert.ok((await get(webPort, '/rugby/x')).body.includes('NOT FOUND en'), '/rugby is not a language prefix');
  });

  test('injection cases of §11.2 → 404 and no Location', async () => {
    for (const p of ['//evil.example', '/%2F%2Fevil.example', '/a%0d%0aLocation:%20https://evil.example', '/a%00', '/..%2f..%2fetc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/a\\b', '/http:%2f%2fevil.example', `/${'a'.repeat(2100)}`, '/old-company%0d%0aX:%20y']) {
      const r = await get(webPort, p);
      assert.ok(r.status === 404 || r.status === 400, `${p}: ${r.status}`);
      assert.equal(r.location, undefined, p);
    }
  });

  test('API stopped → 404 (never 502); static pages still served', async () => {
    await t.app.close();
    const r = await get(webPort, '/old-company');
    assert.equal(r.status, 404);
    assert.ok(r.body.includes('NOT FOUND en'));
    const ru = await get(webPort, '/ru/old-company');
    assert.deepEqual([ru.status, ru.body.includes('NOT FOUND ru')], [404, true]);
    assert.equal((await get(webPort, '/company')).status, 200);
  });

  test('API slow (> 2 s) → 404 after the read timeout', async () => {
    slow = http.createServer((_req, res) => setTimeout(() => res.writeHead(301, { location: 'https://soltexglobal.co/company' }).end(), 3500));
    await new Promise<void>((r) => slow!.listen(apiPort, '127.0.0.1', () => r()));
    const r = await get(webPort, '/old-company');
    assert.equal(r.status, 404);
    assert.equal(r.location, undefined);
    assert.ok(r.ms >= 1900 && r.ms < 3400, `answered after ${r.ms} ms`);
  });
});
