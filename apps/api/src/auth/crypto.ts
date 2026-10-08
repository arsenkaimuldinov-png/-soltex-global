/**
 * Cryptographic primitives used by authentication. Only Node's `crypto` module: no
 * self-written algorithms (approved §7). Passwords use Argon2id (passwords.ts), never these.
 */
import crypto from 'node:crypto';

/** Opaque random token, base64url (default 256 bits). */
export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');

/** SHA-256 hex digest. Used for high-entropy secrets only (session, reset, recovery tokens). */
export const sha256 = (value: string): string => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

/** Keyed hash (HMAC-SHA-256, truncated) for IP addresses and e-mail addresses in logs/audit. */
export const keyedHash = (key: Buffer, value: string): string =>
  crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex').slice(0, 32);

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Encrypt a secret at rest with AES-256-GCM. Output: `v1.<keyId>.<iv>.<tag>.<ciphertext>`
 * (base64url parts). The key id allows key rotation: old values stay decryptable.
 */
export function encryptSecret(plaintext: string, keys: Map<string, Buffer>, keyId: string, context: string): string {
  const key = keys.get(keyId);
  if (!key) throw new Error(`encryption key "${keyId}" is not configured`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', keyId, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptSecret(value: string, keys: Map<string, Buffer>, context: string): string {
  const [v, keyId, iv, tag, ct] = value.split('.');
  if (v !== 'v1' || !keyId || !iv || !tag || ct === undefined) throw new Error('unsupported encrypted value');
  const key = keys.get(keyId);
  if (!key) throw new Error(`encryption key "${keyId}" is not configured`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}
