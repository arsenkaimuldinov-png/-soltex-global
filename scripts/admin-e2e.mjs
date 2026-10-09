#!/usr/bin/env node
/**
 * Admin end-to-end run: the built admin (vite preview, the CSP nginx will send) against the real
 * API and a real PostgreSQL, in Chromium with a virtual WebAuthn authenticator.
 *
 *   DATABASE_URL=… MIGRATION_DATABASE_URL=… node scripts/admin-e2e.mjs [--no-build] [--shots]
 *
 * Steps: migrate → import the seed content → build the admin → create test users with unique e-mails (apps/api/test/e2e-seed.ts)
 * → start the API (random keys, loopback port) and vite preview → run apps/admin/e2e/*.e2e.mjs
 * with node:test → stop everything. Nothing is deleted from the database, so use a test database.
 *
 * Needs Playwright + Chromium (not a project dependency), like scripts/qa-regression.mjs:
 * `npm i --no-save playwright@1.56.0 && npx playwright install chromium`, or CHROMIUM_PATH.
 * Screenshots (--shots) go to .qa/admin-e2e/ (git-ignored).
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3199);
const WEB_PORT = Number(process.env.E2E_ADMIN_PORT ?? 4175);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const SHOTS = path.join(ROOT, '.qa/admin-e2e');

for (const v of ['DATABASE_URL', 'MIGRATION_DATABASE_URL'])
  if (!process.env[v]) {
    console.error(`admin-e2e: ${v} is not set (use a test database)`);
    process.exit(2);
  }

const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', env: { ...process.env, ...opts.env } });
  if (r.status !== 0) {
    console.error(`admin-e2e: ${cmd} ${argv.join(' ')} failed`);
    process.exit(1);
  }
  return r.stdout;
};

const children = [];
const stop = () => children.forEach((c) => c.exitCode === null && c.kill('SIGTERM'));
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

async function waitFor(url, label) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`admin-e2e: ${label} did not start (${url})`);
}

run('npm', ['run', 'db:migrate']);
// Content for the editors (idempotent; never deletes what earlier runs created).
run('npm', ['run', 'db:import']);
if (!args.includes('--no-build')) run('npm', ['run', 'build:admin']);

// admin.e2e.mjs uses the first user of each role; content.e2e.mjs and translations.e2e.mjs their own.
const roles = ['owner', 'admin', 'content_manager', 'editor', 'marketer', 'editor', 'editor', 'seo_specialist', 'admin', 'editor', 'content_manager', 'marketer'];
const users = JSON.parse(run(process.execPath, ['--import', 'tsx', 'apps/api/test/e2e-seed.ts', 'users', roles.join(',')], { capture: true }));

const key = () => crypto.randomBytes(32).toString('base64');
const apiEnv = {
  NODE_ENV: 'development',
  API_HOST: '127.0.0.1',
  API_PORT: String(API_PORT),
  API_LOG_LEVEL: 'warn',
  ADMIN_ORIGIN: ORIGIN,
  WEBAUTHN_RP_ID: 'localhost',
  DATA_ENCRYPTION_KEYS: `e2e:${key()}`,
  DATA_ENCRYPTION_KEY_ID: 'e2e',
  HASH_SECRET: key(),
  API_DOCS: 'authenticated',
};
const api = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], { cwd: ROOT, env: { ...process.env, ...apiEnv }, stdio: ['ignore', 'inherit', 'inherit'] });
children.push(api);
const preview = spawn('npx', ['vite', 'preview', '--port', String(WEB_PORT), '--strictPort'], {
  cwd: path.join(ROOT, 'apps/admin'),
  env: { ...process.env, ADMIN_API_PROXY: `http://127.0.0.1:${API_PORT}` },
  stdio: ['ignore', 'ignore', 'inherit'],
});
children.push(preview);

await waitFor(`http://127.0.0.1:${API_PORT}/api/v1/health`, 'API');
await waitFor(`${ORIGIN}/login`, 'admin preview');

if (args.includes('--shots')) fs.mkdirSync(SHOTS, { recursive: true });
const testDir = path.join(ROOT, 'apps/admin/e2e');
const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.e2e.mjs')).map((f) => path.join(testDir, f));
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_ORIGIN: ORIGIN,
    E2E_USERS: JSON.stringify(users),
    E2E_SHOTS: args.includes('--shots') ? SHOTS : '',
  },
});
stop();
process.exit(result.status ?? 1);
