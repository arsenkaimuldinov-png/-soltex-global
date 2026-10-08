/**
 * /api/v1/auth/mfa: TOTP (fallback factor) and recovery codes; overview of my factors.
 *
 * Verifying any factor (here or a passkey in passkeys.ts) raises the session to assurance 2,
 * restarts the 10-minute step-up window and rotates the session token. Five failed codes revoke
 * the session. Codes are never logged or audited.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { factorState } from '../auth/factors.ts';
import { authOf, type AuthContext } from '../auth/guard.ts';
import { consumeRecoveryCode, regenerateRecoveryCodes } from '../auth/recovery.ts';
import { completeSecondFactor, recordMfaFailure } from '../auth/sessions.ts';
import { disableTotp, startTotpEnrollment, verifyTotp } from '../auth/totp.ts';
import { clearSessionCookie } from '../http/cookies.ts';
import { Problem } from '../http/problem.ts';
import { issueCookie, rememberBrowser, sessionView } from './auth.ts';
import { bySessionOrIp } from './rate-limits.ts';
import { NoContent, problems, RecoveryCode, RecoveryCodesView, SessionView, TotpCode } from './schemas.ts';

export type Factor = 'totp' | 'recovery' | 'passkey';

/** A factor was verified for this session: upgrade, rotate, audit, remember the browser. */
export async function secondFactorSucceeded(deps: Deps, request: FastifyRequest, reply: FastifyReply, auth: AuthContext, factor: Factor) {
  const stepUp = auth.session.aal === 2;
  const issued = await completeSecondFactor(deps, auth.session);
  issueCookie(deps, reply, issued);
  await recordAudit(deps, clientInfo(deps, request), {
    action: 'auth.mfa',
    result: 'success',
    actorId: auth.user.id,
    resourceType: 'session',
    resourceId: auth.session.id,
    summary: { factor, step_up: stepUp },
  });
  await rememberBrowser(deps, request, reply, auth.user.id);
  const factors = await factorState(deps, auth.user);
  return sessionView(deps, { session: issued.session, user: auth.user, factors });
}

/** A factor failed: count it (5 failures revoke the session), audit, answer 401. */
export async function secondFactorFailed(deps: Deps, request: FastifyRequest, reply: FastifyReply, auth: AuthContext, factor: Factor): Promise<never> {
  const { revoked } = await recordMfaFailure(deps, auth.session);
  await recordAudit(deps, clientInfo(deps, request), {
    action: 'auth.mfa',
    result: 'failure',
    actorId: auth.user.id,
    resourceType: 'session',
    resourceId: auth.session.id,
    summary: { factor, revoked: revoked ? 'session' : 'no' },
  });
  if (revoked) clearSessionCookie(deps, reply);
  throw new Problem('mfa_invalid');
}

