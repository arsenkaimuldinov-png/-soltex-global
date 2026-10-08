/**
 * Second factors of a user and whether they satisfy the role's MFA requirement (approved §7).
 */
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm';
import { mfaRequirement, type MfaRequirement, type Role } from '@soltex/core/domain';
import type { Queryable } from '../db/client.ts';
import { recoveryCodes, totpCredentials, webauthnCredentials } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';

export interface FactorState {
  passkeys: number;
  totp: boolean;
  recoveryCodesLeft: number;
  /** At least one second factor is enrolled. */
  enrolled: boolean;
  requirement: MfaRequirement;
  /** The role's requirement is met (a passkey for Owner/Admin, any factor for MFA roles). */
  requirementMet: boolean;
}

export async function factorState(deps: Deps, user: { id: string; role: Role }, db: Queryable = requireDb(deps)): Promise<FactorState> {
  const [[pk], [totp], [rc]] = await Promise.all([
    db.select({ n: count() }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id)),
    db
      .select({ n: count() })
      .from(totpCredentials)
      .where(and(eq(totpCredentials.userId, user.id), isNotNull(totpCredentials.confirmedAt))),
    db
      .select({ n: count() })
      .from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, user.id), isNull(recoveryCodes.usedAt))),
  ]);
  const passkeys = Number(pk?.n ?? 0);
  const hasTotp = Number(totp?.n ?? 0) > 0;
  const enrolled = passkeys > 0 || hasTotp;
  const requirement = mfaRequirement(user.role, { mfaForAllRoles: deps.config.mfaForAllRoles });
  const requirementMet = requirement === 'none' || (requirement === 'passkey' ? passkeys > 0 : enrolled);
  return { passkeys, totp: hasTotp, recoveryCodesLeft: Number(rc?.n ?? 0), enrolled, requirement, requirementMet };
}
