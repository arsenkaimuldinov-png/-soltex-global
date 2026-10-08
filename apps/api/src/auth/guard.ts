/**
 * Access control for every /api/v1 route (approved §8.3): user → permissions → endpoint →
 * resource → field. Each route MUST declare `config.access`; the app refuses to start if one
 * does not (a route without an access rule is a bug, not "public by default").
 *
 * Levels:
 *  public      no session needed (health, login, password reset)
 *  pending     any live session, even before the second factor (session info, logout, MFA verify)
 *  enrollment  second factor verified if one is enrolled; the role's MFA requirement may still
 *              be unmet (MFA enrollment endpoints). `stepUpIfEnrolled` adds step-up for users who
 *              already have a factor (adding a factor is then a sensitive change)
 *  full        second factor verified AND the role's requirement met; plus optional `permission`
 *              and `stepUp` (second factor verified within the last 10 minutes)
 * There is no role-based shortcut: permissions come only from @soltex/core/domain.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, type Permission } from '@soltex/core/domain';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import { readSessionCookie } from '../http/cookies.ts';
import { factorState, type FactorState } from './factors.ts';
import { loadSession, STEP_UP_WINDOW_MS, type SessionRow, type UserRow } from './sessions.ts';

export type Access =
  | { level: 'public' }
  | { level: 'pending' }
  | { level: 'enrollment'; stepUpIfEnrolled?: boolean }
  | { level: 'full'; permission?: Permission; stepUp?: boolean };

export interface AuthContext {
  session: SessionRow;
  user: UserRow;
  factors: FactorState;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    access?: Access;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    /** Every /api/v1 route with its access rule (tests: nothing is public by accident). */
    routeAccess: { method: string; url: string; access: Access }[];
  }
}

export function hasFreshStepUp(deps: Deps, session: SessionRow): boolean {
  return session.aal === 2 && !!session.mfaVerifiedAt && deps.now().getTime() - session.mfaVerifiedAt.getTime() <= STEP_UP_WINDOW_MS;
}

export function registerAccessControl(app: FastifyInstance, deps: Deps) {
  app.decorateRequest('auth', null);
  const list: FastifyInstance['routeAccess'] = [];
  app.decorate('routeAccess', list);

  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/v1')) return;
    const access = route.config?.access;
    if (!access) throw new Error(`route ${route.method} ${route.url} has no access rule (config.access)`);
    for (const method of [route.method].flat()) if (method !== 'HEAD') list.push({ method, url: route.url, access });
  });

  // preValidation: access is decided before the body is validated, so anonymous callers learn nothing.
  app.addHook('preValidation', async (request: FastifyRequest, _reply: FastifyReply) => {
    const access = request.routeOptions.config?.access;
    if (!access || access.level === 'public') return;

    const loaded = await loadSession(deps, readSessionCookie(request, deps));
    if (!loaded) throw new Problem('unauthenticated');
    const factors = await factorState(deps, loaded.user);
    request.auth = { ...loaded, factors };
    if (access.level === 'pending') return;

    const { session, user } = loaded;
    if (factors.enrolled && session.aal < 2) throw new Problem('mfa_required');

    if (access.level === 'enrollment') {
      if (access.stepUpIfEnrolled && factors.enrolled && !hasFreshStepUp(deps, session)) throw new Problem('step_up_required');
      return;
    }

    if (!factors.requirementMet) throw new Problem('mfa_enrollment_required');
    if (access.permission && !hasPermission(user.role, access.permission)) {
      await recordAudit(deps, clientInfo(deps, request), {
        action: 'access.denied',
        result: 'denied',
        actorId: user.id,
        resourceType: 'endpoint',
        resourceId: `${request.method} ${request.routeOptions.url}`,
        summary: { permission: access.permission },
      });
      throw new Problem('forbidden');
    }
    if (access.stepUp && !hasFreshStepUp(deps, session)) throw new Problem('step_up_required');
  });
}

/** The authenticated context of a protected route (always set after the access hook). */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new Problem('unauthenticated');
  return request.auth;
}
