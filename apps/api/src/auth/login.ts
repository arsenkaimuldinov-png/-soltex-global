/**
 * Password login with brute-force protection (approved §7, §19).
 *
 *  - Same error and the same Argon2 work for unknown, disabled and wrong-password accounts.
 *  - Per account: after 5 consecutive failures each further attempt must wait
 *    2^(n-5) seconds (max 5 min) since the last failure; after 20 the account is locked for
 *    15 minutes for browsers that never completed a login (known devices keep working, so an
 *    attacker cannot lock the real user out). Per IP: route rate limit.
 *  - Success creates a session: assurance 1; if the user has a second factor, it must be
 *    verified within 10 minutes before anything else works.
 */
import { and, eq, gt } from 'drizzle-orm';
import { knownDevices, users } from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import { keyedHash, randomToken, sha256 } from './crypto.ts';
import { factorState, type FactorState } from './factors.ts';
import { dummyHash, verifyPassword } from './passwords.ts';
import { createSession, type IssuedSession, type UserRow } from './sessions.ts';

export const DELAY_AFTER_FAILURES = 5;
export const LOCK_AFTER_FAILURES = 20;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
export const MAX_DELAY_S = 300;
export const KNOWN_DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export type LoginNext = 'authenticated' | 'mfa_required' | 'mfa_enrollment_required';

export interface LoginResult {
  issued: IssuedSession;
  user: UserRow;
  factors: FactorState;
  next: LoginNext;
}

export function nextStep(factors: FactorState, aal: number): LoginNext {
  if (factors.enrolled && aal < 2) return 'mfa_required';
  if (!factors.requirementMet) return 'mfa_enrollment_required';
  return 'authenticated';
}

async function isKnownDevice(deps: Deps, userId: string, deviceToken: string | undefined): Promise<boolean> {
  if (!deviceToken || deviceToken.length > 100) return false;
  const [row] = await requireDb(deps)
    .select({ userId: knownDevices.userId })
    .from(knownDevices)
    .where(and(eq(knownDevices.tokenHash, sha256(deviceToken)), eq(knownDevices.userId, userId), gt(knownDevices.expiresAt, deps.now())));
  return !!row;
}

/** Remember this browser for `userId` after a full login. Returns a new device token if one was issued. */
export async function rememberDevice(deps: Deps, userId: string, current: string | undefined): Promise<string | null> {
  if (await isKnownDevice(deps, userId, current)) return null;
  const token = randomToken(32);
  const now = deps.now();
  await requireDb(deps)
    .insert(knownDevices)
    .values({ tokenHash: sha256(token), userId, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + KNOWN_DEVICE_TTL_MS) });
  return token;
}

export function throttleDelaySeconds(failedLogins: number): number {
  return failedLogins < DELAY_AFTER_FAILURES ? 0 : Math.min(2 ** (failedLogins - DELAY_AFTER_FAILURES), MAX_DELAY_S);
}

export async function loginWithPassword(
  deps: Deps,
  input: { email: string; password: string; deviceToken: string | undefined; client: ClientInfo }
): Promise<LoginResult> {
  const db = requireDb(deps);
  const now = deps.now();
  const email = normaliseEmail(input.email);
  const emailHash = keyedHash(deps.config.hashSecret, email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const fail = async (reason: string, actorId: string | null = null) => {
    await recordAudit(deps, input.client, { action: 'auth.login', result: 'failure', actorId, summary: { reason, email_hash: emailHash } });
    return new Problem('invalid_credentials');
  };

  if (!user || user.status !== 'active') {
    await verifyPassword(await dummyHash(), input.password);
    throw await fail(user ? 'disabled' : 'unknown_account', user?.id ?? null);
  }

  const known = await isKnownDevice(deps, user.id, input.deviceToken);
  if (!known && user.lockedUntil && user.lockedUntil > now) {
    await recordAudit(deps, input.client, { action: 'auth.login', result: 'denied', actorId: user.id, summary: { reason: 'locked' } });
    throw new Problem('login_throttled', undefined, { retryAfterSeconds: (user.lockedUntil.getTime() - now.getTime()) / 1000 });
  }
  const delay = throttleDelaySeconds(user.failedLogins);
  if (delay && user.lastFailedLoginAt && now.getTime() < user.lastFailedLoginAt.getTime() + delay * 1000) {
    await recordAudit(deps, input.client, { action: 'auth.login', result: 'denied', actorId: user.id, summary: { reason: 'throttled' } });
    throw new Problem('login_throttled', undefined, {
      retryAfterSeconds: (user.lastFailedLoginAt.getTime() + delay * 1000 - now.getTime()) / 1000,
    });
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failures = user.failedLogins + 1;
    const lock = failures >= LOCK_AFTER_FAILURES;
    await db
      .update(users)
      .set({ failedLogins: failures, lastFailedLoginAt: now, ...(lock ? { lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) } : {}) })
      .where(eq(users.id, user.id));
    if (lock && failures === LOCK_AFTER_FAILURES) {
      await recordAudit(deps, input.client, { action: 'auth.lockout', result: 'success', actorId: user.id, summary: { count: failures } });
      await deps.notifier.securityAlert(user, 'account_locked');
    }
    throw await fail('wrong_password', user.id);
  }

  await db.update(users).set({ failedLogins: 0, lastFailedLoginAt: null, lockedUntil: null, lastLoginAt: now }).where(eq(users.id, user.id));
  const factors = await factorState(deps, user);
  const issued = await createSession(deps, user.id, { aal: 1, pendingMfa: factors.enrolled, client: input.client });
  const next = nextStep(factors, 1);
  await recordAudit(deps, input.client, {
    action: 'auth.login',
    result: 'success',
    actorId: user.id,
    resourceType: 'session',
    resourceId: issued.session.id,
    summary: { method: 'password', status: next },
  });
  return { issued, user, factors, next };
}
