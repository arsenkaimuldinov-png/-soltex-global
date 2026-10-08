/** /api/v1/health, /api/v1/audit and the OpenAPI document. */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { auditEvents } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { problems, Uuid } from './schemas.ts';

export async function systemRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Public liveness probe: no details, never cached (Phase A, unchanged contract).
  r.get(
    '/api/v1/health',
    {
      config: { access: { level: 'public' } },
      schema: { tags: ['system'], summary: 'Liveness probe', response: { 200: z.object({ status: z.literal('ok') }) } },
    },
    async () => ({ status: 'ok' as const })
  );

  const AuditItem = z.object({
    id: z.number().int(),
    at: z.string(),
    actorId: Uuid.nullable(),
    action: z.string(),
    resourceType: z.string().nullable(),
    resourceId: z.string().nullable(),
    result: z.enum(['success', 'failure', 'denied']),
    requestId: z.string().nullable(),
    summary: z.record(z.string(), z.unknown()),
  });

  r.get(
    '/api/v1/audit',
    {
      config: { access: { level: 'full', permission: 'audit.read' } },
      schema: {
        tags: ['system'],
        summary: 'Audit log (newest first)',
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          before: z.coerce.number().int().positive().optional(),
          actorId: Uuid.optional(),
          action: z.string().max(80).optional(),
        }),
        response: { 200: z.object({ items: z.array(AuditItem) }), ...problems(400, 401, 403) },
      },
    },
    async (request) => {
      const q = request.query;
      const rows = await requireDb(deps)
        .select()
        .from(auditEvents)
        .where(
          and(
            q.before ? lt(auditEvents.id, q.before) : undefined,
            q.actorId ? eq(auditEvents.actorId, q.actorId) : undefined,
            q.action ? eq(auditEvents.action, q.action) : undefined
          )
        )
        .orderBy(desc(auditEvents.id))
        .limit(q.limit);
      return {
        items: rows.map((e) => ({
          id: e.id,
          at: e.at.toISOString(),
          actorId: e.actorId,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          result: e.result,
          requestId: e.requestId,
          summary: e.summary as Record<string, unknown>,
        })),
      };
    }
  );

  // OpenAPI 3.1 document (approved §10, §19): never in production; signed-in system.read elsewhere.
  if (deps.config.apiDocs !== 'off') {
    r.get(
      '/api/v1/docs/openapi.json',
      {
        config: { access: { level: 'full', permission: 'system.read' } },
        schema: { hide: true },
      },
      async () => app.swagger()
    );
  }
}
