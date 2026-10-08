/**
 * Password hashing and policy (approved §7).
 *  - Argon2id (@node-rs/argon2) with OWASP parameters (m = 19 MiB, t = 2, p = 1).
 *  - Minimum 12, maximum 256 characters; rejected if it is a common password or contains the
 *    account e-mail's local part.
 *  - Plaintext passwords are never stored, logged, audited or returned.
 */
import fs from 'node:fs';
import { hash, verify, type Algorithm } from '@node-rs/argon2';

/** Algorithm 2 = Argon2id (the package exports it as an ambient const enum). */
const ARGON2ID = 2 as Algorithm;
const ARGON2_OPTIONS = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

let common: Set<string> | undefined;
function commonPasswords(): Set<string> {
  common ??= new Set(
    fs
      .readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
  );
  return common;
}

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common' | 'contains_email';

/** Validate a new password. Returns the reasons it is refused (empty = accepted). */
export function checkPasswordPolicy(password: string, email?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  const length = [...password].length;
  if (length < PASSWORD_MIN) problems.push('too_short');
  if (length > PASSWORD_MAX) problems.push('too_long');
  const lower = password.toLowerCase();
  if (commonPasswords().has(lower)) problems.push('too_common');
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) problems.push('contains_email');
  return problems;
}

export const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  try {
    return await verify(phc, password);
  } catch {
    return false;
  }
}

/**
 * A real Argon2id hash of a random value, verified when the account does not exist, so that
 * unknown and known e-mails take the same time (no user enumeration through timing).
 */
let dummy: Promise<string> | undefined;
export const dummyHash = (): Promise<string> => (dummy ??= hash(crypto.randomUUID(), ARGON2_OPTIONS));
