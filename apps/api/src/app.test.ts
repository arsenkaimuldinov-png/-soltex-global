import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

const app = buildApp(loadConfig({ NODE_ENV: 'test' }));

test('GET /api/v1/health → 200 {status:"ok"}, not cached, with request id', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(res.headers['x-request-id']);
});

test('X-Request-ID from the proxy is echoed back', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': 'req-123' } });
  assert.equal(res.headers['x-request-id'], 'req-123');
});

test('unknown route → 404', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
  assert.equal(res.statusCode, 404);
});

test('no CORS headers are sent', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'https://evil.example' } });
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});
