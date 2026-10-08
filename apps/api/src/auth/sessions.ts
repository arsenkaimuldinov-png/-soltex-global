/**
 * Server-side sessions (approved §7).
 *  - The cookie holds a 256-bit random opaque token; the database stores only its SHA-256.
 *  - Assurance level 1 = password only, 2 = password + second factor.
 *  - Timeouts: idle 8 h, absolute 7 days; a password-only session of a user who has a second
 *    factor lives at most 10 minutes (it can only complete the second factor).
 *  - The token is rotated on login, on every second-factor verification and on privilege change.
 */
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { Queryable } from '../db/client.ts';
import { sessions, users } from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { randomToken, sha256 } from './crypto.ts';

export const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
export const PENDING_MFA_TIMEOUT_MS = 10 * 60 * 1000;
export const STEP_UP_WINDOW_MS = 10 * 60 * 1000;
export const MAX_MFA_FAILURES = 5;
/** last_seen_at is written at most once a minute per session. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export type SessionRow = typeof sessions.$inferSelect;
export type UserRow = typeof users.$inferSelect;

export interface IssuedSession {
  token: string;
  session: SessionRow;
}

export async function createSession(
  deps: Deps,
  userId: string,
  opts: { aal: 1 | 2; pendingMfa: boolean; client: ClientInfo },
  db: Queryable = requireDb(deps)
): Promise<IssuedSession> {
  const now = deps.now();
  const token = randomToken(32);
  const [session] = await db
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      userId,
      aal: opts.aal,
      mfaVerifiedAt: opts.aal === 2 ? now : null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + (opts.pendingMfa ? PENDING_MFA_TIMEOUT_MS : ABSOLUTE_TIMEOUT_MS)),
      ipHash: opts.client.ipHash,
      userAgent: opts.client.userAgent,
    })
    .returning();
  return { token, session: session! };
}

/** Resolve a cookie token to a live session and its active user, or null. */
export async function loadSession(deps: Deps, token: string | undefined): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!token || token.length > 100) return null;
  const db = requireDb(deps);
  const now = deps.now();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt)))
    .limit(1);
  if (!row) return null;
  const { session, user } = row;
  if (session.expiresAt <= now) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS) return null;
  if (user.status !== 'active') return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, session.id));
    session.lastSeenAt = now;
  }
  return { session, user };
}

/**
 * A second factor was verified: assurance 2, step-up window restarts, and the token is
 * rotated (the old token stops working immediately).
 */
export async function completeSecondFactor(deps: Deps, session: SessionRow, db: Queryable = requireDb(deps)): Promise<IssuedSession> {
  const now = deps.now();
  const token = randomToken(32);
  const [updated] = await db
    .update(sessions)
    .set({
      tokenHash: sha256(token),
      aal: 2,
      mfaVerifiedAt: now,
      mfaFailures: 0,
      expiresAt: new Date(session.createdAt.getTime() + ABSOLUTE_TIMEOUT_MS),
      lastSeenAt: now,
    })
    .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)))
    .returning();
  if (!updated) throw new Error('session disappeared');
  return { token, session: updated };
}

/** Rotate the token without changing the assurance (e.g. after a password change). */
export async function rotateSession(deps: Deps, session: SessionRow, db: Queryable = requireDb(deps)): Promise<IssuedSession> {
  const token = randomToken(32);
  const [updated] = await db.update(sessions).set({ tokenHash: sha256(token) }).where(eq(sessions.id, session.id)).returning();
  return { token, session: updated! };
}

/** Count a failed second-factor attempt; after MAX_MFA_FAILURES the session is revoked. */
export async function recordMfaFailure(deps: Deps, session: SessionRow, db: Queryable = requireDb(deps)): Promise<{ revoked: boolean }> {
  const failures = session.mfaFailures + 1;
  const revoked = failures >= MAX_MFA_FAILURES;
  await db
    .update(sessions)
    .set({ mfaFailures: failures, ...(revoked ? { revokedAt: deps.now(), revokedReason: 'mfa_failures' } : {}) })
    .where(eq(sessions.id, session.id));
  return { revoked };
}

export async function revokeSession(deps: Deps, sessionId: string, reason: string, db: Queryable = requireDb(deps)): Promise<boolean> {
  const r = await db
    .update(sessions)
    .set({ revokedAt: deps.now(), revokedReason: reason })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return r.length > 0;
}

/** Revoke every live session of a user (optionally keeping one). Returns how many. */
export async function revokeUserSessions(
  deps: Deps,
  userId: string,
  reason: string,
  opts: { except?: string } = {},
  db: Queryable = requireDb(deps)
): Promise<number> {
  const r = await db
    .update(sessions)
    .set({ revokedAt: deps.now(), revokedReason: reason })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), opts.except ? ne(sessions.id, opts.except) : undefined))
    .returning({ id: sessions.id });
  return r.length;
}

export function stepUpValidUntil(session: SessionRow): Date | null {
  return session.aal === 2 && session.mfaVerifiedAt ? new Date(session.mfaVerifiedAt.getTime() + STEP_UP_WINDOW_MS) : null;
}
