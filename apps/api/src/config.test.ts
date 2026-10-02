import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from './config.ts';

test('defaults: development, loopback, port 3100', () => {
  assert.deepEqual(loadConfig({}), { env: 'development', host: '127.0.0.1', port: 3100, logLevel: 'info' });
});

test('test environment is silent by default', () => {
  assert.equal(loadConfig({ NODE_ENV: 'test' }).logLevel, 'silent');
});

test('invalid values are rejected', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'staging' }));
  assert.throws(() => loadConfig({ API_PORT: '70000' }));
  assert.throws(() => loadConfig({ API_LOG_LEVEL: 'verbose' }));
});
