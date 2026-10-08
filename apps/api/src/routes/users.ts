/**
 * /api/v1/users: user management (permission users.manage; every change needs step-up).
 * Resource rules (Owner-only targets, no self-escalation) live in @soltex/core/domain
 * `canManageUser` and are applied per field in users/users.ts.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { createUser, listUsers, resetUserMfa, revokeSessionsOf, updateUser } from '../users/users.ts';
import { Email, NewPassword, NoContent, problems, PublicUserSchema, RoleSchema, Uuid } from './schemas.ts';

export async function userRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const manage = { level: 'full', permission: 'users.manage' } as const;
  const manageStepUp = { level: 'full', permission: 'users.manage', stepUp: true } as const;

  r.get(
    '/api/v1/users',
    { config: { access: manage }, schema: { tags: ['users'], summary: 'List users', response: { 200: z.object({ items: z.array(PublicUserSchema) }), ...problems(401, 403) } } },
    async () => ({ items: await listUsers(deps) })
  );

  r.post(
    '/api/v1/users',
    {
      config: { access: manageStepUp },
      schema: {
        tags: ['users'],
        summary: 'Create a user (step-up required)',
        description: 'Only an Owner can create an Owner. The initial password is given to the user out of band; they must enroll MFA at first sign-in when their role requires it.',
        body: z.object({ email: Email, name: z.string().trim().min(1).max(120), role: RoleSchema, password: NewPassword }).strict(),
        response: { 201: PublicUserSchema, ...problems(400, 401, 403, 409, 422) },
      },
    },
    async (request, reply) => {
      const user = await createUser(deps, authOf(request).user, request.body, clientInfo(deps, request));
      return reply.code(201).send(user);
    }
  );

  r.patch(
    '/api/v1/users/:id',
    {
      config: { access: manageStepUp },
      schema: {
        tags: ['users'],
        summary: 'Change name, role or status (step-up required)',
        description: 'Each field is authorised separately. Role and status changes sign the user out everywhere.',
        params: z.object({ id: Uuid }),
        body: z
          .object({ name: z.string().trim().min(1).max(120).optional(), role: RoleSchema.optional(), status: z.enum(['active', 'disabled']).optional() })
          .strict(),
        response: { 200: PublicUserSchema, ...problems(400, 401, 403, 404) },
      },
    },
    async (request) => updateUser(deps, authOf(request).user, request.params.id, request.body, clientInfo(deps, request))
  );

  r.post(
    '/api/v1/users/:id/mfa-reset',
    {
      config: { access: manageStepUp },
      schema: {
        tags: ['users'],
        summary: 'Reset a user\'s second factors (lost device; step-up required)',
        description: 'Removes passkeys, TOTP and recovery codes and signs the user out everywhere; they must enroll again at the next sign-in.',
        params: z.object({ id: Uuid }),
        response: { 204: NoContent, ...problems(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await resetUserMfa(deps, authOf(request).user, request.params.id, clientInfo(deps, request));
      return reply.code(204).send(null);
    }
  );

  r.post(
    '/api/v1/users/:id/sessions/revoke',
    {
      config: { access: manageStepUp },
      schema: {
        tags: ['users'],
        summary: 'Sign a user out everywhere (step-up required)',
        params: z.object({ id: Uuid }),
        response: { 200: z.object({ revoked: z.number().int() }), ...problems(401, 403, 404) },
      },
    },
    async (request) => ({ revoked: await revokeSessionsOf(deps, authOf(request).user, request.params.id, clientInfo(deps, request)) })
  );
}
