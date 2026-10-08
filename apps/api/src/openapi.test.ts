/** The OpenAPI 3.1 document covers every route and the committed apps/api/openapi.json is current. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

let app: FastifyInstance;
let doc: { openapi: string; paths: Record<string, Record<string, { security?: unknown[]; responses: Record<string, unknown> }>>; components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> } };
before(async () => {
  app = await buildApp({ config: loadConfig({ NODE_ENV: 'test' }) });
  await app.ready();
  doc = app.swagger() as unknown as typeof doc;
});
after(() => app.close());

test('OpenAPI 3.1 with session cookie and CSRF header schemes', () => {
  assert.equal(doc.openapi, '3.1.0');
  assert.deepEqual(Object.keys(doc.components.securitySchemes).sort(), ['csrf', 'session']);
  assert.ok(doc.components.schemas.Problem);
});

test('every route except the document itself is described; public ones need no session', () => {
  for (const r of app.routeAccess) {
    if (r.url === '/api/v1/docs/openapi.json') continue;
    const op = doc.paths[r.url.replace(/:(\w+)/g, '{$1}')]?.[r.method.toLowerCase()];
    assert.ok(op, `${r.method} ${r.url} is documented`);
    const needsSession = JSON.stringify(op.security).includes('session');
    assert.equal(needsSession, r.access.level !== 'public', `${r.method} ${r.url} security`);
    if (r.method !== 'GET') assert.ok(JSON.stringify(op.security).includes('csrf'), `${r.method} ${r.url} needs the CSRF header`);
  }
});

test('the committed openapi.json matches the code (run `npm run openapi -w @soltex/api`)', async () => {
  const committed = await readFile(path.resolve(import.meta.dirname, '../openapi.json'), 'utf8');
  assert.equal(committed, `${JSON.stringify(doc, null, 2)}\n`);
});
