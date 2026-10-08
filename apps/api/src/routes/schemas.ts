/** Zod schemas shared by the Phase C routes (request validation and OpenAPI 3.1). */
import { z } from 'zod';
import { PERMISSIONS, ROLES } from '@soltex/core/domain';
import { ProblemSchema } from '../http/problem.ts';

export const Email = z.string().trim().min(3).max(254).email();
/** Accepted as typed; the policy (length, common passwords) is checked by the service. */
export const Password = z.string().min(1).max(1024);
export const NewPassword = z.string().min(1).max(1024).describe('12–256 characters, not a common password');
export const Uuid = z.string().uuid();
export const RoleSchema = z.enum(ROLES);
export const PermissionSchema = z.enum(PERMISSIONS);
export const TotpCode = z.string().regex(/^\d{6}$/, 'six digits');
export const RecoveryCode = z.string().min(32).max(64);

export const NextStep = z.enum(['authenticated', 'mfa_required', 'mfa_enrollment_required']);

export const SessionView = z
  .object({
    next: NextStep,
    user: z.object({ id: Uuid, email: z.string(), name: z.string(), role: RoleSchema }),
    permissions: z.array(PermissionSchema),
    session: z.object({ id: Uuid, aal: z.number().int(), expiresAt: z.string(), stepUpValidUntil: z.string().nullable() }),
    mfa: z.object({
      requirement: z.enum(['passkey', 'any', 'none']),
      requirementMet: z.boolean(),
      enrolled: z.boolean(),
      passkeys: z.number().int(),
      totp: z.boolean(),
      recoveryCodesLeft: z.number().int(),
    }),
  })
  .meta({ id: 'SessionView' });

export const RecoveryCodesView = z
  .object({ recoveryCodes: z.array(z.string()).describe('Shown once. Store them offline.') })
  .meta({ id: 'RecoveryCodes' });

export const PublicUserSchema = z
  .object({
    id: Uuid,
    email: z.string(),
    name: z.string(),
    role: RoleSchema,
    status: z.enum(['active', 'disabled']),
    lastLoginAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'User' });

/** Standard error responses for the OpenAPI document. */
export const problems = (...statuses: number[]) => Object.fromEntries(statuses.map((s) => [s, ProblemSchema]));

/** Loose JSON object (WebAuthn options / responses are defined by the W3C spec). */
export const WebAuthnJson = z.record(z.string(), z.unknown());

export const NoContent = z.null().describe('No content');
