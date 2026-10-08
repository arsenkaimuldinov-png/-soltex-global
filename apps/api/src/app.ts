/**
 * The Fastify application (approved §D, §19). Phase C: health, authentication, MFA, passkeys,
 * users and the audit log. Content and other modules are registered here from Phase E on.
 */
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ApiConfig } from './config.ts';
import type { Db } from './db/client.ts';
import type { Deps } from './deps.ts';
import { registerAccessControl, type Access } from './auth/guard.ts';
import { Problem, registerProblemHandlers } from './http/problem.ts';
import { genRequestId } from './http/request-id.ts';
import { CSRF_HEADER, CSRF_VALUE, registerSecurity } from './http/security.ts';
import { sessionCookieName } from './http/cookies.ts';
import { UnconfiguredNotifier, type Notifier } from './notify/notifier.ts';
import { authRoutes } from './routes/auth.ts';
import { mfaRoutes } from './routes/mfa.ts';
import { passkeyRoutes } from './routes/passkeys.ts';
import { GLOBAL_LIMIT, sessionOrIpKey } from './routes/rate-limits.ts';
import { systemRoutes } from './routes/system.ts';
import { userRoutes } from './routes/users.ts';

export const API_VERSION = '0.3.0';
export const BODY_LIMIT_BYTES = 64 * 1024;

export interface BuildOptions {
  config: ApiConfig;
  db?: Db | null;
  now?: () => Date;
  notifier?: Notifier;
  /** Collect log lines (tests: prove that no secret is ever logged). */
  logStream?: NodeJS.WritableStream;
}

/** OpenAPI security per operation, from the route's access rule (public routes need no session). */
function operationSecurity(access: Access | undefined, method: string | string[]): Record<string, string[]>[] {
  const changes = [method].flat().some((m) => !['GET', 'HEAD', 'OPTIONS'].includes(m));
  const req: Record<string, string[]> = {};
  if (access && access.level !== 'public') req.session = [];
  if (changes) req.csrf = [];
  return Object.keys(req).length ? [req] : [];
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(opts.logStream ? { stream: opts.logStream } : {}),
      // Never log credentials: cookies, authorization headers, set-cookie, request bodies.
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'], censor: '[redacted]' },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0] }),
      },
    },
    genReqId: genRequestId,
    logController: new LogController({ requestIdLogLabel: 'request_id', disableRequestLogging: config.env === 'test' && !opts.logStream }),
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: '127.0.0.1',
  });

  const deps: Deps = {
    config,
    db: opts.db ?? null,
    now: opts.now ?? (() => new Date()),
    notifier: opts.notifier ?? new UnconfiguredNotifier(app.log),
  };

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerProblemHandlers(app);

  await app.register(cookie);
  await registerSecurity(app, deps);
  await app.register(rateLimit, {
    global: true,
    ...GLOBAL_LIMIT,
    keyGenerator: (request) => sessionOrIpKey(deps, request),
    errorResponseBuilder: (_request, context) => new Problem('rate_limited', undefined, { retryAfterSeconds: context.ttl / 1000 }),
  });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Soltex Global Admin API',
        version: API_VERSION,
        description:
          'Phase C: authentication, second factors, users and audit. Errors are RFC 9457 Problem Details ' +
          '(application/problem+json) with `request_id`; every response carries `X-Request-ID`. ' +
          `State-changing requests need the header \`${CSRF_HEADER}: ${CSRF_VALUE}\`.`,
      },
      servers: [{ url: config.adminOrigin }],
      components: {
        securitySchemes: {
          session: { type: 'apiKey', in: 'cookie', name: sessionCookieName(deps), description: 'Opaque session token (HttpOnly cookie set by /auth/login).' },
          csrf: { type: 'apiKey', in: 'header', name: CSRF_HEADER, description: `Must be "${CSRF_VALUE}" on POST/PUT/PATCH/DELETE.` },
        },
      },
      security: [{ session: [], csrf: [] }],
      tags: [
        { name: 'system', description: 'Health, audit log' },
        { name: 'auth', description: 'Sign-in, sessions, passwords' },
        { name: 'mfa', description: 'TOTP and recovery codes' },
        { name: 'passkeys', description: 'WebAuthn passkeys' },
        { name: 'users', description: 'User management' },
      ],
    },
    transform: (input) => {
      const out = jsonSchemaTransform(input);
      const access = (input.route.config as { access?: Access } | undefined)?.access;
      return { ...out, schema: { ...out.schema, security: operationSecurity(access, input.route.method), 'x-soltex-access': access } as typeof out.schema };
    },
    transformObject: jsonSchemaTransformObject,
  });

  registerAccessControl(app, deps);
  await app.register(async (scope) => {
    await systemRoutes(scope, deps);
    await authRoutes(scope, deps);
    await mfaRoutes(scope, deps);
    await passkeyRoutes(scope, deps);
    await userRoutes(scope, deps);
  });

  return app;
}
