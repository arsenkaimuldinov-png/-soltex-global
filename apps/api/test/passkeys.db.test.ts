/** WebAuthn passkeys: registration, authentication, challenge lifecycle, replay, ownership. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { webauthnCredentials } from '../src/db/schema.ts';
import { CHALLENGE_TTL_MS } from '../src/auth/webauthn.ts';
import { STEP_UP_WINDOW_MS } from '../src/auth/sessions.ts';
import {
  Client,
  closeTestDb,
  createUser,
  DB_ENABLED,
  enrollPasskey,
  login,
  makeApp,
  passkeyCheck,
  problem,
  signedIn,
  SoftAuthenticator,
  totpCode,
  type TestApp,
} from './helpers.ts';

describe('passkeys (WebAuthn)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('Owner must enroll a passkey; only public key material is stored', async () => {
    const owner = await createUser(t, 'owner');
    const c = new Client(t);
    const res = await login(c, owner.email);
    assert.equal(res.json().next, 'mfa_enrollment_required');
    assert.equal(res.json().mfa.requirement, 'passkey');
    const { auth, recoveryCodes } = await enrollPasskey(c, 'MacBook Touch ID');
    assert.equal(recoveryCodes.length, 10);
    const me = (await c.req('GET', '/api/v1/auth/session')).json();
    assert.equal(me.next, 'authenticated');
    assert.equal(me.session.aal, 2);
    const [row] = await t.deps.db!.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, owner.id));
    assert.equal(row!.credentialId, auth.id);
    assert.equal(row!.name, 'MacBook Touch ID');
    assert.deepEqual(Object.keys(row!).sort(), ['backedUp', 'createdAt', 'credentialId', 'deviceType', 'id', 'lastUsedAt', 'name', 'publicKey', 'signCount', 'transports', 'userId'].sort());
    const list = await c.req('GET', '/api/v1/auth/passkeys');
    assert.equal(list.json().items.length, 1);
    assert.ok(!('publicKey' in list.json().items[0]));
  });

  test('TOTP alone does not satisfy the Owner requirement', async () => {
    const owner = await createUser(t, 'owner');
    const c = new Client(t);
    await login(c, owner.email);
    const start = await c.req('POST', '/api/v1/auth/mfa/totp/enroll');
    assert.equal(start.statusCode, 200);
    const confirm = await c.req('POST', '/api/v1/auth/mfa/totp/confirm', { code: await totpCode(start.json().secret, t.clock) });
    assert.equal(confirm.json().next, 'mfa_enrollment_required');
    assert.equal(problem(await c.req('GET', '/api/v1/users')).body.code, 'mfa_enrollment_required');
  });

  test('sign-in with a passkey; the signature counter is updated', async () => {
    const { user, passkey } = await signedIn(t, 'admin');
    const c = new Client(t);
    assert.equal((await login(c, user.email)).json().next, 'mfa_required');
    const res = await passkeyCheck(c, passkey!);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().session.aal, 2);
    const [row] = await t.deps.db!.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
    assert.equal(row!.signCount, passkey!.signCount);
    assert.ok(row!.lastUsedAt);
  });

  test('challenge lifecycle: single use, expires after 5 minutes, bound to the session and purpose', async () => {
    const { user, passkey } = await signedIn(t, 'admin');
    const c = new Client(t);
    await login(c, user.email);

    // Replay: the same signed response a second time.
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    const response = passkey!.authenticate(opts);
    assert.equal((await c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response })).statusCode, 200);
    const replay = await c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response });
    assert.equal(problem(replay).body.code, 'challenge_invalid');

    // Expiry.
    const d = new Client(t);
    await login(d, user.email);
    const late = (await d.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    t.clock.advance(CHALLENGE_TTL_MS + 1000);
    assert.equal(problem(await d.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: passkey!.authenticate(late) })).body.code, 'challenge_invalid');

    // Another session cannot use this session's challenge.
    const e = new Client(t);
    await login(e, user.email);
    const f = new Client(t);
    await login(f, user.email);
    const foreign = (await e.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    assert.equal(problem(await f.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: passkey!.authenticate(foreign) })).body.code, 'challenge_invalid');

    // A registration challenge cannot be used for authentication.
    const reg = (await c.req('POST', '/api/v1/auth/passkeys/registration/options')).json();
    assert.equal(problem(await c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: passkey!.authenticate(reg) })).body.code, 'challenge_invalid');
  });

  test('wrong origin is rejected', async () => {
    const { user, passkey } = await signedIn(t, 'admin');
    const c = new Client(t);
    await login(c, user.email);
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    const res = await c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: passkey!.authenticate(opts, { origin: 'https://evil.example' }) });
    assert.equal(problem(res).body.code, 'mfa_invalid');
  });

  test('credential ownership: another user\'s passkey cannot sign in or be removed', async () => {
    const victim = await signedIn(t, 'admin');
    const attacker = await signedIn(t, 'admin');
    const c = new Client(t);
    await login(c, attacker.user.email);
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    // The attacker presents the victim's (valid) authenticator for the attacker's account.
    const res = await c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: victim.passkey!.authenticate(opts) });
    assert.equal(problem(res).body.code, 'mfa_invalid');

    const victimKeys = (await victim.c.req('GET', '/api/v1/auth/passkeys')).json().items;
    assert.equal((await attacker.c.req('DELETE', `/api/v1/auth/passkeys/${victimKeys[0].id}`)).statusCode, 404);
    assert.equal((await victim.c.req('GET', '/api/v1/auth/passkeys')).json().items.length, 1);
  });

  test('the same authenticator cannot be registered twice; the last required passkey cannot be removed', async () => {
    const { c, passkey } = await signedIn(t, 'owner');
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/registration/options')).json();
    const dupe = await c.req('POST', '/api/v1/auth/passkeys/registration/verify', { name: 'dupe', response: passkey!.register(opts) });
    assert.equal(problem(dupe).body.code, 'conflict');
    const keys = (await c.req('GET', '/api/v1/auth/passkeys')).json().items;
    assert.equal(problem(await c.req('DELETE', `/api/v1/auth/passkeys/${keys[0].id}`)).body.code, 'conflict');
    // With a second key the first can go (step-up fresh after registering).
    await enrollPasskey(c, 'Backup key');
    assert.equal((await c.req('DELETE', `/api/v1/auth/passkeys/${keys[0].id}`)).statusCode, 204);
  });

  test('passkey removal needs step-up', async () => {
    const { c } = await signedIn(t, 'owner');
    const second = await enrollPasskey(c, 'second');
    void second;
    const keys = (await c.req('GET', '/api/v1/auth/passkeys')).json().items;
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    assert.equal(problem(await c.req('DELETE', `/api/v1/auth/passkeys/${keys[0].id}`)).body.code, 'step_up_required');
  });

  test('registration needs user verification and the right RP', async () => {
    const owner = await createUser(t, 'owner');
    const c = new Client(t);
    await login(c, owner.email);
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/registration/options')).json();
    const foreign = new SoftAuthenticator('evil.example', t.config.webauthn.origin);
    const res = await c.req('POST', '/api/v1/auth/passkeys/registration/verify', { name: 'x', response: foreign.register(opts) });
    assert.equal(problem(res).body.code, 'mfa_invalid');
  });

  test('user verification (biometric / PIN) is required for registration and sign-in', async () => {
    const owner = await createUser(t, 'owner');
    const c = new Client(t);
    await login(c, owner.email);
    const opts = (await c.req('POST', '/api/v1/auth/passkeys/registration/options')).json();
    const noUv = new SoftAuthenticator(t.config.webauthn.rpId, t.config.webauthn.origin);
    assert.equal(problem(await c.req('POST', '/api/v1/auth/passkeys/registration/verify', { name: 'x', response: noUv.register(opts, { userVerified: false }) })).body.code, 'mfa_invalid');

    const { user, passkey } = await signedIn(t, 'admin');
    const d = new Client(t);
    await login(d, user.email);
    const auth = (await d.req('POST', '/api/v1/auth/passkeys/authentication/options')).json();
    assert.equal(problem(await d.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: passkey!.authenticate(auth, { userVerified: false }) })).body.code, 'mfa_invalid');
  });
});
