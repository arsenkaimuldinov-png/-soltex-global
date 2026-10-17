/** /api/v1/health, /api/v1/audit, the OpenAPI document; Phase L: dashboard, system status, search. */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { LEAD_STATUSES, TRANSLATED_LOCALES } from '@soltex/core/domain';
import { authOf } from '../auth/guard.ts';
import { auditEvents } from '../db/schema.ts';
import { TRANSLATABLE_TYPES } from '../content/review-tables.ts';
import { dashboard, search, SEARCH_MIN_LENGTH, systemStatus } from '../system/overview.ts';
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

  // --- Phase L: «Обзор», «Система», ⌘K -------------------------------------------------------
  const Type = z.enum(TRANSLATABLE_TYPES);
  const Build = z.object({ key: z.string(), at: z.string(), durationSeconds: z.number().int().nullable(), reason: z.string().nullable() });
  const Dashboard = z
    .object({
      leads: z
        .object({ byStatus: z.partialRecord(z.enum(LEAD_STATUSES), z.number().int()), notifyFailed: z.number().int(), formsLive: z.boolean() })
        .optional()
        .describe('leads.read'),
      seo: z.object({ blocking: z.number().int(), warning: z.number().int(), info: z.number().int() }).optional().describe('seo.read: the check of the next release'),
      translations: z
        .object({
          locales: z.array(
            z.object({ locale: z.enum(TRANSLATED_LOCALES), total: z.number().int(), missing: z.number().int(), inProgress: z.number().int(), outdated: z.number().int(), completion: z.number().int() })
          ),
        })
        .optional()
        .describe('content.read'),
      content: z
        .object({
          drafts: z.array(z.object({ type: Type, count: z.number().int() })).describe('Draft records per type (types without drafts are left out)'),
          pending: z.number().int().describe('Records whose current version is not on the live site'),
          recent: z.array(z.object({ type: Type, id: Uuid, title: z.string(), at: z.string(), by: z.string().nullable() })),
        })
        .optional()
        .describe('content.read'),
      publishing: z
        .object({
          active: z.object({ key: z.string(), activatedAt: z.string().nullable() }).nullable(),
          lastBuild: z.object({ key: z.string(), ok: z.boolean(), finishedAt: z.string(), durationSeconds: z.number().int().nullable(), reason: z.string().nullable() }).nullable(),
          running: z.number().int(),
        })
        .optional()
        .describe('content.read'),
      media: z.object({ total: z.number().int(), attention: z.number().int(), pendingCopies: z.number().int() }).optional().describe('media.read'),
    })
    .meta({ id: 'Dashboard' });

  r.get(
    '/api/v1/dashboard',
    {
      config: { access: { level: 'full' } },
      schema: { tags: ['system'], summary: 'Numbers of «Обзор»; each block only for the role that may read it', response: { 200: Dashboard, ...problems(401) } },
    },
    async (req) => dashboard(deps, authOf(req).user.role)
  );

  r.get(
    '/api/v1/system/status',
    {
      config: { access: { level: 'full', permission: 'system.read' } },
      schema: {
        tags: ['system'],
        summary: 'State of the database, worker, queues, site builds, disk, mail and backups',
        response: {
          200: z
            .object({
              database: z.object({ ok: z.boolean(), latencyMs: z.number().int(), version: z.string().nullable(), sizeBytes: z.number().nullable() }),
              worker: z.object({ running: z.boolean(), since: z.string().nullable(), lastActivity: z.string().nullable() }),
              queue: z.object({ builds: z.number().int(), mail: z.number().int(), mailFailed: z.number().int(), imageCopies: z.number().int() }),
              site: z.object({ active: z.object({ key: z.string(), activatedAt: z.string().nullable() }).nullable(), lastSuccessfulBuild: Build.nullable(), lastFailedBuild: Build.nullable() }),
              disk: z.array(z.object({ label: z.string(), totalBytes: z.number(), freeBytes: z.number() })),
              mail: z.object({ configured: z.boolean(), recipients: z.number().int() }),
              backups: z.object({ configured: z.boolean() }).describe('Phase N'),
              checkedAt: z.string(),
            })
            .meta({ id: 'SystemStatus' }),
          ...problems(401, 403),
        },
      },
    },
    async () => systemStatus(deps)
  );

  r.get(
    '/api/v1/search',
    {
      config: { access: { level: 'full' } },
      schema: {
        tags: ['system'],
        summary: 'Content search for ⌘K',
        description: 'Titles in every language and keys of the seven content types (content.read), media files (media.read), lead numbers and names (leads.read). Up to 5 per type.',
        querystring: z.object({ q: z.string().max(100) }),
        response: {
          200: z.object({
            items: z.array(
              z.discriminatedUnion('kind', [
                z.object({ kind: z.literal('content'), type: Type, id: Uuid, title: z.string(), status: z.enum(['draft', 'published', 'archived']), match: z.string().nullable() }),
                z.object({ kind: z.literal('media'), id: Uuid, title: z.string(), mediaKind: z.enum(['image', 'video']) }),
                z.object({ kind: z.literal('lead'), id: Uuid, title: z.string(), status: z.enum(LEAD_STATUSES) }),
              ])
            ),
            minLength: z.literal(SEARCH_MIN_LENGTH),
          }).meta({ id: 'SearchResults' }),
          ...problems(400, 401),
        },
      },
    },
    async (req) => ({ items: await search(deps, authOf(req).user.role, req.query.q), minLength: SEARCH_MIN_LENGTH })
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
