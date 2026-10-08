/**
 * TOTP (RFC 6238) fallback factor via otplib (SHA-1, 6 digits, 30 s — authenticator-app
 * defaults). The secret is encrypted at rest (AES-256-GCM, crypto.ts) and never logged.
 * A code is accepted at most once (the last accepted time step is stored), ±1 step tolerance.
 */
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { generateSecret, generateURI, verify } from 'otplib';
import { totpCredentials } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';

const ISSUER = 'Soltex Global';
const context = (userId: string) => `totp:${userId}`;

export async function startTotpEnrollment(deps: Deps, user: { id: string; email: string }): Promise<{ secret: string; uri: string } | 'already_enrolled'> {
  const db = requireDb(deps);
  const [existing] = await db.select().from(totpCredentials).where(eq(totpCredentials.userId, user.id));
  if (existing?.confirmedAt) return 'already_enrolled';
  const secret = generateSecret();
  const { keys, currentKeyId } = deps.config.encryption;
  const secretEncrypted = encryptSecret(secret, keys, currentKeyId, context(user.id));
  await db
    .insert(totpCredentials)
    .values({ userId: user.id, secretEncrypted, confirmedAt: null, lastTimeStep: null, createdAt: deps.now() })
    .onConflictDoUpdate({ target: totpCredentials.userId, set: { secretEncrypted, createdAt: deps.now(), lastTimeStep: null } });
  return { secret, uri: generateURI({ issuer: ISSUER, label: user.email, secret }) };
}

/**
 * Verify a code against the user's secret. `pending` checks the not-yet-confirmed secret
 * (enrollment) and confirms it on success. Accepted time steps can never be reused.
 */
export async function verifyTotp(deps: Deps, userId: string, code: string, opts: { pending?: boolean } = {}): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const db = requireDb(deps);
  const [cred] = await db
    .select()
    .from(totpCredentials)
    .where(and(eq(totpCredentials.userId, userId), opts.pending ? isNull(totpCredentials.confirmedAt) : isNotNull(totpCredentials.confirmedAt)));
  if (!cred) return false;
  const secret = decryptSecret(cred.secretEncrypted, deps.config.encryption.keys, context(userId));
  const result = await verify({
    secret,
    token: code,
    epoch: Math.floor(deps.now().getTime() / 1000),
    epochTolerance: 30,
    ...(cred.lastTimeStep !== null ? { afterTimeStep: cred.lastTimeStep } : {}),
  });
  if (!result.valid || !('timeStep' in result) || typeof result.timeStep !== 'number') return false;
  const timeStep = result.timeStep;
  // Atomic replay guard: only one request can move last_time_step past this step.
  const updated = await db
    .update(totpCredentials)
    .set({ lastTimeStep: timeStep, ...(opts.pending ? { confirmedAt: deps.now() } : {}) })
    .where(
      and(
        eq(totpCredentials.userId, userId),
        or(isNull(totpCredentials.lastTimeStep), lt(totpCredentials.lastTimeStep, timeStep))
      )
    )
    .returning({ userId: totpCredentials.userId });
  return updated.length === 1;
}

export async function disableTotp(deps: Deps, userId: string): Promise<boolean> {
  const r = await requireDb(deps).delete(totpCredentials).where(eq(totpCredentials.userId, userId)).returning({ userId: totpCredentials.userId });
  return r.length > 0;
}
