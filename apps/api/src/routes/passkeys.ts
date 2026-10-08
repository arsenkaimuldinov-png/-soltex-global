/**
 * /api/v1/auth/passkeys: WebAuthn registration and authentication (API only; the browser
 * ceremony UI arrives with the admin in Phase D).
 *
 *   registration/options → navigator.credentials.create() → registration/verify
 *   authentication/options → navigator.credentials.get()  → authentication/verify
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { authOf } from '../auth/guard.ts';
import { regenerateRecoveryCodes } from '../auth/recovery.ts';
import {
  listPasskeys,
  passkeyAuthenticationOptions,
  passkeyRegistrationOptions,
  removePasskey,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from '../auth/webauthn.ts';
import { Problem } from '../http/problem.ts';
import { secondFactorFailed, secondFactorSucceeded } from './mfa.ts';
import { bySessionOrIp } from './rate-limits.ts';
import { NoContent, problems, SessionView, Uuid, WebAuthnJson } from './schemas.ts';

const RegistrationResponse = z
  .object({
    id: z.string().max(1024),
    rawId: z.string().max(1024),
    type: z.literal('public-key'),
    response: z.object({ clientDataJSON: z.string().max(8192), attestationObject: z.string().max(65536) }).passthrough(),
  })
  .passthrough();

const AuthenticationResponse = z
  .object({
    id: z.string().max(1024),
    rawId: z.string().max(1024),
    type: z.literal('public-key'),
    response: z
      .object({ clientDataJSON: z.string().max(8192), authenticatorData: z.string().max(8192), signature: z.string().max(2048) })
      .passthrough(),
  })
  .passthrough();

export async function passkeyRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const optionsLimit = bySessionOrIp(deps, 20, 5 * 60_000);
  const verifyLimit = bySessionOrIp(deps, 10, 5 * 60_000);

  r.post(
    '/api/v1/auth/passkeys/registration/options',
    {
      config: { access: { level: 'enrollment', stepUpIfEnrolled: true }, rateLimit: optionsLimit },
      schema: {
        tags: ['passkeys'],
        summary: 'Start registering a passkey',
        description: 'Returns PublicKeyCredentialCreationOptionsJSON. The challenge is bound to this session, valid 5 minutes, single use.',
        response: { 200: WebAuthnJson, ...problems(401, 403, 429) },
      },
    },
    async (request) => {
      const auth = authOf(request);
      return (await passkeyRegistrationOptions(deps, auth.session, auth.user)) as unknown as Record<string, unknown>;
    }
  );

  r.post(
    '/api/v1/auth/passkeys/registration/verify',
    {
      config: { access: { level: 'enrollment', stepUpIfEnrolled: true }, rateLimit: verifyLimit },
      schema: {
        tags: ['passkeys'],
        summary: 'Finish registering a passkey',
        description: 'If this is the first second factor, the session is raised to assurance 2 and recovery codes are returned (once).',
        body: z.object({ name: z.string().trim().min(1).max(60), response: RegistrationResponse }),
        response: { 200: SessionView.extend({ recoveryCodes: z.array(z.string()).optional() }), ...problems(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      const first = !auth.factors.enrolled;
      let created: { id: string };
      try {
        created = await verifyPasskeyRegistration(deps, auth.session, auth.user, request.body.response as unknown as RegistrationResponseJSON, request.body.name);
      } catch (e) {
        if (e instanceof Problem && e.code === 'mfa_invalid') return secondFactorFailed(deps, request, reply, auth, 'passkey');
        throw e;
      }
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.passkey.register', result: 'success', actorId: auth.user.id, resourceType: 'passkey', resourceId: created.id });
      await deps.notifier.securityAlert(auth.user, 'passkey_added');
      const recoveryCodes = first ? await regenerateRecoveryCodes(deps, auth.user.id) : undefined;
      const view = await secondFactorSucceeded(deps, request, reply, auth, 'passkey');
      return { ...view, ...(recoveryCodes ? { recoveryCodes } : {}) };
    }
  );

  r.post(
    '/api/v1/auth/passkeys/authentication/options',
    {
      config: { access: { level: 'pending' }, rateLimit: optionsLimit },
      schema: {
        tags: ['passkeys'],
        summary: 'Start a passkey check (sign-in second factor or step-up)',
        description: 'Returns PublicKeyCredentialRequestOptionsJSON for the passkeys of the signed-in user.',
        response: { 200: WebAuthnJson, ...problems(401, 409, 429) },
      },
    },
    async (request) => {
      const auth = authOf(request);
      return (await passkeyAuthenticationOptions(deps, auth.session, auth.user)) as unknown as Record<string, unknown>;
    }
  );

  r.post(
    '/api/v1/auth/passkeys/authentication/verify',
    {
      config: { access: { level: 'pending' }, rateLimit: verifyLimit },
      schema: {
        tags: ['passkeys'],
        summary: 'Finish a passkey check',
        body: z.object({ response: AuthenticationResponse }),
        response: { 200: SessionView, ...problems(400, 401, 429) },
      },
    },
    async (request, reply) => {
      const auth = authOf(request);
      const ok = await verifyPasskeyAuthentication(deps, auth.session, auth.user, request.body.response as unknown as AuthenticationResponseJSON);
      if (!ok) return secondFactorFailed(deps, request, reply, auth, 'passkey');
      return secondFactorSucceeded(deps, request, reply, auth, 'passkey');
    }
  );

  const PasskeyItem = z.object({ id: Uuid, name: z.string(), deviceType: z.string(), backedUp: z.boolean(), createdAt: z.string(), lastUsedAt: z.string().nullable() });

  r.get(
    '/api/v1/auth/passkeys',
    {
      config: { access: { level: 'enrollment' } },
      schema: { tags: ['passkeys'], summary: 'My passkeys', response: { 200: z.object({ items: z.array(PasskeyItem) }), ...problems(401) } },
    },
    async (request) => {
      const items = await listPasskeys(deps, authOf(request).user.id);
      return { items: items.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null })) };
    }
  );

  r.delete(
    '/api/v1/auth/passkeys/:id',
    {
      config: { access: { level: 'full', stepUp: true } },
      schema: { tags: ['passkeys'], summary: 'Remove one of my passkeys (step-up required)', params: z.object({ id: Uuid }), response: { 204: NoContent, ...problems(401, 403, 404, 409) } },
    },
    async (request, reply) => {
      const auth = authOf(request);
      // Ownership first: someone else's passkey is simply "not found".
      if (!(await listPasskeys(deps, auth.user.id)).some((p) => p.id === request.params.id)) throw new Problem('not_found');
      const last = auth.factors.passkeys <= 1;
      if (last && (auth.factors.requirement === 'passkey' || (auth.factors.requirement === 'any' && !auth.factors.totp)))
        throw new Problem('conflict', 'Нельзя удалить последний ключ доступа: сначала добавьте другой');
      if (!(await removePasskey(deps, auth.user.id, request.params.id))) throw new Problem('not_found');
      await recordAudit(deps, clientInfo(deps, request), { action: 'mfa.passkey.remove', result: 'success', actorId: auth.user.id, resourceType: 'passkey', resourceId: request.params.id });
      await deps.notifier.securityAlert(auth.user, 'passkey_removed');
      return reply.code(204).send(null);
    }
  );
}
