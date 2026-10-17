#!/usr/bin/env node
/**
 * The public site for admin E2E (Phase K-2): serves the release that `RELEASES_DIR/current` points
 * to, resolving $uri → $uri.html → $uri/index.html like nginx (deploy/nginx/soltexglobal.conf), and
 * proxies the one API path nginx exposes on the site host, POST /api/v1/public/leads, to the API.
 * Every other /api/ path answers 404, as on the real site. Test use only.
 *
 *   node scripts/e2e-site-server.mjs <releasesDir> <port> <apiPort>
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [releasesDir, port, apiPort] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://site');
    if (url.pathname === '/api/v1/public/leads') {
      const upstream = http.request(
        { host: '127.0.0.1', port: Number(apiPort), method: req.method, path: url.pathname, headers: { ...req.headers, host: `127.0.0.1:${apiPort}`, 'x-forwarded-for': req.headers['x-forwarded-for'] ?? req.socket.remoteAddress } },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        }
      );
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      return void req.pipe(upstream);
    }
    if (url.pathname.startsWith('/api/') || url.pathname.includes('..')) {
      res.writeHead(404);
      return void res.end();
    }
    let root;
    try {
      root = fs.realpathSync(path.join(releasesDir, 'current'));
    } catch {
      res.writeHead(503);
      return void res.end('no published release');
    }
    const base = path.join(root, decodeURIComponent(url.pathname));
    const file = [base, `${base}.html`, path.join(base, 'index.html')].find(isFile) ?? path.join(root, '404.html');
    res.writeHead(file.endsWith('404.html') && !base.endsWith('404.html') ? 404 : 200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port), '127.0.0.1', () => console.log(`e2e site: http://localhost:${port} → ${releasesDir}/current`));
