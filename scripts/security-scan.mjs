#!/usr/bin/env node
/**
 * Dynamic security scan (Phase M-1, docs/admin-security-asvs.md §3) with OWASP ZAP:
 *
 *   DATABASE_URL=…/soltex_scan MIGRATION_DATABASE_URL=…/soltex_scan ZAP_HOME=/path/to/ZAP_2.16.1 \
 *     node scripts/security-scan.mjs [--no-build] [--minutes 20]
 *
 * Starts the stack the way production wires it (approved §10) on loopback: the API, the built admin
 * under its CSP (vite preview proxies /api like nginx), the preview server and the public site
 * (apps/web/dist served with the nginx rules, scripts/e2e-site-server.mjs). A Content Manager signs
 * in with password + authenticator code; ZAP then imports the OpenAPI document, spiders the admin and
 * the site, runs the passive rules and an active scan (authenticated for the admin origin, anonymous
 * for the site) and writes .qa/zap/report.{html,json}. Exits 1 when an alert of risk High remains.
 *
 * The active scan sends attack payloads to every API route, mutations included: the database MUST
 * be disposable — its name has to end in `_scan`.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generate as totp } from 'otplib';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const MINUTES = Number(args.includes('--minutes') ? args[args.indexOf('--minutes') + 1] : 40);
const ZAP_HOME = process.env.ZAP_HOME;
const API_PORT = 3299;
const ADMIN = 'http://localhost:4185';
const PREVIEW_PORT = 4186;
const SITE = 'http://localhost:4187';
const OUT = path.join(ROOT, '.qa/zap');

for (const v of ['DATABASE_URL', 'MIGRATION_DATABASE_URL'])
  if (!/_scan(\?|$)/.test(new URL(process.env[v] ?? 'postgres://x/none').pathname + '')) {
    console.error(`security-scan: ${v} must point to a disposable database whose name ends in _scan`);
    process.exit(2);
  }
if (!ZAP_HOME || !fs.existsSync(path.join(ZAP_HOME, 'zap.sh'))) {
  console.error('security-scan: set ZAP_HOME to an unpacked ZAP 2.16 (Crossplatform) directory');
  process.exit(2);
}

const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', env: { ...process.env, ...opts.env } });
  if (r.status !== 0) {
    console.error(`security-scan: ${cmd} ${argv.join(' ')} failed`);
    process.exit(1);
  }
  return r.stdout;
};
const children = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-scan-'));
process.on('exit', () => {
  for (const c of children) {
    try {
      if (c.spawnargs[0] === 'npx') process.kill(-c.pid, 'SIGTERM');
      else c.kill('SIGTERM');
    } catch {
      /* gone */
    }
  }
  spawnSync('chmod', ['-R', 'u+w', tmp]);
  fs.rmSync(tmp, { recursive: true, force: true });
});
process.on('SIGINT', () => process.exit(130));
async function waitFor(url, label) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`security-scan: ${label} did not start (${url})`);
}

// 1. Database, builds, a user.
run('npm', ['run', 'db:migrate']);
run('npm', ['run', 'db:import']);
if (!args.includes('--no-build')) {
  run('npm', ['run', 'build:admin']);
  run('npm', ['run', 'build:web']);
}
run(process.execPath, ['--import', 'tsx', 'apps/api/test/e2e-seed.ts', 'reset-run'], { capture: true });
const [cm] = JSON.parse(run(process.execPath, ['--import', 'tsx', 'apps/api/test/e2e-seed.ts', 'users', 'content_manager'], { capture: true }));