export async function mfaRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const verifyLimit = bySessionOrIp(deps, 10, 5 * 60_000);

  r.get(
    '/api/v1/auth/mfa',
    {
      config: { access: { level: 'enrollment' } },
      schema: { tags: ['mfa'], summary: 'My second factors and the requirement of my role', response: { 200: SessionView, ...problems(401) } },
    },
    async (request) => sessionView(deps, authOf(request))
  );

  r.post(
    '/api/v1/auth/mfa/totp/verify',
    {
      config: { access: { level: 'pending' }, rateLimit: verifyLimit },
      schema: {
        tags: ['mfa'],
        summary: 'Verify a TOTP code (sign-in second factor or step-up)',
        body: z.object({ code: TotpCode }),
        response: { 200: SessionView, ...problems(400, 401, 429) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      if (!(await verifyTotp(deps, auth.user.id, request.body.code))) return secondFactorFailed(deps, request, reply, auth, 'totp');
      return secondFactorSucceeded(deps, request, reply, auth, 'totp');
    }
  );

  r.post(
    '/api/v1/auth/mfa/recovery/verify',
    {
      config: { access: { level: 'pending' }, rateLimit: verifyLimit },
      schema: {
        tags: ['mfa'],
        summary: 'Use a one-time recovery code (lost device)',
        body: z.object({ code: RecoveryCode }),
        response: { 200: SessionView, ...problems(400, 401, 429) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      if (!(await consumeRecoveryCode(deps, auth.user.id, request.body.code))) return secondFactorFailed(deps, request, reply, auth, 'recovery');
      await deps.notifier.securityAlert(auth.user, 'recovery_code_used');
      return secondFactorSucceeded(deps, request, reply, auth, 'recovery');
    }
  );

  r.post(
    '/api/v1/auth/mfa/totp/enroll',
    {
      config: { access: { level: 'enrollment', stepUpIfEnrolled: true }, rateLimit: verifyLimit },
      schema: {
        tags: ['mfa'],
        summary: 'Start TOTP enrollment',
        description: 'Returns the secret and the otpauth:// URI (for a QR code) once. Confirm with a code to activate.',
        response: { 200: z.object({ secret: z.string(), otpauthUri: z.string() }), ...problems(401, 403, 409) },
      },
    },
    async (request) => {
      const auth = authOf(request);
      const started = await startTotpEnrollment(deps, auth.user);
      if (started === 'already_enrolled') throw new Problem('conflict', 'TOTP уже настроен');
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.totp.enroll_start', result: 'success', actorId: auth.user.id });
      return { secret: started.secret, otpauthUri: started.uri };
    }
  );

  r.post(
    '/api/v1/auth/mfa/totp/confirm',
    {
      config: { access: { level: 'enrollment', stepUpIfEnrolled: true }, rateLimit: verifyLimit },
      schema: {
        tags: ['mfa'],
        summary: 'Confirm TOTP enrollment with a first code',
        description: 'If this is the first second factor, the session is raised to assurance 2 and recovery codes are returned (once).',
        body: z.object({ code: TotpCode }),
        response: { 200: SessionView.extend({ recoveryCodes: z.array(z.string()).optional() }), ...problems(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      const first = !auth.factors.enrolled;
      if (!(await verifyTotp(deps, auth.user.id, request.body.code, { pending: true }))) return secondFactorFailed(deps, request, reply, auth, 'totp');
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.totp.enroll', result: 'success', actorId: auth.user.id });
      const recoveryCodes = first ? await regenerateRecoveryCodes(deps, auth.user.id) : undefined;
      const view = await secondFactorSucceeded(deps, request, reply, auth, 'totp');
      return { ...view, ...(recoveryCodes ? { recoveryCodes } : {}) };
    }
  );

  r.delete(
    '/api/v1/auth/mfa/totp',
    {
      config: { access: { level: 'full', stepUp: true } },
      schema: { tags: ['mfa'], summary: 'Disable TOTP (step-up required)', response: { 204: NoContent, ...problems(401, 403, 404, 409) } },
    },
    async (request, reply) => {
      const auth = authOf(request);
      if (!auth.factors.totp) throw new Problem('not_found');
      if (auth.factors.requirement === 'any' && auth.factors.passkeys === 0)
        throw new Problem('conflict', 'Нельзя отключить единственный второй фактор: сначала добавьте ключ доступа');
      await disableTotp(deps, auth.user.id);
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.totp.disable', result: 'success', actorId: auth.user.id });
      await deps.notifier.securityAlert(auth.user, 'totp_disabled');
      return reply.code(204).send(null);
    }
  );

  r.post(
    '/api/v1/auth/mfa/recovery-codes/regenerate',
    {
      config: { access: { level: 'full', stepUp: true } },
      schema: {
        tags: ['mfa'],
        summary: 'Generate new recovery codes (step-up required)',
        description: 'All previous codes stop working. The new codes are returned once.',
        response: { 200: RecoveryCodesView, ...problems(401, 403) },
      },
    },
    async (request) => {
      const auth = authOf(request);
      const recoveryCodes = await regenerateRecoveryCodes(deps, auth.user.id);
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.recovery.regenerate', result: 'success', actorId: auth.user.id, summary: { count: recoveryCodes.length } });
      return { recoveryCodes };
    }
  );
}
