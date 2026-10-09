/**
 * Preview access (Phase G, docs/admin-publishing.md §7; approved §9).
 *
 *  1. An admin user (content.read) asks for a preview of a built release or preview build.
 *     The API returns `${PREVIEW_ORIGIN}/__preview#t=<token>`: an opaque 256-bit random token,
 *     stored only as SHA-256, valid 30 minutes, usable ONCE, bound to the user and to the admin
 *     session that asked for it. The token is in the URL fragment, which browsers never send to a
 *     server, so it appears in no request line and no access log.
 *  2. The preview server exchanges it (POST, custom header) for an HttpOnly, SameSite=Strict
 *     cookie whose value is again stored only as a hash.
 *  3. Every preview request re-checks: grant not revoked / expired, admin session still valid,
 *     user active, release artifact present. Logging out (session revoked) ends the preview.
 *  «Закрыть предпросмотр» revokes every preview grant of the user.
 */
import crypto from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import * as s from '../db/schema.ts';
import type { Queryable } from '../db/client.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import type { SessionRow, UserRow } from '../auth/sessions.ts';
import { IDLE_TIMEOUT_MS } from '../auth/sessions.ts';
import { RELEASE_WITH_ARTIFACT } from '@soltex/core/domain';

export const PREVIEW_TTL_MS = 30 * 60_000;

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

export async function createPreviewGrant(deps: Deps, user: UserRow, session: SessionRow, releaseId: string, path: string, client: ClientInfo) {
  const db = requireDb(deps);
  const [r] = await db.select().from(s.releases).where(eq(s.releases.id, releaseId));
  if (!r) throw new Problem('not_found');
  if (!(RELEASE_WITH_ARTIFACT as readonly string[]).includes(r.status) || !r.artifactSha256)
    throw new Problem('invalid_transition', 'Предпросмотр доступен после успешной сборки.');
  const token = randomToken();
  const now = deps.now();
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  await db.insert(s.previewGrants).values({ releaseId, userId: user.id, sessionId: session.id, tokenHash: sha256(token), createdAt: now, expiresAt });
  await recordAudit(deps, client, { action: 'preview.grant', result: 'success', actorId: user.id, resourceType: 'release', resourceId: releaseId, summary: { target: r.key } });
  const safePath = /^\/[a-z0-9/_-]*$/i.test(path) ? path : '/';
  return { url: `${deps.config.publishing.previewOrigin}/__preview#t=${token}&p=${encodeURIComponent(safePath)}`, expiresAt: expiresAt.toISOString() };
}

export async function revokePreviewGrants(deps: Deps, user: UserRow, client: ClientInfo): Promise<number> {
  const db = requireDb(deps);
  const rows = await db
    .update(s.previewGrants)
    .set({ revokedAt: deps.now() })
    .where(and(eq(s.previewGrants.userId, user.id), isNull(s.previewGrants.revokedAt), gt(s.previewGrants.expiresAt, deps.now())))
    .returning({ id: s.previewGrants.id });
  await recordAudit(deps, client, { action: 'preview.revoke', result: 'success', actorId: user.id, resourceType: 'user', resourceId: user.id, summary: { count: rows.length } });
  return rows.length;
}

/** Conditions shared by token exchange and every preview request (all evaluated in SQL). */
const validGrant = (now: Date) => sql`
  g.revoked_at IS NULL AND g.expires_at > ${now}
  AND ses.revoked_at IS NULL AND ses.expires_at > ${now} AND ses.last_seen_at > ${new Date(now.getTime() - IDLE_TIMEOUT_MS)}
  AND u.status = 'active'
  AND r.artifact_sha256 IS NOT NULL AND r.status IN ('ready', 'active', 'retired')`;

/** One-time exchange of a token for a cookie; returns the cookie value and its lifetime, or null. */
export async function exchangePreviewToken(db: Queryable, token: string, now: Date): Promise<{ cookie: string; maxAgeSeconds: number } | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const cookie = randomToken();
  const { rows } = await db.execute(sql`
    UPDATE preview_grants SET consumed_at = ${now}, cookie_hash = ${sha256(cookie)}
    WHERE id = (
      SELECT g.id FROM preview_grants g JOIN sessions ses ON ses.id = g.session_id JOIN users u ON u.id = g.user_id JOIN releases r ON r.id = g.release_id
      WHERE g.token_hash = ${sha256(token)} AND g.consumed_at IS NULL AND ${validGrant(now)}
    ) AND consumed_at IS NULL
    RETURNING expires_at`);
  const row = rows[0] as { expires_at: string | Date } | undefined;
  if (!row) return null;
  return { cookie, maxAgeSeconds: Math.max(1, Math.floor((new Date(row.expires_at).getTime() - now.getTime()) / 1000)) };
}

/** The release key a preview cookie may read, or null. */
export async function previewTarget(db: Queryable, cookie: string, now: Date): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(cookie)) return null;
  const { rows } = await db.execute(sql`
    SELECT r.key FROM preview_grants g JOIN sessions ses ON ses.id = g.session_id JOIN users u ON u.id = g.user_id JOIN releases r ON r.id = g.release_id
    WHERE g.cookie_hash = ${sha256(cookie)} AND ${validGrant(now)}`);
  return (rows[0] as { key: string } | undefined)?.key ?? null;
}

export async function revokeByCookie(db: Queryable, cookie: string, now: Date) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(cookie)) return;
  await db.update(s.previewGrants).set({ revokedAt: now }).where(and(eq(s.previewGrants.cookieHash, sha256(cookie)), isNull(s.previewGrants.revokedAt)));
}
