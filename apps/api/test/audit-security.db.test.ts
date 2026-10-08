/** Audit log contents, secrets hygiene, request IDs, RFC 9457, CSRF, headers, input validation. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { auditEvents, sessions } from '../src/db/schema.ts';
import { checkSummary, AuditSummaryError } from '../src/audit/audit.ts';
import { Client, closeTestDb, createUser, DB_ENABLED, enrollTotp, login, makeApp, ORIGIN, problem, STRONG_PASSWORD, type TestApp } from './helpers.ts';

describe('audit log and API security', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('a login creates an audit event carrying the response request id and no secrets', async () => {
    const user = await createUser(t, 'marketer');
    const c = new Client(t);
    const rid = '0192f0a5-7c3e-7d1a-9b2c-3d4e5f607182';
    const res = await login(c, user.email, STRONG_PASSWORD);
    const res2 = await c.req('GET', '/api/v1/auth/session', undefined, { 'x-request-id': rid });
    assert.equal(res2.headers['x-request-id'], rid, 'a valid UUID from the proxy is kept');
    const enrolled = await enrollTotp(c);

    const [event] = await t.deps.db!.select().from(auditEvents).where(eq(auditEvents.requestId, String(res.headers['x-request-id'])));
    assert.ok(event, 'audit event with the response X-Request-ID');
    assert.equal(event!.action, 'auth.login');
    assert.equal(event!.result, 'success');
    assert.equal(event!.actorId, user.id);
    assert.equal(event!.ipHash?.length, 32, 'IP stored as keyed hash only');
    assert.ok(!JSON.stringify(event).includes(c.ip));

    const all = await t.deps.db!.select().from(auditEvents).where(eq(auditEvents.actorId, user.id));
    const text = JSON.stringify(all);
    const [session] = await t.deps.db!.select().from(sessions).where(eq(sessions.userId, user.id));
    for (const secret of [STRONG_PASSWORD, user.passwordHash, c.sessionToken!, session!.tokenHash, enrolled.secret, ...enrolled.recoveryCodes, user.email])
      assert.ok(!text.includes(secret), `audit must not contain ${secret.slice(0, 6)}…`);
  });

  test('failed logins for unknown accounts are audited with an e-mail hash, never the e-mail', async () => {
    const res = await login(new Client(t), 'ghost.user@soltex.test', 'wrong-password-123');
    const [event] = await t.deps.db!.select().from(auditEvents).where(eq(auditEvents.requestId, String(res.headers['x-request-id'])));
    assert.equal(event!.result, 'failure');
    assert.equal((event!.summary as { reason: string }).reason, 'unknown_account');
    assert.ok(!JSON.stringify(event).includes('ghost.user'));
  });

  test('the audit writer refuses secret-like or unknown summary keys', () => {
    assert.throws(() => checkSummary({ password: 'x' }), AuditSummaryError);
    assert.throws(() => checkSummary({ token: 'x' }), AuditSummaryError);
    assert.throws(() => checkSummary({ totp_code: '123456' }), AuditSummaryError);
    assert.throws(() => checkSummary({ email: 'a@b.c' }), AuditSummaryError);
    assert.throws(() => checkSummary({ reason: 'x'.repeat(201) }), AuditSummaryError);
    assert.doesNotThrow(() => checkSummary({ reason: 'wrong_password', email_hash: 'abc', factor: 'totp' }));
  });

  test('no password, token, code or cookie ever reaches the logs', async () => {
    const user = await createUser(t, 'marketer');
    const c = new Client(t);
    await login(c, user.email, STRONG_PASSWORD);
    await login(new Client(t), user.email, 'Wrong-But-Long-Password-1');
    const { secret, recoveryCodes } = await enrollTotp(c);
    await c.req('POST', '/api/v1/auth/password-reset/request', { email: user.email });
    const reset = t.notifier.resets.at(-1)!.token;
    for (const s of [STRONG_PASSWORD, 'Wrong-But-Long-Password-1', c.sessionToken!, secret, recoveryCodes[0]!, reset])
      assert.ok(!t.logs.text.includes(s), `log must not contain ${s.slice(0, 6)}…`);
    assert.ok(t.logs.text.includes('request_id'), 'logs do carry request ids');
  });

  test('X-Request-ID: generated when missing or not a UUID, echoed in problems', async () => {
    const c = new Client(t);
    const a = await c.req('GET', '/api/v1/health');
    assert.match(String(a.headers['x-request-id']), /^[0-9a-f-]{36}$/);
    const b = await c.req('GET', '/api/v1/health', undefined, { 'x-request-id': 'evil\nInjected: header <script>' });
    assert.match(String(b.headers['x-request-id']), /^[0-9a-f-]{36}$/);
    const p = await c.req('GET', '/api/v1/nope');
    assert.equal(problem(p).body.request_id, p.headers['x-request-id']);
  });

  test('RFC 9457 problem details, no stack traces', async () => {
    const res = await new Client(t).req('GET', '/api/v1/does-not-exist');
    assert.equal(res.statusCode, 404);
    assert.match(String(res.headers['content-type']), /^application\/problem\+json/);
    const body = res.json();
    assert.deepEqual(Object.keys(body).sort(), ['code', 'request_id', 'status', 'title', 'type']);
    assert.equal(body.type, 'urn:soltex:problem:not_found');
    assert.equal(body.status, 404);
  });

  test('invalid input is rejected with field errors; oversized bodies with 413', async () => {
    const c = new Client(t);
    const bad = await c.req('POST', '/api/v1/auth/login', { email: 'not-an-email', password: '' });
    const p = problem(bad);
    assert.equal(p.status, 400);
    assert.equal(p.body.code, 'validation_failed');
    assert.ok((p.body as unknown as { errors: unknown[] }).errors.length >= 1);
    const big = await c.req('POST', '/api/v1/auth/login', { email: 'a@b.cd', password: 'x'.repeat(70_000) });
    assert.equal(problem(big).status, 413);
  });

  test('CSRF: custom header required; foreign Origin and cross-site fetches refused', async () => {
    const user = await createUser(t, 'editor');
    const body = JSON.stringify({ email: user.email, password: STRONG_PASSWORD });
    const base = { method: 'POST' as const, url: '/api/v1/auth/login', payload: body, remoteAddress: '10.99.0.1' };
    const noHeader = await t.app.inject({ ...base, headers: { 'content-type': 'application/json' } });
    assert.equal(problem(noHeader).body.code, 'csrf_rejected');
    const foreign = await t.app.inject({ ...base, headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-admin', origin: 'https://evil.example' } });
    assert.equal(problem(foreign).body.code, 'csrf_rejected');
    const crossSite = await t.app.inject({ ...base, headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-admin', 'sec-fetch-site': 'cross-site' } });
    assert.equal(problem(crossSite).body.code, 'csrf_rejected');
    const ok = await t.app.inject({ ...base, headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-admin', origin: ORIGIN, 'sec-fetch-site': 'same-origin' } });
    assert.equal(ok.statusCode, 200);
  });

  test('security headers, no CORS, no caching', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'https://evil.example' } });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(String(res.headers['content-security-policy']), /default-src 'none'/);
    assert.match(String(res.headers['content-security-policy']), /frame-ancestors 'none'/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    const pre = await t.app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    assert.equal(pre.headers['access-control-allow-origin'], undefined);
  });

  test('audit events cannot be changed through the API role (append-only)', async () => {
    const ids = (await t.deps.db!.select({ id: auditEvents.id }).from(auditEvents).limit(1)).map((r) => r.id);
    // Drizzle wraps the driver error; 42501 = insufficient_privilege.
    const denied = (e: unknown) => {
      const err = e as { code?: string; cause?: { code?: string } };
      return (err.cause?.code ?? err.code) === '42501';
    };
    assert.ok(ids.length === 1);
    await assert.rejects(t.deps.db!.update(auditEvents).set({ action: 'tampered' }).where(inArray(auditEvents.id, ids)), denied);
    await assert.rejects(t.deps.db!.delete(auditEvents).where(inArray(auditEvents.id, ids)), denied);
  });
});
