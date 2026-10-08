/** Password authentication, sessions, brute-force protection, password change and reset. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { sessions, users } from '../src/db/schema.ts';
import { LOCK_AFTER_FAILURES } from '../src/auth/login.ts';
import { IDLE_TIMEOUT_MS, ABSOLUTE_TIMEOUT_MS } from '../src/auth/sessions.ts';
import { Client, closeTestDb, createUser, DB_ENABLED, login, makeApp, problem, signedIn, STRONG_PASSWORD, type TestApp } from './helpers.ts';

describe('password authentication and sessions', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('correct password → session cookie (HttpOnly, Secure, SameSite=Strict, Path=/), no token in the body', async () => {
    const user = await createUser(t, 'editor');
    const c = new Client(t);
    const res = await login(c, user.email);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.next, 'authenticated');
    assert.equal(body.user.email, user.email);
    assert.deepEqual(body.permissions, ['content.read', 'content.edit', 'seo.read', 'media.read', 'media.upload']);
    const cookie = String(res.headers['set-cookie']);
    assert.match(cookie, /__Host-soltex_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\//);
    assert.ok(!res.body.includes(c.sessionToken!), 'the token never appears in a response body');
    // The database stores only a hash of the token.
    const [row] = await t.deps.db!.select().from(sessions).where(eq(sessions.userId, user.id));
    assert.notEqual(row!.tokenHash, c.sessionToken);
    assert.equal(row!.tokenHash.length, 64);
    const me = await c.req('GET', '/api/v1/auth/session');
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.id, user.id);
  });

  test('e-mail is case- and space-insensitive', async () => {
    const user = await createUser(t, 'editor');
    const res = await login(new Client(t), `  ${user.email.toUpperCase()} `);
    assert.equal(res.statusCode, 200);
  });

  test('wrong password, unknown e-mail and disabled account give the same 401', async () => {
    const user = await createUser(t, 'editor');
    const disabled = await createUser(t, 'editor');
    await t.deps.db!.update(users).set({ status: 'disabled' }).where(eq(users.id, disabled.id));
    const answers = await Promise.all([
      login(new Client(t), user.email, 'wrong-password-123456'),
      login(new Client(t), 'nobody@soltex.test', STRONG_PASSWORD),
      login(new Client(t), disabled.email, STRONG_PASSWORD),
    ]);
    for (const res of answers) {
      const p = problem(res);
      assert.equal(p.status, 401);
      assert.equal(p.body.code, 'invalid_credentials');
      assert.equal(res.headers['set-cookie'], undefined);
    }
  });

  test('logout revokes the session', async () => {
    const { c } = await signedIn(t, 'editor');
    const token = c.sessionToken;
    assert.equal((await c.req('POST', '/api/v1/auth/logout')).statusCode, 204);
    const again = new Client(t);
    again.cookies.set('__Host-soltex_session', token!);
    assert.equal(problem(await again.req('GET', '/api/v1/auth/session')).body.code, 'unauthenticated');
  });

  test('idle and absolute session expiry', async () => {
    const { c } = await signedIn(t, 'editor');
    t.clock.advance(IDLE_TIMEOUT_MS - 60_000);
    assert.equal((await c.req('GET', '/api/v1/auth/session')).statusCode, 200, 'still alive just before the idle timeout');
    t.clock.advance(IDLE_TIMEOUT_MS + 1000);
    assert.equal(problem(await c.req('GET', '/api/v1/auth/session')).body.code, 'unauthenticated', 'idle timeout');

    const { c: c2 } = await signedIn(t, 'editor');
    for (let elapsed = 0; elapsed < ABSOLUTE_TIMEOUT_MS; elapsed += IDLE_TIMEOUT_MS / 2) {
      t.clock.advance(IDLE_TIMEOUT_MS / 2);
      await c2.req('GET', '/api/v1/auth/session');
    }
    assert.equal(problem(await c2.req('GET', '/api/v1/auth/session')).body.code, 'unauthenticated', 'absolute timeout');
  });

  test('revoked sessions stop working; revoke-others keeps the current one', async () => {
    const user = await createUser(t, 'editor');
    const a = new Client(t);
    const b = new Client(t);
    await login(a, user.email);
    await login(b, user.email);
    const list = await a.req('GET', '/api/v1/auth/sessions');
    assert.equal(list.json().items.length, 2);
    const res = await a.req('POST', '/api/v1/auth/sessions/revoke-others');
    assert.equal(res.json().revoked, 1);
    assert.equal((await a.req('GET', '/api/v1/auth/session')).statusCode, 200);
    assert.equal((await b.req('GET', '/api/v1/auth/session')).statusCode, 401);
  });

  test('a session cannot revoke somebody else\'s session', async () => {
    const { c: a } = await signedIn(t, 'editor');
    const { c: b } = await signedIn(t, 'editor');
    const bId = (await b.req('GET', '/api/v1/auth/session')).json().session.id;
    assert.equal((await a.req('POST', `/api/v1/auth/sessions/${bId}/revoke`)).statusCode, 404);
    assert.equal((await b.req('GET', '/api/v1/auth/session')).statusCode, 200);
  });

  test('brute force: progressive delay after 5 failures, lock after 20 for unknown browsers only', async () => {
    const user = await createUser(t, 'editor');
    // A browser that signed in successfully before (known device).
    const known = new Client(t);
    assert.equal((await login(known, user.email)).statusCode, 200);
    await known.req('POST', '/api/v1/auth/logout');

    const attacker = new Client(t);
    for (let i = 1; i <= 5; i++) assert.equal((await login(attacker, user.email, `wrong-password-${i}xx`)).statusCode, 401);
    // 6th attempt immediately: throttled before the password is even checked.
    const throttled = await login(attacker, user.email, STRONG_PASSWORD);
    assert.equal(problem(throttled).body.code, 'login_throttled');
    assert.ok(Number(throttled.headers['retry-after']) >= 1);

    for (let i = 6; i <= LOCK_AFTER_FAILURES; i++) {
      t.clock.advance(301_000);
      await login(attacker, user.email, `wrong-password-${i}xx`);
    }
    const [row] = await t.deps.db!.select().from(users).where(eq(users.id, user.id));
    assert.ok(row!.lockedUntil && row!.lockedUntil > t.clock.now(), 'account locked');
    t.clock.advance(301_000);
    assert.equal(problem(await login(attacker, user.email, STRONG_PASSWORD)).body.code, 'login_throttled', 'unknown browser stays locked out even with the right password');
    assert.equal((await login(known, user.email, STRONG_PASSWORD)).statusCode, 200, 'the real user on a known browser is not locked out');
    assert.ok(t.notifier.alerts.some((a) => a.userId === user.id && a.alert === 'account_locked'));
  });

  test('per-IP rate limit on login (30 / 15 min)', async () => {
    const c = new Client(t);
    let limited = 0;
    for (let i = 0; i < 32; i++) {
      const res = await login(c, `nobody${i}@soltex.test`, 'whatever-password-1');
      if (res.statusCode === 429) {
        limited++;
        assert.equal(problem(res).body.code, 'rate_limited');
        assert.ok(res.headers['retry-after']);
      }
    }
    assert.equal(limited, 2);
  });

  test('password change: needs the current password, enforces policy, revokes other sessions', async () => {
    const user = await createUser(t, 'editor');
    const a = new Client(t);
    const b = new Client(t);
    await login(a, user.email);
    await login(b, user.email);
    const before = a.sessionToken;
    assert.equal(problem(await a.req('POST', '/api/v1/auth/password/change', { currentPassword: 'nope-nope-nope', newPassword: 'Another-Long-Passphrase-77' })).status, 401);
    const weak = await a.req('POST', '/api/v1/auth/password/change', { currentPassword: STRONG_PASSWORD, newPassword: 'qwertyuiopasdfgh' });
    assert.equal(problem(weak).body.code, 'password_rejected');
    const ok = await a.req('POST', '/api/v1/auth/password/change', { currentPassword: STRONG_PASSWORD, newPassword: 'Another-Long-Passphrase-77' });
    assert.equal(ok.statusCode, 204);
    assert.notEqual(a.sessionToken, before, 'session token rotated');
    assert.equal((await a.req('GET', '/api/v1/auth/session')).statusCode, 200);
    assert.equal((await b.req('GET', '/api/v1/auth/session')).statusCode, 401);
    assert.equal((await login(new Client(t), user.email, 'Another-Long-Passphrase-77')).statusCode, 200);
  });

  test('password reset: same answer for unknown e-mail, single-use token, 30 minutes, revokes sessions, no sign-in', async () => {
    const user = await createUser(t, 'editor');
    const s = new Client(t);
    await login(s, user.email);
    const c = new Client(t);
    assert.equal((await c.req('POST', '/api/v1/auth/password-reset/request', { email: 'nobody@soltex.test' })).statusCode, 202);
    assert.equal((await c.req('POST', '/api/v1/auth/password-reset/request', { email: user.email })).statusCode, 202);
    const { token } = t.notifier.resets.find((r) => r.userId === user.id)!;
    const res = await c.req('POST', '/api/v1/auth/password-reset/confirm', { token, newPassword: 'Reset-Passphrase-Long-91' });
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['set-cookie'], undefined, 'a reset never signs in');
    assert.equal((await c.req('POST', '/api/v1/auth/password-reset/confirm', { token, newPassword: 'Second-Passphrase-Long-92' })).statusCode, 400, 'single use');
    assert.equal((await s.req('GET', '/api/v1/auth/session')).statusCode, 401, 'sessions revoked');
    assert.equal((await login(new Client(t), user.email, 'Reset-Passphrase-Long-91')).statusCode, 200);

    await c.req('POST', '/api/v1/auth/password-reset/request', { email: user.email });
    const late = t.notifier.resets.filter((r) => r.userId === user.id).at(-1)!.token;
    t.clock.advance(31 * 60_000);
    assert.equal((await c.req('POST', '/api/v1/auth/password-reset/confirm', { token: late, newPassword: 'Third-Passphrase-Long-93' })).statusCode, 400, 'expired');
  });
});
