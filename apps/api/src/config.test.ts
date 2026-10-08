import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { loadConfig } from './config.ts';

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
  const prod = { ...keys(), NODE_ENV: 'production', ADMIN_ORIGIN: 'https://admin.example.test' };
  assert.equal(loadConfig(prod).apiDocs, 'off');
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
