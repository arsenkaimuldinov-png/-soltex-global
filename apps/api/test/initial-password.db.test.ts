/**
 * Initial passwords (Phase M-1, ASVS 4.0.3 §2.3.1; docs/admin-auth.md §2): a password given by an
 * Owner or Admin works once — the user replaces it at the first sign-in, after the second factor —
 * and expires after 7 days; an admin can give a new one. Sessions now end after 12 hours (§3.3.2).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { INITIAL_PASSWORD_TTL_MS } from '../src/auth/login.ts';
import { ABSOLUTE_TIMEOUT_MS } from '../src/auth/sessions.ts';
import { Client, closeTestDb, DB_ENABLED, enrollTotp, login, makeApp, problem, signedIn, type TestApp } from './helpers.ts';

const INITIAL = 'Initial-Pass-Word-7731-x';
const MINE = 'My-Own-Long-Passphrase-2026';

describe('Initial passwords and session lifetime (Phase M-1)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  before(async () => {
    t = await makeApp();
    admin = await signedIn(t, 'admin');
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const create = async (role: string) => {
    const res = await admin.c.req('POST', '/api/v1/users', { email: `init.${role}.${Date.now()}@soltex.test`, name: `Init ${role}`, role, password: INITIAL });
    assert.equal(res.statusCode, 201, res.body);
    assert.equal(res.json().passwordTemporary, true);
    return res.json() as { id: string; email: string };
  };

  test('first sign-in: second factor first, then the initial password must be replaced; nothing else works until then', async () => {
    const u = await create('content_manager');
    const c = new Client(t);
    assert.equal((await login(c, u.email, INITIAL)).json().next, 'mfa_enrollment_required');
    await enrollTotp(c);
    assert.equal((await c.req('GET', '/api/v1/auth/session')).json().next, 'password_change_required');
    assert.equal(problem(await c.req('GET', '/api/v1/content/projects')).body.code, 'password_change_required');
    assert.equal(problem(await c.req('GET', '/api/v1/dashboard')).body.code, 'password_change_required');
    const same = await c.req('POST', '/api/v1/auth/password/change', { currentPassword: INITIAL, newPassword: INITIAL });
    assert.deepEqual((problem(same).body as { errors?: unknown }).errors, [{ field: 'newPassword', message: 'same_as_current' }]);
    assert.equal((await c.req('POST', '/api/v1/auth/password/change', { currentPassword: INITIAL, newPassword: MINE })).statusCode, 204);
    assert.equal((await c.req('GET', '/api/v1/auth/session')).json().next, 'authenticated');
    assert.equal((await c.req('GET', '/api/v1/content/projects')).statusCode, 200);
    const [row] = await t.deps.db!.select().from(s.users).where(eq(s.users.id, u.id));
    assert.equal(row!.passwordTemporary, false);
    assert.equal((await login(new Client(t), u.email, INITIAL)).statusCode, 401, 'the initial password no longer works');
  });

  test('a role without a second factor is asked right after the password', async () => {
    const u = await create('editor');
    const c = new Client(t);
    assert.equal((await login(c, u.email, INITIAL)).json().next, 'password_change_required');
  });

  test('an initial password expires after 7 days; an admin gives a new one (step-up, sessions end, lock-out lifted)', async () => {
    const u = await create('editor');
    const early = new Client(t);
    assert.equal((await login(early, u.email, INITIAL)).statusCode, 200);
    t.clock.advance(INITIAL_PASSWORD_TTL_MS + 60_000);
    const late = await login(new Client(t), u.email, INITIAL);
    assert.equal(problem(late).body.code, 'initial_password_expired');
    assert.equal(late.statusCode, 401);

    const fresh = await signedIn(t, 'admin');
    const res = await fresh.c.req('POST', `/api/v1/users/${u.id}/initial-password`, { password: 'Second-Initial-Pass-4410' });
    assert.equal(res.statusCode, 204, res.body);
    assert.equal((await early.req('GET', '/api/v1/auth/session')).statusCode, 401, 'old sessions ended');
    assert.equal((await login(new Client(t), u.email, 'Second-Initial-Pass-4410')).json().next, 'password_change_required');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'user.initial_password'));
    assert.ok(audit && !JSON.stringify(audit.summary).includes('Second-Initial'), 'audited without the password');

    assert.equal(problem(await fresh.c.req('POST', `/api/v1/users/${fresh.user.id}/initial-password`, { password: 'Second-Initial-Pass-4410' })).body.code, 'forbidden', 'not on yourself');
    const owner = await signedIn(t, 'owner');
    assert.equal(problem(await fresh.c.req('POST', `/api/v1/users/${owner.user.id}/initial-password`, { password: 'Second-Initial-Pass-4410' })).body.code, 'forbidden', 'an Admin cannot touch an Owner');
    assert.equal(problem(await fresh.c.req('POST', `/api/v1/users/${u.id}/initial-password`, { password: 'short' })).status, 422, 'password policy');
  });

  test('users created outside user management (bootstrap, tests) are not affected; sessions last 12 hours', async () => {
    const u = await signedIn(t, 'editor');
    assert.equal((await u.c.req('GET', '/api/v1/auth/session')).json().next, 'authenticated');
    assert.equal(ABSOLUTE_TIMEOUT_MS, 12 * 60 * 60 * 1000);
    for (let h = 0; h < 12; h += 4) {
      t.clock.advance(4 * 60 * 60 * 1000 - 1000);
      assert.equal((await u.c.req('GET', '/api/v1/auth/session')).statusCode, 200, `active after ${h + 4} h`);
    }
    t.clock.advance(10_000);
    assert.equal((await u.c.req('GET', '/api/v1/auth/session')).statusCode, 401, 'signed out after 12 hours even when active');
  });
});
