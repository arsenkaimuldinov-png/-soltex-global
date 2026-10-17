import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { loadConfig } from './config.ts';
import { siteBuildEnv } from './publishing/builder.ts';
import { smtpOptions } from './notify/email.ts';

const keys = () => ({
  DATA_ENCRYPTION_KEYS: `k1:${crypto.randomBytes(32).toString('base64')}`,
  DATA_ENCRYPTION_KEY_ID: 'k1',
  HASH_SECRET: crypto.randomBytes(32).toString('base64'),
});

test('defaults: development, loopback, port 3100, local admin origin', () => {
  const c = loadConfig(keys());
  assert.equal(c.env, 'development');
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.port, 3100);
  assert.equal(c.logLevel, 'info');
  assert.equal(c.adminOrigin, 'http://localhost:3001');
  assert.equal(c.webauthn.rpId, 'localhost');
  assert.equal(c.apiDocs, 'authenticated');
  assert.equal(c.mfaForAllRoles, false);
  assert.equal(c.secureCookies, true);
});

test('test environment is silent and may run without keys (unit tests without a database)', () => {
  const c = loadConfig({ NODE_ENV: 'test' });
  assert.equal(c.logLevel, 'silent');
  assert.equal(c.encryption.keys.size, 0);
});

test('secrets are required outside tests', () => {
  assert.throws(() => loadConfig({}), /DATA_ENCRYPTION_KEYS/);
  assert.throws(() => loadConfig({ ...keys(), HASH_SECRET: 'c2hvcnQ=' }), /HASH_SECRET/);
  assert.throws(() => loadConfig({ ...keys(), DATA_ENCRYPTION_KEYS: 'k1:c2hvcnQ=' }), /32 bytes/);
  assert.throws(() => loadConfig({ ...keys(), DATA_ENCRYPTION_KEY_ID: 'k9' }), /DATA_ENCRYPTION_KEY_ID/);
});

test('production: https origin, API docs off, secure cookies', () => {
  const prod = { ...keys(), NODE_ENV: 'production', ADMIN_ORIGIN: 'https://admin.example.test', RELEASES_DIR: '/srv/soltex', PREVIEW_ORIGIN: 'https://preview.example.test', MEDIA_DIR: '/srv/soltex/media' };
  assert.equal(loadConfig(prod).apiDocs, 'off');
  assert.equal(loadConfig(prod).publishing.releasesDir, '/srv/soltex');
  assert.throws(() => loadConfig({ ...prod, RELEASES_DIR: undefined }), /RELEASES_DIR/);
  assert.throws(() => loadConfig({ ...prod, MEDIA_DIR: undefined }), /MEDIA_DIR/);
  assert.deepEqual(loadConfig(prod).media, { dir: '/srv/soltex/media', legacyDir: '/srv/soltex/current' });
  assert.throws(() => loadConfig({ ...prod, PREVIEW_ORIGIN: undefined }), /PREVIEW_ORIGIN/);
  assert.throws(() => loadConfig({ ...prod, PREVIEW_ORIGIN: 'http://preview.example.test' }), /https/);
  assert.throws(() => loadConfig({ ...prod, PREVIEW_ORIGIN: 'https://admin.example.test' }), /differ/);
  assert.throws(() => loadConfig({ ...keys(), NODE_ENV: 'production' }), /ADMIN_ORIGIN/);
  assert.throws(() => loadConfig({ ...prod, ADMIN_ORIGIN: 'http://admin.example.test' }), /https/);
  assert.throws(() => loadConfig({ ...prod, API_DOCS: 'authenticated' }), /API_DOCS/);
  assert.throws(() => loadConfig({ ...prod, SESSION_COOKIE_SECURE: 'false' }), /SESSION_COOKIE_SECURE/);
});

test('invalid values are rejected', () => {
  assert.throws(() => loadConfig({ ...keys(), NODE_ENV: 'staging' }));
  assert.throws(() => loadConfig({ ...keys(), API_PORT: '70000' }));
  assert.throws(() => loadConfig({ ...keys(), API_LOG_LEVEL: 'verbose' }));
  assert.throws(() => loadConfig({ ...keys(), ADMIN_ORIGIN: 'https://admin.example.test/path' }));
  assert.throws(() => loadConfig({ ...keys(), ADMIN_ORIGIN: 'https://admin.example.test', WEBAUTHN_RP_ID: 'other.test' }));
});

test('site form switches (Phase K-2): off by default; the build gets only the public endpoint', () => {
  const off = loadConfig(keys());
  assert.deepEqual(off.site, { leadsEnabled: false, attributionEnabled: false });
  assert.deepEqual(siteBuildEnv(off), {});
  const on = loadConfig({ ...keys(), PUBLIC_SITE_URL: 'https://soltexglobal.co', SITE_LEADS_ENABLED: 'true', ATTRIBUTION_ENABLED: 'true' });
  assert.deepEqual(siteBuildEnv(on), { SOLTEX_LEADS_ENDPOINT: 'https://soltexglobal.co/api/v1/public/leads', SOLTEX_ATTRIBUTION: 'true' });
  assert.deepEqual(siteBuildEnv(loadConfig({ ...keys(), SITE_LEADS_ENABLED: 'true' })), { SOLTEX_LEADS_ENDPOINT: 'https://soltexglobal.co/api/v1/public/leads' });
  assert.throws(() => loadConfig({ ...keys(), ATTRIBUTION_ENABLED: 'true' }), /needs SITE_LEADS_ENABLED/);
  assert.throws(() => loadConfig({ ...keys(), SITE_LEADS_ENABLED: 'yes' }), /true or false/);
});

test('mail transport: STARTTLS required for smtp:// to another host, TLS 1.2+ (Phase M-1)', () => {
  assert.deepEqual(smtpOptions('smtp://u:p@smtp.example.kz:587'), { url: 'smtp://u:p@smtp.example.kz:587', requireTLS: true, tls: { minVersion: 'TLSv1.2' } });
  assert.equal(smtpOptions('smtps://u:p@smtp.example.kz:465').requireTLS, false, 'TLS from the start');
  assert.equal(smtpOptions('smtp://127.0.0.1:25').requireTLS, false, 'a relay on this machine');
});