// 2. The stack.
const releases = path.join(tmp, 'releases');
fs.mkdirSync(releases);
fs.symlinkSync(path.join(ROOT, 'apps/web/dist'), path.join(releases, 'current'));
const key = () => crypto.randomBytes(32).toString('base64');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  API_HOST: '127.0.0.1',
  API_PORT: String(API_PORT),
  API_LOG_LEVEL: 'warn',
  ADMIN_ORIGIN: ADMIN,
  WEBAUTHN_RP_ID: 'localhost',
  DATA_ENCRYPTION_KEYS: `scan:${key()}`,
  DATA_ENCRYPTION_KEY_ID: 'scan',
  HASH_SECRET: key(),
  API_DOCS: 'authenticated',
  RELEASES_DIR: releases,
  MEDIA_DIR: path.join(tmp, 'media'),
  PREVIEW_ORIGIN: `http://localhost:${PREVIEW_PORT}`,
  PREVIEW_PORT: String(PREVIEW_PORT),
  PUBLIC_SITE_URL: SITE,
};
fs.mkdirSync(env.MEDIA_DIR);
const start = (cmd, argv, opts = {}) => {
  const c = spawn(cmd, argv, { cwd: opts.cwd ?? ROOT, env: { ...env, ...opts.env }, stdio: ['ignore', 'ignore', 'inherit'], detached: cmd === 'npx' });
  children.push(c);
};
start(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts']);
start(process.execPath, ['--import', 'tsx', 'apps/api/src/preview-server.ts']);
start(process.execPath, ['scripts/e2e-site-server.mjs', releases, new URL(SITE).port, String(API_PORT)]);
start('npx', ['vite', 'preview', '--port', new URL(ADMIN).port, '--strictPort'], { cwd: path.join(ROOT, 'apps/admin'), env: { ADMIN_API_PROXY: `http://127.0.0.1:${API_PORT}` } });
await waitFor(`http://127.0.0.1:${API_PORT}/api/v1/health`, 'API');
await waitFor(`${ADMIN}/login`, 'admin');
await waitFor(`${SITE}/`, 'site');

// 3. A signed-in session (password + authenticator app), as the browser holds it.
const jar = new Map();
async function call(method, url, body) {
  const res = await fetch(`${ADMIN}${url}`, {
    method,
    headers: {
      origin: ADMIN,
      'x-requested-with': 'soltex-admin',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  if (!res.ok) throw new Error(`security-scan: ${method} ${url} → ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}
await call('POST', '/api/v1/auth/login', { email: cm.email, password: cm.password });
const { secret } = await call('POST', '/api/v1/auth/mfa/totp/enroll');
await call('POST', '/api/v1/auth/mfa/totp/confirm', { code: await totp({ secret }) });
const session = await call('GET', '/api/v1/auth/session');
if (!session?.user) throw new Error('security-scan: no session');
const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

// 4. ZAP automation plan.
fs.mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/[.?+*()[\]{}|^$\\]/g, (c) => `\\${c}`);
const plan = {
  env: {
    contexts: [
      {
        name: 'soltex',
        urls: [ADMIN, SITE, `http://localhost:${PREVIEW_PORT}`],
        includePaths: [`${esc(ADMIN)}.*`, `${esc(SITE)}.*`, `http://localhost:${PREVIEW_PORT}.*`],
        // Requests that end the scanner's own session or factor are left out (they would turn the
        // rest of the scan into an anonymous one); they are covered by the API tests
        // (auth / mfa / passkeys / rbac / coverage .db.test.ts).
        // Second-factor checks are left out too: five wrong codes revoke the session by design.
        excludePaths: [`${esc(ADMIN)}/api/v1/auth/(logout|password/change|sessions/[^/]+/revoke|mfa(/.*)?|passkeys(/.*)?)(\\?.*)?$`, `${esc(ADMIN)}/api/v1/users/.*`],
      },
    ],
    parameters: { failOnError: true, progressToStdout: true },
  },
  jobs: [
    {
      type: 'replacer',
      parameters: { deleteAllRules: true },
      rules: [
        { description: 'session', url: `${esc(ADMIN)}.*`, matchType: 'req_header', matchString: 'Cookie', matchRegex: false, replacementString: cookie, tokenProcessing: false },
        { description: 'csrf header', url: `${esc(ADMIN)}.*`, matchType: 'req_header', matchString: 'X-Requested-With', matchRegex: false, replacementString: 'soltex-admin', tokenProcessing: false },
      ],
    },
    { type: 'openapi', parameters: { apiFile: path.join(ROOT, 'apps/api/openapi.json'), targetUrl: ADMIN, context: 'soltex' } },
    { type: 'spider', parameters: { context: 'soltex', url: `${SITE}/`, maxDuration: 3 } },
    { type: 'spider', parameters: { context: 'soltex', url: `${ADMIN}/`, maxDuration: 2 } },
    { type: 'passiveScan-wait', parameters: { maxDuration: 10 } },
    // One thread with a pause between requests stays under the API's 600 requests / minute per
    // session (approved §19), so the scan tests the routes instead of the rate limiter.
    { type: 'activeScan', parameters: { context: 'soltex', maxScanDurationInMins: MINUTES, maxRuleDurationInMins: 4, threadPerHost: 1, delayInMs: 110 }, policyDefinition: { defaultStrength: 'medium', defaultThreshold: 'medium' } },
    { type: 'passiveScan-wait', parameters: { maxDuration: 10 } },
    { type: 'report', parameters: { template: 'traditional-json', reportDir: OUT, reportFile: 'report.json' } },
    { type: 'report', parameters: { template: 'traditional-html', reportDir: OUT, reportFile: 'report.html' } },
  ],
};
const planFile = path.join(tmp, 'plan.yaml');
fs.writeFileSync(planFile, JSON.stringify(plan, null, 2)); // JSON is valid YAML
const zap = spawnSync(path.join(ZAP_HOME, 'zap.sh'), ['-cmd', '-dir', path.join(tmp, 'zaphome'), '-config', 'start.checkForUpdates=false', '-autorun', planFile], {
  stdio: 'inherit',
  env: { ...process.env, JAVA_TOOL_OPTIONS: '' },
});
if (zap.status !== 0 && !fs.existsSync(path.join(OUT, 'report.json'))) process.exit(1);

// 5. Was the scan authenticated until the end? (after the rate-limit window)
await new Promise((r) => setTimeout(r, 61_000));
const still = await fetch(`${ADMIN}/api/v1/auth/session`, { headers: { cookie } });
console.log(`security-scan: session at the end: ${still.status === 200 ? 'still signed in' : `lost (${still.status})`}`);

// 6. Summary.
const report = JSON.parse(fs.readFileSync(path.join(OUT, 'report.json'), 'utf8'));
const alerts = report.site.flatMap((s) => s.alerts.map((a) => ({ site: s['@name'], risk: a.riskdesc.split(' ')[0], name: a.name, count: Number(a.count), id: a.pluginid })));
const order = { High: 0, Medium: 1, Low: 2, Informational: 3 };
alerts.sort((a, b) => order[a.risk] - order[b.risk] || a.name.localeCompare(b.name));
for (const a of alerts) console.log(`${a.risk.padEnd(13)} ${a.id.padEnd(6)} ${a.name} — ${a.site} (${a.count})`);
const high = alerts.filter((a) => a.risk === 'High');
console.log(`security-scan: ${alerts.length} alert types; High ${high.length}, Medium ${alerts.filter((a) => a.risk === 'Medium').length}. Report: .qa/zap/report.html`);
process.exit(high.length ? 1 : 0);
