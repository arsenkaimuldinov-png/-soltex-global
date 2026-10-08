/**
 * Password change and password reset (approved §7).
 *  - Change: needs the current password; the new password must pass the policy; every other
 *    session of the user is revoked and the current session token is rotated.
 *  - Reset: request always answers the same (no enumeration); the token is 256 random bits,
 *    single use, valid 30 minutes, stored as SHA-256 only and delivered by the notifier
 *    (e-mail from Phase K). Confirming revokes all sessions and does NOT sign the user in, so a
 *    reset can never bypass the second factor.
 */
import { and, eq, gt, isNull } from 'drizzle-orm';
import { passwordResets, users } from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import { keyedHash, randomToken, sha256 } from './crypto.ts';
import { normaliseEmail } from './login.ts';
import { checkPasswordPolicy, hashPassword, verifyPassword } from './passwords.ts';
import { revokeUserSessions } from './sessions.ts';

export const RESET_TTL_MS = 30 * 60 * 1000;

const policyProblem = (problems: string[]) =>
  new Problem('password_rejected', undefined, { errors: problems.map((p) => ({ field: 'newPassword', message: p })) });

export async function changePassword(
  deps: Deps,
  input: { userId: string; currentPassword: string; newPassword: string; keepSessionId: string; client: ClientInfo }
): Promise<{ revoked: number }> {
  const db = requireDb(deps);
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    await recordAudit(deps, input.client, { action: 'auth.password.change', result: 'failure', actorId: input.userId, summary: { reason: 'wrong_password' } });
    throw new Problem('invalid_credentials', 'Текущий пароль указан неверно');
  }
  const problems = checkPasswordPolicy(input.newPassword, user.email);
  if (problems.length) throw policyProblem(problems);
  const passwordHash = await hashPassword(input.newPassword);
  const revoked = await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: deps.now(), updatedAt: deps.now(), updatedBy: user.id }).where(eq(users.id, user.id));
    const n = await revokeUserSessions(deps, user.id, 'password_changed', { except: input.keepSessionId }, tx);
    await recordAudit(deps, input.client, { action: 'auth.password.change', result: 'success', actorId: user.id, summary: { revoked: String(n) } }, tx);
    return n;
  });
  await deps.notifier.securityAlert(user, 'password_changed');
  return { revoked };
}

export async function requestPasswordReset(deps: Deps, email: string, client: ClientInfo): Promise<void> {
  const db = requireDb(deps);
  const normalised = normaliseEmail(email);
  const [user] = await db.select().from(users).where(eq(users.email, normalised));
  if (!user || user.status !== 'active') {
    await recordAudit(deps, client, {
      action: 'auth.password_reset.request',
      result: 'failure',
      summary: { reason: user ? 'disabled' : 'unknown_account', email_hash: keyedHash(deps.config.hashSecret, normalised) },
    });
    return;
  }
  const token = randomToken(32);
  const now = deps.now();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
  await db.transaction(async (tx) => {
    // Only the newest link works.
    await tx.update(passwordResets).set({ usedAt: now }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await tx.insert(passwordResets).values({ tokenHash: sha256(token), userId: user.id, createdAt: now, expiresAt });
    await recordAudit(deps, client, { action: 'auth.password_reset.request', result: 'success', actorId: user.id }, tx);
  });
  await deps.notifier.passwordReset(user, token, expiresAt);
}

export async function confirmPasswordReset(deps: Deps, token: string, newPassword: string, client: ClientInfo): Promise<void> {
  const db = requireDb(deps);
  const now = deps.now();
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)));
  if (!reset) {
    await recordAudit(deps, client, { action: 'auth.password_reset.confirm', result: 'failure', summary: { reason: 'invalid_token' } });
    throw new Problem('bad_request', 'Ссылка для сброса пароля недействительна или устарела');
  }
  const [user] = await db.select().from(users).where(eq(users.id, reset.userId));
  if (!user || user.status !== 'active') throw new Problem('bad_request', 'Ссылка для сброса пароля недействительна или устарела');
  const problems = checkPasswordPolicy(newPassword, user.email);
  if (problems.length) throw policyProblem(problems);
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const used = await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(and(eq(passwordResets.tokenHash, reset.tokenHash), isNull(passwordResets.usedAt)))
      .returning({ t: passwordResets.tokenHash });
    if (!used.length) throw new Problem('bad_request', 'Ссылка для сброса пароля недействительна или устарела');
    await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: now, failedLogins: 0, lastFailedLoginAt: null, lockedUntil: null, updatedAt: now })
      .where(eq(users.id, user.id));
    const n = await revokeUserSessions(deps, user.id, 'password_reset', {}, tx);
    await recordAudit(deps, client, { action: 'auth.password_reset.confirm', result: 'success', actorId: user.id, summary: { revoked: String(n) } }, tx);
  });
  await deps.notifier.securityAlert(user, 'password_reset');
}
