/**
 * First Owner account (approved §8.4): created only from the server console, never by the API,
 * never with a default password. Safe to run again: it refuses when an active Owner exists.
 * The Owner then signs in and must enroll a passkey (Owner MFA requirement) before anything else.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.ts';
import { users } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { insertUser } from './users.ts';
import type { UserRow } from '../auth/sessions.ts';

export type BootstrapResult = { status: 'created'; user: UserRow } | { status: 'owner_exists' };

export async function bootstrapOwner(
  deps: Deps,
  input: { email: string; name: string; password: string },
  db: Queryable = requireDb(deps)
): Promise<BootstrapResult> {
  return db.transaction(async (tx) => {
    // Two consoles running the command at once cannot both create an Owner.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('soltex.auth.bootstrap_owner'))`);
    const [existing] = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, 'owner'), eq(users.status, 'active'))).limit(1);
    if (existing) return { status: 'owner_exists' } as const;
    const user = await insertUser(deps, { ...input, role: 'owner', createdBy: null }, tx);
    await recordAudit(deps, null, { action: 'user.bootstrap_owner', result: 'success', actorId: null, resourceType: 'user', resourceId: user.id, summary: { method: 'cli', role: 'owner' } }, tx);
    return { status: 'created', user } as const;
  });
}
