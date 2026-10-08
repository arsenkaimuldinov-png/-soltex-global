/**
 * Recovery codes (approved §7): 10 one-time codes of 128 random bits each, shown once,
 * stored only as SHA-256. Regenerating revokes all previous codes. Format: 4 groups of 8
 * hexadecimal characters (case-insensitive, dashes and spaces ignored on input).
 */
import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Queryable } from '../db/client.ts';
import { recoveryCodes } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { sha256 } from './crypto.ts';

export const RECOVERY_CODE_COUNT = 10;

const normalise = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();
const format = (hex: string) => hex.toUpperCase().match(/.{8}/g)!.join('-');

/** Replace the user's recovery codes. Returns the plaintext codes (to be shown once). */
export async function regenerateRecoveryCodes(deps: Deps, userId: string, db: Queryable = requireDb(deps)): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => format(crypto.randomBytes(16).toString('hex')));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await db.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(normalise(c)), createdAt: deps.now() })));
  return codes;
}

/** Consume a recovery code. true only once per code. */
export async function consumeRecoveryCode(deps: Deps, userId: string, code: string): Promise<boolean> {
  const n = normalise(code);
  if (!/^[0-9A-F]{32}$/.test(n)) return false;
  const r = await requireDb(deps)
    .update(recoveryCodes)
    .set({ usedAt: deps.now() })
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, sha256(n)), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  return r.length === 1;
}
