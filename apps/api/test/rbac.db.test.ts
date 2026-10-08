/** RBAC on the API: every role, permission checks, step-up, user management, no wildcard bypass. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { hasPermission, ROLES, type Role } from '@soltex/core/domain';
import { auditEvents } from '../src/db/schema.ts';
import { STEP_UP_WINDOW_MS } from '../src/auth/sessions.ts';
import { Client, closeTestDb, createUser, DB_ENABLED, login, makeApp, problem, signedIn, STRONG_PASSWORD, type TestApp } from './helpers.ts';

describe('RBAC on the API', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
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

  const endpoints = [
    { method: 'GET' as const, url: '/api/v1/users', permission: 'users.manage' as const },
    { method: 'GET' as const, url: '/api/v1/audit', permission: 'audit.read' as const },
    { method: 'GET' as const, url: '/api/v1/docs/openapi.json', permission: 'system.read' as const },
  ];

  for (const ep of endpoints)
    test(`${ep.method} ${ep.url}: every role is allowed exactly when it has ${ep.permission}`, async () => {
      for (const role of ROLES) {
        const { c, user } = clients.get(role)!;
        const res = await c.req(ep.method, ep.url);
        if (hasPermission(role, ep.permission)) assert.equal(res.statusCode, 200, `${role} should be allowed`);
        else {
          const p = problem(res);
          assert.equal(p.status, 403, `${role} should be denied`);
          assert.equal(p.body.code, 'forbidden');
          const [denied] = await t.deps.db!
            .select()
            .from(auditEvents)
            .where(and(eq(auditEvents.actorId, user.id), eq(auditEvents.action, 'access.denied'), eq(auditEvents.requestId, p.body.request_id)));
          assert.ok(denied, `access.denied audited for ${role}`);
        }
      }
    });

  test('every non-public route refuses anonymous requests (no route is public by accident)', async () => {
    const anon = new Client(t);
    const publicRoutes = new Set(['/api/v1/health', '/api/v1/auth/login', '/api/v1/auth/password-reset/request', '/api/v1/auth/password-reset/confirm']);
    const urls = t.app.routeAccess.map((r) => ({ method: r.method, url: r.url.replace(':id', '00000000-0000-7000-8000-000000000000'), level: r.access.level }));
    for (const r of urls) assert.equal(r.level === 'public', publicRoutes.has(r.url), `${r.method} ${r.url} access level ${r.level}`);
    assert.ok(urls.length >= 20, `found ${urls.length} routes`);
    for (const r of urls) {
      if (publicRoutes.has(r.url)) continue;
      const res = await anon.req(r.method as 'GET', r.url, r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
      assert.equal(res.statusCode, 401, `${r.method} ${r.url} → ${res.statusCode}`);
    }
  });

  test('admin manages users with step-up; field-level and Owner-only rules hold', async () => {
    const admin = clients.get('admin')!;
    const owner = clients.get('owner')!;
    const created = await admin.c.req('POST', '/api/v1/users', { email: `cm.${Date.now()}@soltex.test`, name: 'New CM', role: 'content_manager', password: STRONG_PASSWORD });
    assert.equal(created.statusCode, 201);
    const id = created.json().id;
    assert.ok(!('passwordHash' in created.json()));

    assert.equal(problem(await admin.c.req('POST', '/api/v1/users', { email: `o.${Date.now()}@soltex.test`, name: 'X', role: 'owner', password: STRONG_PASSWORD })).body.code, 'forbidden', 'admin cannot create an owner');
    assert.equal(problem(await admin.c.req('PATCH', `/api/v1/users/${owner.user.id}`, { status: 'disabled' })).body.code, 'forbidden', 'admin cannot touch an owner');
    assert.equal(problem(await admin.c.req('PATCH', `/api/v1/users/${admin.user.id}`, { role: 'owner' })).body.code, 'forbidden', 'no self-escalation');
    assert.equal(problem(await admin.c.req('PATCH', `/api/v1/users/${id}`, { email: 'x@y.z' })).body.code, 'validation_failed', 'unknown fields are rejected');

    assert.equal((await admin.c.req('PATCH', `/api/v1/users/${id}`, { name: 'Renamed' })).json().name, 'Renamed');
    assert.equal((await owner.c.req('PATCH', `/api/v1/users/${owner.user.id}`, { name: 'Owner Name' })).statusCode, 200, 'own name via user management');
  });

  test('role change and disabling sign the user out everywhere', async () => {
    const admin = clients.get('admin')!;
    const target = await signedIn(t, 'editor');
    assert.equal((await target.c.req('GET', '/api/v1/auth/session')).statusCode, 200);
    assert.equal((await admin.c.req('PATCH', `/api/v1/users/${target.user.id}`, { role: 'seo_specialist' })).statusCode, 200);
    assert.equal((await target.c.req('GET', '/api/v1/auth/session')).statusCode, 401);
    assert.equal((await admin.c.req('PATCH', `/api/v1/users/${target.user.id}`, { status: 'disabled' })).statusCode, 200);
    assert.equal((await login(new Client(t), target.user.email)).statusCode, 401, 'disabled users cannot sign in');
  });

  test('user management needs step-up', async () => {
    const admin = await signedIn(t, 'admin');
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    assert.equal((await admin.c.req('GET', '/api/v1/users')).statusCode, 200, 'reading does not');
    const res = await admin.c.req('POST', '/api/v1/users', { email: `x.${Date.now()}@soltex.test`, name: 'X', role: 'editor', password: STRONG_PASSWORD });
    assert.equal(problem(res).body.code, 'step_up_required');
  });

  test('lost device: admin resets a user\'s MFA; the user must enroll again', async () => {
    const admin = await signedIn(t, 'admin');
    const victim = await signedIn(t, 'marketer');
    assert.equal((await admin.c.req('POST', `/api/v1/users/${victim.user.id}/mfa-reset`)).statusCode, 204);
    assert.equal((await victim.c.req('GET', '/api/v1/auth/session')).statusCode, 401, 'sessions revoked');
    const again = new Client(t);
    assert.equal((await login(again, victim.user.email)).json().next, 'mfa_enrollment_required');
    assert.ok(t.notifier.alerts.some((a) => a.userId === victim.user.id && a.alert === 'mfa_reset_by_admin'));
    assert.equal(problem(await admin.c.req('POST', `/api/v1/users/${admin.user.id}/mfa-reset`)).body.code, 'forbidden', 'not on yourself');
  });

  test('a role without users.manage gets 403 even with a fresh step-up (UI is not the boundary)', async () => {
    const cm = clients.get('content_manager')!;
    const target = await createUser(t, 'editor');
    assert.equal(problem(await cm.c.req('PATCH', `/api/v1/users/${target.id}`, { role: 'admin' })).body.code, 'forbidden');
    assert.equal(problem(await cm.c.req('POST', `/api/v1/users/${target.id}/sessions/revoke`)).body.code, 'forbidden');
  });
});
