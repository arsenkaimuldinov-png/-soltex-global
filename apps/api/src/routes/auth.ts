/**
 * /api/v1/auth: login, logout, session, sessions, password change and reset, profile.
 * Second-factor routes: mfa.ts and passkeys.ts.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { permissionsOf } from '@soltex/core/domain';
import { sessions, users } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { clientInfo, requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { authOf, type AuthContext } from '../auth/guard.ts';
import { loginWithPassword, nextStep, rememberDevice } from '../auth/login.ts';
import { changePassword, confirmPasswordReset, requestPasswordReset } from '../auth/passwords-flow.ts';
import { revokeSession, revokeUserSessions, rotateSession, stepUpValidUntil, type IssuedSession } from '../auth/sessions.ts';
import { clearSessionCookie, readDeviceCookie, setDeviceCookie, setSessionCookie } from '../http/cookies.ts';
import { Problem } from '../http/problem.ts';
import { Email, NewPassword, NoContent, Password, problems, SessionView, Uuid } from './schemas.ts';
import { byIp, bySessionOrIp } from './rate-limits.ts';

export function sessionView(deps: Deps, auth: AuthContext): z.infer<typeof SessionView> {
  const { user, session, factors } = auth;
  return {
    next: nextStep(factors, session.aal),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    permissions: permissionsOf(user.role),
    session: {
      id: session.id,
      aal: session.aal,
      expiresAt: session.expiresAt.toISOString(),
      stepUpValidUntil: stepUpValidUntil(session)?.toISOString() ?? null,
    },
    mfa: {
      requirement: factors.requirement,
      requirementMet: factors.requirementMet,
      enrolled: factors.enrolled,
      passkeys: factors.passkeys,
      totp: factors.totp,
      recoveryCodesLeft: factors.recoveryCodesLeft,
    },
  };
}

/** Put a freshly issued session token into the cookie. */
export function issueCookie(deps: Deps, reply: FastifyReply, issued: IssuedSession) {
  setSessionCookie(deps, reply, issued.token, issued.session.expiresAt);
}

/** After a full login (second factor done, or none needed): remember this browser. */
export async function rememberBrowser(deps: Deps, request: FastifyRequest, reply: FastifyReply, userId: string) {
  const token = await rememberDevice(deps, userId, readDeviceCookie(request, deps));
  if (token) setDeviceCookie(deps, reply, token);
}

