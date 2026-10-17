/**
 * Hourly cleanup of expired service rows (Phase N-0, docs/admin-database.md §cleanup).
 *
 * Only rows that can never be used again are deleted, after a grace period that keeps them
 * available for a security investigation:
 *   webauthn_challenges  expired more than 1 day ago (they live for minutes)
 *   password_resets      expired more than 30 days ago
 *   known_devices        expired (a device that is no longer "known" changes nothing)
 *   sessions             ended (expired or revoked) more than 30 days ago — except sessions that
 *                        opened a preview: preview_grants are kept as a record and reference them
 *   outbox               sent more than 30 days ago (the audit log keeps the fact of sending)
 * Append-only history (audit_events, content_revisions, releases, preview_grants, lead_events)
 * is never touched here.
 */
import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import * as s from '../db/schema.ts';
import { requireDb, type Deps } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';

export const CLEANUP_GRACE_DAYS = 30;
const DAY = 86_400_000;

export interface CleanupResult {
  challenges: number;
  passwordResets: number;
  knownDevices: number;
  sessions: number;
  outbox: number;
}

export async function cleanupExpired(deps: Deps): Promise<CleanupResult> {
  const db = requireDb(deps);
  const now = deps.now();
  const grace = new Date(now.getTime() - CLEANUP_GRACE_DAYS * DAY);
  const dayAgo = new Date(now.getTime() - DAY);
  return db.transaction(async (tx) => {
    const challenges = await tx.delete(s.webauthnChallenges).where(lt(s.webauthnChallenges.expiresAt, dayAgo)).returning({ id: s.webauthnChallenges.id });
    const passwordResets = await tx.delete(s.passwordResets).where(lt(s.passwordResets.expiresAt, grace)).returning({ k: s.passwordResets.tokenHash });
    const knownDevices = await tx.delete(s.knownDevices).where(lt(s.knownDevices.expiresAt, now)).returning({ k: s.knownDevices.tokenHash });
    const sessions = await tx
      .delete(s.sessions)
      .where(
        and(
          or(lt(s.sessions.expiresAt, grace), and(isNotNull(s.sessions.revokedAt), lt(s.sessions.revokedAt, grace))),
          sql`NOT EXISTS (SELECT 1 FROM ${s.previewGrants} WHERE ${s.previewGrants.sessionId} = ${s.sessions.id})`
        )
      )
      .returning({ id: s.sessions.id });
    const outbox = await tx.delete(s.outbox).where(and(isNotNull(s.outbox.sentAt), lt(s.outbox.sentAt, grace))).returning({ id: s.outbox.id });
    const result: CleanupResult = {
      challenges: challenges.length,
      passwordResets: passwordResets.length,
      knownDevices: knownDevices.length,
      sessions: sessions.length,
      outbox: outbox.length,
    };
    const total = Object.values(result).reduce((a, n) => a + n, 0);
    if (total > 0) {
      const kind = Object.entries(result)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}=${n}`)
        .join(' ');
      await recordAudit(deps, null, { action: 'system.cleanup', result: 'success', resourceType: 'system', summary: { count: total, kind } }, tx);
    }
    return result;
  });
}
