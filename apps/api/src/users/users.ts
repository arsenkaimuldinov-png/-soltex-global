/**
 * User management (approved §7, §8). Every change goes through `canManageUser` from
 * @soltex/core/domain (only Owners act on Owners; nobody changes their own role, status or MFA
 * through user management) and is audited. Role and status changes revoke the user's sessions.
 */
import { asc, eq } from 'drizzle-orm';
import { canManageUser, type Role, type UserChange } from '@soltex/core/domain';
import type { Queryable } from '../db/client.ts';
import { recoveryCodes, totpCredentials, users, webauthnCredentials } from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import { normaliseEmail } from '../auth/login.ts';
import { checkPasswordPolicy, hashPassword } from '../auth/passwords.ts';
import { revokeUserSessions, type UserRow } from '../auth/sessions.ts';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt: string;
}

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  status: u.status,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

function assertAllowed(actor: UserRow, target: UserRow | null, change: UserChange, newRole?: Role | null) {
  if (!canManageUser({ actorRole: actor.role, actorId: actor.id, targetId: target?.id ?? null, targetRole: target?.role ?? null, newRole, change }))
    throw new Problem('forbidden');
}

export async function listUsers(deps: Deps): Promise<PublicUser[]> {
  const rows = await requireDb(deps).select().from(users).orderBy(asc(users.createdAt));
  return rows.map(toPublicUser);
}

async function getUser(deps: Deps, id: string): Promise<UserRow> {
  const [u] = await requireDb(deps).select().from(users).where(eq(users.id, id));
  if (!u) throw new Problem('not_found');
  return u;
}

/** Insert a user (no permission checks: used by the bootstrap CLI and by createUser). */
export async function insertUser(
  deps: Deps,
  input: { email: string; name: string; role: Role; password: string; createdBy: string | null },
  db: Queryable = requireDb(deps)
): Promise<UserRow> {
  const email = normaliseEmail(input.email);
  const problems = checkPasswordPolicy(input.password, email);
  if (problems.length) throw new Problem('password_rejected', undefined, { errors: problems.map((p) => ({ field: 'password', message: p })) });
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) throw new Problem('conflict', 'Пользователь с таким e-mail уже существует');
  const now = deps.now();
  const [row] = await db
    .insert(users)
    .values({
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    })
    .returning();
  return row!;
}

export async function createUser(
  deps: Deps,
  actor: UserRow,
  input: { email: string; name: string; role: Role; password: string },
  client: ClientInfo
): Promise<PublicUser> {
  assertAllowed(actor, null, 'create', input.role);
  const user = await insertUser(deps, { ...input, createdBy: actor.id });
  await recordAudit(deps, client, { action: 'user.create', result: 'success', actorId: actor.id, resourceType: 'user', resourceId: user.id, summary: { role: user.role } });
  return toPublicUser(user);
}

/**
 * Field-level update: `name`, `role`, `status`. Each changed field is authorised separately;
 * role/status changes revoke the target's sessions (privilege change).
 */
export async function updateUser(
  deps: Deps,
  actor: UserRow,
  id: string,
  patch: { name?: string; role?: Role; status?: 'active' | 'disabled' },
  client: ClientInfo
): Promise<PublicUser> {
  const target = await getUser(deps, id);
  const fields = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (!fields.length) throw new Problem('bad_request', 'Нет изменений');
  if (patch.name !== undefined) assertAllowed(actor, target, 'update_profile');
  if (patch.role !== undefined && patch.role !== target.role) assertAllowed(actor, target, 'change_role', patch.role);
  if (patch.status !== undefined && patch.status !== target.status) assertAllowed(actor, target, 'change_status');
  const privilegeChange = (patch.role !== undefined && patch.role !== target.role) || (patch.status !== undefined && patch.status !== target.status);
  const db = requireDb(deps);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        version: target.version + 1,
        updatedAt: deps.now(),
        updatedBy: actor.id,
      })
      .where(eq(users.id, id))
      .returning();
    const revoked = privilegeChange ? await revokeUserSessions(deps, id, 'privilege_change', {}, tx) : 0;
    await recordAudit(
      deps,
      client,
      {
        action: 'user.update',
        result: 'success',
        actorId: actor.id,
        resourceType: 'user',
        resourceId: id,
        summary: {
          fields,
          ...(patch.role !== undefined && patch.role !== target.role ? { previous_role: target.role, new_role: patch.role } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          revoked: String(revoked),
        },
      },
      tx
    );
    return row!;
  });
  return toPublicUser(updated);
}

/** Lost device (approved §7): remove every second factor and recovery code, revoke all sessions. */
export async function resetUserMfa(deps: Deps, actor: UserRow, id: string, client: ClientInfo): Promise<void> {
  const target = await getUser(deps, id);
  assertAllowed(actor, target, 'reset_mfa');
  await requireDb(deps).transaction(async (tx) => {
    await tx.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, id));
    await tx.delete(totpCredentials).where(eq(totpCredentials.userId, id));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
    const revoked = await revokeUserSessions(deps, id, 'mfa_reset', {}, tx);
    await recordAudit(deps, client, { action: 'user.mfa_reset', result: 'success', actorId: actor.id, resourceType: 'user', resourceId: id, summary: { revoked: String(revoked) } }, tx);
  });
  await deps.notifier.securityAlert(target, 'mfa_reset_by_admin');
}

export async function revokeSessionsOf(deps: Deps, actor: UserRow, id: string, client: ClientInfo): Promise<number> {
  const target = await getUser(deps, id);
  assertAllowed(actor, target, 'revoke_sessions');
  const n = await revokeUserSessions(deps, id, 'revoked_by_admin');
  await recordAudit(deps, client, { action: 'user.sessions_revoke', result: 'success', actorId: actor.id, resourceType: 'user', resourceId: id, summary: { revoked: String(n) } });
  return n;
}
