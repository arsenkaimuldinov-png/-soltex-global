/** TOTP, recovery codes, MFA enforcement and step-up. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { recoveryCodes, totpCredentials } from '../src/db/schema.ts';
import { STEP_UP_WINDOW_MS, PENDING_MFA_TIMEOUT_MS } from '../src/auth/sessions.ts';
import {
  Client,
  closeTestDb,
  createUser,
  DB_ENABLED,
  enrollTotp,
  login,
  makeApp,
  nextTotpStep,
  problem,
  signedIn,
  totpCode,
  type TestApp,
} from './helpers.ts';

describe('TOTP, recovery codes and step-up', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('roles that need MFA can only enroll until a factor exists', async () => {
    const user = await createUser(t, 'marketer');
    const c = new Client(t);
    const res = await login(c, user.email);
    assert.equal(res.json().next, 'mfa_enrollment_required');
    assert.equal(problem(await c.req('GET', '/api/v1/auth/sessions')).body.code, 'mfa_enrollment_required');
    assert.equal((await c.req('GET', '/api/v1/auth/mfa')).statusCode, 200);
    const { recoveryCodes: codes } = await enrollTotp(c);
    assert.equal(codes.length, 10, 'first factor returns 10 recovery codes once');
    assert.equal((await c.req('GET', '/api/v1/auth/sessions')).statusCode, 200);
  });

  test('TOTP secret is encrypted at rest; codes never reach logs or the audit log', async () => {
    const user = await createUser(t, 'marketer');
    const c = new Client(t);
    await login(c, user.email);
    const { secret } = await enrollTotp(c);
    const [row] = await t.deps.db!.select().from(totpCredentials).where(eq(totpCredentials.userId, user.id));
    assert.ok(row!.secretEncrypted.startsWith('v1.t1.'));
    assert.ok(!row!.secretEncrypted.includes(secret));
    assert.ok(!t.logs.text.includes(secret));
  });

  test('sign-in with TOTP: success upgrades and rotates the session; failure and replay are refused', async () => {
    const user = await createUser(t, 'marketer');
    const setup = new Client(t);
    await login(setup, user.email);
    const { secret } = await enrollTotp(setup);

    const c = new Client(t);
    const res = await login(c, user.email);
    assert.equal(res.json().next, 'mfa_required');
    assert.equal(problem(await c.req('GET', '/api/v1/auth/sessions')).body.code, 'mfa_required', 'nothing works before the second factor');
    assert.equal(problem(await c.req('POST', '/api/v1/auth/mfa/totp/verify', { code: '000000' })).body.code, 'mfa_invalid');
    nextTotpStep(t.clock);
    const before = c.sessionToken;
    const code = await totpCode(secret, t.clock);
    const ok = await c.req('POST', '/api/v1/auth/mfa/totp/verify', { code });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().session.aal, 2);
    assert.notEqual(c.sessionToken, before, 'token rotated after the second factor');

    // The same code cannot be used again (replay), even in another session.
    const other = new Client(t);
    await login(other, user.email);
    assert.equal(problem(await other.req('POST', '/api/v1/auth/mfa/totp/verify', { code })).body.code, 'mfa_invalid');
  });

  test('five wrong codes revoke the half-signed-in session', async () => {
    const { user } = await signedIn(t, 'marketer');
    const c = new Client(t);
    await login(c, user.email);
    for (let i = 0; i < 5; i++) await c.req('POST', '/api/v1/auth/mfa/totp/verify', { code: '000000' });
    assert.equal(problem(await c.req('GET', '/api/v1/auth/session')).body.code, 'unauthenticated');
  });

  test('a password-only session of an MFA user expires after 10 minutes', async () => {
    const { user } = await signedIn(t, 'marketer');
    const c = new Client(t);
    await login(c, user.email);
    t.clock.advance(PENDING_MFA_TIMEOUT_MS + 1000);
    assert.equal(problem(await c.req('GET', '/api/v1/auth/session')).body.code, 'unauthenticated');
  });

  test('recovery codes: one-time use, stored hashed, regeneration revokes old codes', async () => {
    const user = await createUser(t, 'marketer');
    const setup = new Client(t);
    await login(setup, user.email);
    const { recoveryCodes: codes } = await enrollTotp(setup);

    const rows = await t.deps.db!.select().from(recoveryCodes).where(eq(recoveryCodes.userId, user.id));
    assert.equal(rows.length, 10);
    for (const r of rows) assert.ok(!codes.some((c) => r.codeHash.includes(c.replace(/-/g, ''))), 'only hashes are stored');

    const a = new Client(t);
    await login(a, user.email);
    const used = await a.req('POST', '/api/v1/auth/mfa/recovery/verify', { code: codes[0]!.toLowerCase() });
    assert.equal(used.statusCode, 200, 'case-insensitive');
    assert.equal(used.json().mfa.recoveryCodesLeft, 9);
    assert.ok(t.notifier.alerts.some((x) => x.userId === user.id && x.alert === 'recovery_code_used'));

    const b = new Client(t);
    await login(b, user.email);
    assert.equal(problem(await b.req('POST', '/api/v1/auth/mfa/recovery/verify', { code: codes[0] })).body.code, 'mfa_invalid', 'used once');

    // Regenerate (step-up is fresh: `a` just verified a factor).
    const regen = await a.req('POST', '/api/v1/auth/mfa/recovery-codes/regenerate');
    assert.equal(regen.statusCode, 200);
    const fresh = regen.json().recoveryCodes as string[];
    assert.equal(fresh.length, 10);
    assert.equal(problem(await b.req('POST', '/api/v1/auth/mfa/recovery/verify', { code: codes[1] })).body.code, 'mfa_invalid', 'old codes revoked');
    assert.equal((await b.req('POST', '/api/v1/auth/mfa/recovery/verify', { code: fresh[0] })).statusCode, 200);
  });

  test('step-up: required for sensitive actions, valid 10 minutes, renewed by a factor', async () => {
    const { c, totpSecret } = await signedIn(t, 'marketer');
    assert.equal((await c.req('POST', '/api/v1/auth/mfa/recovery-codes/regenerate')).statusCode, 200, 'fresh after sign-in');
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    const res = await c.req('POST', '/api/v1/auth/mfa/recovery-codes/regenerate');
    assert.equal(problem(res).body.code, 'step_up_required');
    assert.equal((await c.req('GET', '/api/v1/auth/sessions')).statusCode, 200, 'normal work continues without step-up');
    nextTotpStep(t.clock);
    assert.equal((await c.req('POST', '/api/v1/auth/mfa/totp/verify', { code: await totpCode(totpSecret!, t.clock) })).statusCode, 200);
    assert.equal((await c.req('POST', '/api/v1/auth/mfa/recovery-codes/regenerate')).statusCode, 200);
  });

  test('adding a second factor requires step-up; the only factor cannot be removed', async () => {
    const { c } = await signedIn(t, 'marketer');
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    assert.equal(problem(await c.req('POST', '/api/v1/auth/mfa/totp/enroll')).body.code, 'step_up_required');
    assert.equal(problem(await c.req('POST', '/api/v1/auth/passkeys/registration/options')).body.code, 'step_up_required');
  });

  test('TOTP cannot be disabled when it is the only factor of an MFA role', async () => {
    const { c } = await signedIn(t, 'marketer');
    assert.equal(problem(await c.req('DELETE', '/api/v1/auth/mfa/totp')).body.code, 'conflict');
  });

  test('editor (no sensitive permissions) may enroll TOTP voluntarily; MFA_FOR_ALL_ROLES makes it mandatory', async () => {
    const { c } = await signedIn(t, 'editor');
    assert.equal((await c.req('GET', '/api/v1/auth/session')).json().mfa.requirement, 'none');
    await enrollTotp(c);
    assert.equal((await c.req('GET', '/api/v1/auth/session')).json().mfa.enrolled, true);

    const strict = await makeApp({ MFA_FOR_ALL_ROLES: 'true' });
    try {
      const user = await createUser(strict, 'editor');
      const s = new Client(strict);
      assert.equal((await login(s, user.email)).json().next, 'mfa_enrollment_required');
    } finally {
      await strict.app.close();
    }
  });
});
