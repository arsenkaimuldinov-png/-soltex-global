/** Pure security primitives (no database). */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { decryptSecret, encryptSecret, keyedHash, randomToken, safeEqual, sha256 } from './crypto.ts';
import { checkPasswordPolicy, hashPassword, verifyPassword } from './passwords.ts';
import { MAX_DELAY_S, throttleDelaySeconds } from './login.ts';

const k = () => crypto.randomBytes(32);

test('secrets at rest: AES-256-GCM, bound to context, tamper-evident, key rotation', () => {
  const keys = new Map([['k1', k()]]);
  const enc = encryptSecret('JBSWY3DPEHPK3PXP', keys, 'k1', 'totp:user-a');
  assert.match(enc, /^v1\.k1\./);
  assert.ok(!enc.includes('JBSWY3DPEHPK3PXP'));
  assert.equal(decryptSecret(enc, keys, 'totp:user-a'), 'JBSWY3DPEHPK3PXP');
  assert.throws(() => decryptSecret(enc, keys, 'totp:user-b'), 'another user cannot reuse the ciphertext');
  const parts = enc.split('.');
  parts[4] = Buffer.from('x' + Buffer.from(parts[4]!, 'base64url').toString('latin1').slice(1), 'latin1').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.'), keys, 'totp:user-a'));
  keys.set('k2', k());
  assert.equal(decryptSecret(enc, keys, 'totp:user-a'), 'JBSWY3DPEHPK3PXP', 'old key still decrypts after rotation');
  assert.match(encryptSecret('s', keys, 'k2', 'c'), /^v1\.k2\./);
  assert.throws(() => decryptSecret(enc, new Map([['k2', k()]]), 'totp:user-a'));
});

test('tokens and hashes', () => {
  assert.ok(Buffer.from(randomToken(), 'base64url').length >= 32);
  assert.notEqual(randomToken(), randomToken());
  assert.equal(sha256('a').length, 64);
  const key = k();
  assert.equal(keyedHash(key, '10.0.0.1'), keyedHash(key, '10.0.0.1'));
  assert.notEqual(keyedHash(key, '10.0.0.1'), keyedHash(k(), '10.0.0.1'));
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', 'abcd'));
});

test('Argon2id password hashes', async () => {
  const phc = await hashPassword('Correct-Horse-Battery-Staple-42');
  assert.match(phc, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.ok(await verifyPassword(phc, 'Correct-Horse-Battery-Staple-42'));
  assert.ok(!(await verifyPassword(phc, 'correct-horse-battery-staple-42')));
  assert.ok(!(await verifyPassword('not-a-hash', 'x')));
});

test('password policy', () => {
  assert.deepEqual(checkPasswordPolicy('short'), ['too_short']);
  assert.deepEqual(checkPasswordPolicy('x'.repeat(257)), ['too_long']);
  assert.ok(checkPasswordPolicy('password1234').includes('too_common'));
  assert.ok(checkPasswordPolicy('anna.smith@soltex.test-2026', 'anna.smith@soltex.test').includes('contains_email'));
  assert.deepEqual(checkPasswordPolicy('Correct-Horse-Battery-Staple-42', 'anna@soltex.test'), []);
});

test('brute force: progressive delay after 5 failures, capped', () => {
  assert.equal(throttleDelaySeconds(4), 0);
  assert.ok(throttleDelaySeconds(5) >= 1);
  assert.ok(throttleDelaySeconds(8) > throttleDelaySeconds(6));
  assert.equal(throttleDelaySeconds(50), MAX_DELAY_S);
});
