/** API without a database: health, request ids, problems, headers, no CORS, access rule enforcement. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

let app: FastifyInstance;
before(async () => {
  app = await buildApp({ config: loadConfig({ NODE_ENV: 'test' }) });
});
after(() => app.close());

test('GET /api/v1/health → 200 {status:"ok"}, not cached, with request id', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(String(res.headers['x-request-id']), /^[0-9a-f-]{36}$/);
});

test('a UUID X-Request-ID from the proxy is echoed back; anything else is replaced', async () => {
  const id = '0192f0a5-7c3e-7d1a-9b2c-3d4e5f607182';
  const kept = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': id } });
  assert.equal(kept.headers['x-request-id'], id);
  const replaced = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': 'req-123' } });
  assert.notEqual(replaced.headers['x-request-id'], 'req-123');
  assert.match(String(replaced.headers['x-request-id']), /^[0-9a-f-]{36}$/);
});

test('unknown route → 404 problem details', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
  assert.equal(res.statusCode, 404);
  assert.match(String(res.headers['content-type']), /^application\/problem\+json/);
  assert.equal(res.json().code, 'not_found');
});

test('no CORS headers are sent', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'https://evil.example' } });
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('a protected route without a session → 401, before any database access', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/auth/session' });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, 'unauthenticated');
});

test('every /api/v1 route declares an access rule; only health, login and password reset are public', () => {
  const pub = app.routeAccess.filter((r) => r.access.level === 'public').map((r) => `${r.method} ${r.url}`).sort();
  assert.deepEqual(pub, [
    'GET /api/v1/health',
    'POST /api/v1/auth/login',
    'POST /api/v1/auth/password-reset/confirm',
    'POST /api/v1/auth/password-reset/request',
  ]);
});

test('a route without an access rule stops the app from starting', async () => {
  const { default: Fastify } = await import('fastify');
  const { registerAccessControl } = await import('./auth/guard.ts');
  const bare = Fastify();
  registerAccessControl(bare, { config: loadConfig({ NODE_ENV: 'test' }), db: null, now: () => new Date(), notifier: { passwordReset: async () => {}, securityAlert: async () => {} } });
  assert.throws(() => bare.get('/api/v1/oops', async () => 'x'), /no access rule/);
  await bare.close();
});
