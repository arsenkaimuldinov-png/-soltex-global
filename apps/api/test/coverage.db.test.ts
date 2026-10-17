/**
 * Route coverage (Phase M-1, docs/admin-security-asvs.md; approved §7 «required automated tests»):
 *  - every guarded route × every role: a role without the route's permission gets 403 `forbidden`
 *    (and the refusal is not a validation or not-found answer that would leak the route's state);
 *    a role with it is never refused as forbidden;
 *  - every state-changing route refuses a request without the CSRF header, from a foreign Origin
 *    and from a cross-site fetch, even with a valid session.
 * The list comes from the app itself (`routeAccess`), so a new route is covered automatically.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hasPermission, ROLES, type Permission, type Role } from '@soltex/core/domain';
import { closeTestDb, DB_ENABLED, makeApp, signedIn, type TestApp } from './helpers.ts';

const NIL = '00000000-0000-7000-8000-000000000000';
const urlOf = (url: string) => url.replace(/:([a-zA-Z]+)/g, (_m, name: string) => (name === 'type' ? 'projects' : name === 'locale' ? 'ru' : NIL));

describe('Route coverage: role × route, CSRF on every mutation', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  const clients = new Map<Role, Awaited<ReturnType<typeof signedIn>>>();
  before(async () => {
    t = await makeApp();
    for (const role of ROLES) clients.set(role, await signedIn(t, role));
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('every guarded route answers 403 exactly to the roles without its permission', async () => {
    const guarded = t.app.routeAccess.filter((r) => r.access.level === 'full' && 'permission' in r.access && r.access.permission);
    assert.ok(guarded.length >= 100, `guarded routes: ${guarded.length}`);
    const problems: string[] = [];
    for (const r of guarded) {
      const access = r.access as { permission: Permission | readonly Permission[] };
      const perms = (Array.isArray(access.permission) ? access.permission : [access.permission]) as Permission[];
      for (const role of ROLES) {
        const allowed = perms.some((p) => hasPermission(role, p));
        const { c } = clients.get(role)!;
        const res = await c.req(r.method as 'GET', urlOf(r.url), r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
        const code = res.headers['content-type']?.toString().includes('problem') ? (res.json() as { code: string }).code : null;
        if (!allowed && (res.statusCode !== 403 || code !== 'forbidden')) problems.push(`${role} ${r.method} ${r.url}: ${res.statusCode} ${code} (expected 403 forbidden)`);
        if (allowed && code === 'forbidden') problems.push(`${role} ${r.method} ${r.url}: forbidden although allowed`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('every state-changing route refuses a missing CSRF header, a foreign Origin and a cross-site fetch', async () => {
    const owner = clients.get('owner')!;
    const cookie = [...owner.c.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const mutating = t.app.routeAccess.filter((r) => r.method !== 'GET' && r.method !== 'HEAD' && r.method !== 'OPTIONS');
    assert.ok(mutating.length >= 60, `mutating routes: ${mutating.length}`);
    const problems: string[] = [];
    for (const r of mutating) {
      const site = r.url.startsWith('/api/v1/public/');
      const header = site ? 'soltex-site' : 'soltex-admin';
      const attempts: Array<[string, Record<string, string>]> = [
        ['no header', {}],
        ['foreign origin', { 'x-requested-with': header, origin: 'https://evil.example' }],
        ...(site ? [] : ([['cross-site fetch', { 'x-requested-with': header, 'sec-fetch-site': 'cross-site' }]] as Array<[string, Record<string, string>]>)),
      ];
      for (const [what, headers] of attempts) {
        const res = await t.app.inject({ method: r.method as 'POST', url: urlOf(r.url), remoteAddress: owner.c.ip, headers: { cookie, 'content-type': 'application/json', ...headers }, payload: '{}' });
        const code = res.statusCode === 403 ? (res.json() as { code: string }).code : null;
        if (code !== 'csrf_rejected') problems.push(`${r.method} ${r.url} (${what}): ${res.statusCode} ${code}`);
      }
    }
    assert.deepEqual(problems, []);
  });
});