export async function authRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/api/v1/auth/login',
    {
      config: { access: { level: 'public' }, rateLimit: byIp(30, 15 * 60_000) },
      schema: {
        tags: ['auth'],
        summary: 'Sign in with e-mail and password',
        description: 'Creates a session (cookie). If the user has a second factor, `next` is `mfa_required` and only the MFA routes work until it is verified.',
        body: z.object({ email: Email, password: Password }),
        response: { 200: SessionView, ...problems(400, 401, 403, 429) },
      },
    },
    async (request, reply) => {
      const client = clientInfo(deps, request);
      const result = await loginWithPassword(deps, { ...request.body, deviceToken: readDeviceCookie(request, deps), client });
      issueCookie(deps, reply, result.issued);
      if (result.next === 'authenticated') await rememberBrowser(deps, request, reply, result.user.id);
      return sessionView(deps, { session: result.issued.session, user: result.user, factors: result.factors });
    }
  );

  r.post(
    '/api/v1/auth/logout',
    {
      config: { access: { level: 'pending' } },
      schema: { tags: ['auth'], summary: 'Sign out (revokes this session)', response: { 204: NoContent, ...problems(401, 403) } },
    },
    async (request, reply) => {
      const auth = authOf(request);
      await revokeSession(deps, auth.session.id, 'logout');
      await recordAudit(deps, clientInfo(deps, request), { action: 'auth.logout', result: 'success', actorId: auth.user.id, resourceType: 'session', resourceId: auth.session.id });
      clearSessionCookie(deps, reply);
      return reply.code(204).send(null);
    }
  );

  r.get(
    '/api/v1/auth/session',
    {
      config: { access: { level: 'pending' } },
      schema: { tags: ['auth'], summary: 'Current session, user, permissions and MFA state', response: { 200: SessionView, ...problems(401) } },
    },
    async (request) => sessionView(deps, authOf(request))
  );

  const SessionItem = z.object({ id: Uuid, current: z.boolean(), aal: z.number().int(), createdAt: z.string(), lastSeenAt: z.string(), userAgent: z.string().nullable() });

  r.get(
    '/api/v1/auth/sessions',
    {
      config: { access: { level: 'full' } },
      schema: { tags: ['auth'], summary: 'My active sessions', response: { 200: z.object({ items: z.array(SessionItem) }), ...problems(401, 403) } },
    },
    async (request) => {
      const auth = authOf(request);
      const rows = await requireDb(deps)
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, auth.user.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, deps.now())))
        .orderBy(desc(sessions.lastSeenAt));
      return {
        items: rows.map((s) => ({
          id: s.id,
          current: s.id === auth.session.id,
          aal: s.aal,
          createdAt: s.createdAt.toISOString(),
          lastSeenAt: s.lastSeenAt.toISOString(),
          userAgent: s.userAgent,
        })),
      };
    }
  );

  r.post(
    '/api/v1/auth/sessions/:id/revoke',
    {
      config: { access: { level: 'full' } },
      schema: { tags: ['auth'], summary: 'Revoke one of my sessions', params: z.object({ id: Uuid }), response: { 204: NoContent, ...problems(401, 403, 404) } },
    },
    async (request, reply) => {
      const auth = authOf(request);
      const [s] = await requireDb(deps).select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, request.params.id), eq(sessions.userId, auth.user.id)));
      if (!s || !(await revokeSession(deps, s.id, 'revoked_by_user'))) throw new Problem('not_found');
      await recordAudit(deps, clientInfo(deps, request), { action: 'auth.session.revoke', result: 'success', actorId: auth.user.id, resourceType: 'session', resourceId: s.id });
      if (s.id === auth.session.id) clearSessionCookie(deps, reply);
      return reply.code(204).send(null);
    }
  );

  r.post(
    '/api/v1/auth/sessions/revoke-others',
    {
      config: { access: { level: 'full' } },
      schema: { tags: ['auth'], summary: 'Sign out everywhere else', response: { 200: z.object({ revoked: z.number().int() }), ...problems(401, 403) } },
    },
    async (request) => {
      const auth = authOf(request);
      const revoked = await revokeUserSessions(deps, auth.user.id, 'revoked_by_user', { except: auth.session.id });
      await recordAudit(deps, clientInfo(deps, request), { action: 'auth.session.revoke_others', result: 'success', actorId: auth.user.id, summary: { revoked: String(revoked) } });
      return { revoked };
    }
  );

  r.post(
    '/api/v1/auth/password/change',
    {
      config: { access: { level: 'full' }, rateLimit: bySessionOrIp(deps, 10, 15 * 60_000) },
      schema: {
        tags: ['auth'],
        summary: 'Change my password',
        description: 'Revokes all my other sessions and rotates the current session token.',
        body: z.object({ currentPassword: Password, newPassword: NewPassword }),
        response: { 204: NoContent, ...problems(400, 401, 403, 422, 429) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      await changePassword(deps, { userId: auth.user.id, ...request.body, keepSessionId: auth.session.id, client: clientInfo(deps, request) });
      issueCookie(deps, reply, await rotateSession(deps, auth.session));
      return reply.code(204).send(null);
    }
  );

  r.post(
    '/api/v1/auth/password-reset/request',
    {
      config: { access: { level: 'public' }, rateLimit: byIp(5, 60 * 60_000) },
      schema: {
        tags: ['auth'],
        summary: 'Request a password-reset link',
        description: 'Always answers 202, whether or not the account exists.',
        body: z.object({ email: Email }),
        response: { 202: NoContent, ...problems(400, 429) },
      },
    },
    async (request, reply) => {
      await requestPasswordReset(deps, request.body.email, clientInfo(deps, request));
      return reply.code(202).send(null);
    }
  );

  r.post(
    '/api/v1/auth/password-reset/confirm',
    {
      config: { access: { level: 'public' }, rateLimit: byIp(10, 15 * 60_000) },
      schema: {
        tags: ['auth'],
        summary: 'Set a new password with a reset token',
        description: 'Revokes every session of the user. Does not sign in (the second factor is never bypassed).',
        body: z.object({ token: z.string().min(20).max(100), newPassword: NewPassword }),
        response: { 204: NoContent, ...problems(400, 422, 429) },
      },
    },
    async (request, reply) => {
      await confirmPasswordReset(deps, request.body.token, request.body.newPassword, clientInfo(deps, request));
      return reply.code(204).send(null);
    }
  );

  r.patch(
    '/api/v1/auth/profile',
    {
      config: { access: { level: 'full' } },
      schema: {
        tags: ['auth'],
        summary: 'Update my profile (display name)',
        body: z.object({ name: z.string().trim().min(1).max(120) }).strict(),
        response: { 200: SessionView, ...problems(400, 401, 403) },
      },
    },
    async (request) => {
      const auth = authOf(request);
      const [user] = await requireDb(deps)
        .update(users)
        .set({ name: request.body.name, updatedAt: deps.now(), updatedBy: auth.user.id })
        .where(eq(users.id, auth.user.id))
        .returning();
      await recordAudit(deps, clientInfo(deps, request), { action: 'user.profile_update', result: 'success', actorId: auth.user.id, resourceType: 'user', resourceId: auth.user.id, summary: { fields: ['name'] } });
      return sessionView(deps, { ...auth, user: user! });
    }
  );
}
