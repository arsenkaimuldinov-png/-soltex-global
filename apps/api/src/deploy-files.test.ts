/**
 * Server files of Phase N-0 (deploy/): they must agree with the code they run.
 *  - deploy/soltex.env.example is accepted by loadConfig in production (placeholders filled);
 *  - every systemd unit starts an entry file that exists, as an unprivileged user;
 *  - the admin host sends exactly ADMIN_CSP (apps/admin/vite.config.ts) on every SPA response;
 *  - the scripts are executable bash with `set -e…`.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { loadConfig } from './config.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const DEPLOY = path.join(ROOT, 'deploy');
const read = (p: string) => fs.readFileSync(path.join(DEPLOY, p), 'utf8');

function envFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    assert.ok(m, `not KEY=value: ${line}`);
    assert.ok(!/\s#/.test(m![2]!), `systemd does not strip inline comments: ${line}`);
    assert.ok(!/^["']/.test(m![2]!), `systemd keeps quotes literally: ${line}`);
    out[m![1]!] = m![2]!;
  }
  return out;
}

test('soltex.env.example: accepted by the API configuration in production', () => {
  const env = envFile(read('soltex.env.example'));
  assert.equal(env.NODE_ENV, 'production');
  assert.ok(!('MIGRATION_DATABASE_URL' in env) && !('BACKUP_DATABASE_URL' in env), 'no migration or backup credentials in the service environment');
  const key = () => crypto.randomBytes(32).toString('base64');
  const filled = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v.replace('<app-password>', 'x').replace(/<32 random bytes, base64>/, key())])
  );
  assert.ok(!Object.values(filled).some((v) => /<|>/.test(v)), 'every required placeholder is filled by this test');
  const config = loadConfig(filled);
  assert.equal(config.env, 'production');
  for (const k of ['migrate.env.example', 'backup.env.example']) envFile(read(k));
});

test('systemd units: existing entry files, unprivileged users, the environment file', () => {
  for (const [unit, entry] of [['soltex-api', 'src/server.ts'], ['soltex-worker', 'src/worker.ts'], ['soltex-preview', 'src/preview-server.ts']] as const) {
    const u = read(`systemd/${unit}.service`);
    assert.match(u, /^User=soltex$/m);
    assert.match(u, /^WorkingDirectory=\/opt\/soltex\/app\/apps\/api$/m);
    assert.match(u, /^EnvironmentFile=\/etc\/soltex\/soltex\.env$/m);
    assert.match(u, new RegExp(`^ExecStart=/usr/bin/node --import tsx ${entry.replace('.', '\\.')}$`, 'm'));
    assert.ok(fs.existsSync(path.join(ROOT, 'apps/api', entry)), entry);
    assert.match(u, /^NoNewPrivileges=true$/m);
  }
  assert.match(read('systemd/soltex-backup.service'), /^ExecStart=\/opt\/soltex\/app\/deploy\/scripts\/backup\.sh$/m);
});

test('admin host: the CSP of every SPA response is ADMIN_CSP', () => {
  const vite = fs.readFileSync(path.join(ROOT, 'apps/admin/vite.config.ts'), 'utf8');
  const parts = [...vite.match(/ADMIN_CSP = \[([\s\S]*?)\]\.join/)![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const csp = parts.join('; ');
  const conf = read('nginx/admin.soltexglobal.conf');
  const sent = [...conf.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g)].map((m) => m[1]);
  assert.ok(sent.length >= 2);
  for (const s of sent) assert.equal(s, csp);
});

test('scripts: executable bash with strict mode', () => {
  for (const f of fs.readdirSync(path.join(DEPLOY, 'scripts'))) {
    const p = path.join(DEPLOY, 'scripts', f);
    assert.ok(fs.statSync(p).mode & 0o111, `${f} is executable`);
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(text.startsWith('#!/usr/bin/env bash'), f);
    assert.match(text, /^set -[eu]+o pipefail$/m, f);
  }
});

test('backup status for «Система»: not set up / never ran / fresh / stale (36 h)', async () => {
  const { backupStatus, BACKUP_STALE_MS } = await import('./system/overview.ts');
  const os = await import('node:os');
  const now = new Date('2026-10-20T03:30:00Z');
  const deps = (file: string | null) => ({ config: { backupStatusFile: file }, now: () => now }) as unknown as Parameters<typeof backupStatus>[0];
  assert.deepEqual(backupStatus(deps(null)), { configured: false, lastSuccessAt: null, stale: false });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-backup-')), 'status');
  assert.deepEqual(backupStatus(deps(file)), { configured: true, lastSuccessAt: null, stale: true }, 'no backup yet');
  fs.writeFileSync(file, '2026-10-20T03:17:41Z\n');
  assert.deepEqual(backupStatus(deps(file)), { configured: true, lastSuccessAt: '2026-10-20T03:17:41.000Z', stale: false });
  fs.writeFileSync(file, new Date(now.getTime() - BACKUP_STALE_MS - 1000).toISOString());
  assert.equal(backupStatus(deps(file)).stale, true);
  fs.writeFileSync(file, 'garbage');
  assert.equal(backupStatus(deps(file)).lastSuccessAt, null);
});
