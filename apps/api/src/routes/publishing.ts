/**
 * Publishing, revisions and releases (Phase G, docs/admin-publishing.md).
 *
 *   GET  /api/v1/revisions                                         list (type, entity, kind, search, paging)    content.read
 *   GET  /api/v1/content/{type}/{id}/revisions/{n}                 one revision as labelled values             content.read
 *   GET  /api/v1/content/{type}/{id}/revisions/{n}/compare         revision n → current (or ?with=m)          content.read
 *   POST /api/v1/content/{type}/{id}/revisions/{n}/restore         as a new working version (If-Match)        content.edit (+ seo.edit per field)
 *   POST /api/v1/content/{type}/{id}/publish | /unpublish          working copy draft ⇄ published (If-Match)  content.publish
 *   GET  /api/v1/publishing/overview                               active release, builds, pending changes    content.read
 *   GET  /api/v1/releases, GET /api/v1/releases/{id}               releases and preview builds                content.read (technical details: system.read)
 *   POST /api/v1/releases                                          release candidate (snapshot → build)       content.publish
 *   POST /api/v1/previews                                          preview build of the working copy          content.edit | seo.edit | content.publish
 *   POST /api/v1/releases/{id}/activate                            publish a ready release (If-Match)         content.publish
 *   POST /api/v1/releases/{id}/rollback                            re-activate a retired release (If-Match)   system.rollback + step-up
 *   POST /api/v1/releases/{id}/retry                               rebuild a failed release's snapshot        system.deploy
 *   POST /api/v1/releases/{id}/preview                             one-time preview link                      content.read
 *   POST /api/v1/preview/revoke                                    close every preview of the user            content.read
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { hasPermission, RELEASE_KINDS, RELEASE_STATUSES, REVISION_KINDS } from '@soltex/core/domain';
import type { Deps } from '../deps.ts';
import { clientInfo, requireDb } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { Problem } from '../http/problem.ts';
import { TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { etag, parseIfMatch } from '../content/cms/service.ts';
import { diffRecords, flatten, getRevisionRow, latestRevisionRow, listRevisions, revisionItem } from '../publishing/revisions.ts';
import { restoreRevision } from '../publishing/restore.ts';
import { setPublished } from '../publishing/entity-state.ts';
import { activateRelease, createRelease, getRelease, listReleases, publishingOverview, retryRelease } from '../publishing/releases.ts';
import { createPreviewGrant, revokePreviewGrants } from '../publishing/preview.ts';
import { problems, Uuid } from './schemas.ts';

const Type = z.enum(TRANSLATABLE_TYPES as unknown as [TranslatableType, ...TranslatableType[]]);
const Kind = z.enum(REVISION_KINDS);
const Status = z.enum(RELEASE_STATUSES);
const RKind = z.enum(RELEASE_KINDS);
const UserRef = z.object({ id: Uuid, name: z.string() }).nullable();
const Leaf = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the action is based on (ETag), e.g. "3"') });

const RevisionItem = z
  .object({
    id: z.number().int(),
    entityType: Type,
    entityId: Uuid,
    entityKey: z.string(),
    number: z.number().int(),
    kind: Kind,
    locale: z.string().nullable(),
    sourceRevision: z.number().int(),
    title: z.string(),
    fields: z.array(z.string()).describe('Changed field names, when recorded'),
    restoredFrom: z.number().int().nullable(),
    createdAt: z.string(),
    author: UserRef,
    current: z.boolean().describe('The latest revision = the current working version'),
  })
  .meta({ id: 'RevisionItem' });

const Value = z.object({ path: z.string(), field: z.string(), locale: z.string().nullable(), value: Leaf }).meta({ id: 'RevisionValue' });
const DiffEntry = z
  .object({ path: z.string(), field: z.string(), locale: z.string().nullable(), before: Leaf, after: Leaf })
  .meta({ id: 'RevisionDiffEntry' });

const ReleaseSummary = z
  .object({
    id: Uuid,
    key: z.string(),
    kind: RKind,
    status: Status,
    version: z.number().int(),
    note: z.string().nullable(),
    createdAt: z.string(),
    createdBy: UserRef,
    buildStartedAt: z.string().nullable(),
    buildFinishedAt: z.string().nullable(),
    activatedAt: z.string().nullable(),
    activatedBy: UserRef,
    errors: z.number().int(),
    warnings: z.number().int(),
    failure: z.object({ step: z.string(), message: z.string() }).nullable(),
  })
  .meta({ id: 'ReleaseSummary' });

const LocaleCounts = z.object({ approved: z.number().int(), outdated: z.number().int(), in_progress: z.number().int(), missing: z.number().int() });
const ReleaseDetail = ReleaseSummary.extend({
  previousRelease: z.object({ id: Uuid, key: z.string() }).nullable(),
  isActive: z.boolean(),
  canActivate: z.boolean(),
  canRollback: z.boolean(),
  snapshot: z.object({ id: Uuid, sha256: z.string(), createdAt: z.string(), counts: z.record(z.string(), z.number().int()), records: z.number().int() }),
  translations: z.object({
    locales: z.record(z.string(), LocaleCounts),
    attention: z.array(z.object({ type: Type, key: z.string(), locale: z.string(), state: z.enum(['outdated', 'in_progress', 'missing']) })),
  }),
  changes: z.array(z.object({ type: Type, key: z.string(), title: z.string(), change: z.enum(['added', 'changed', 'removed']), revision: z.number().int().nullable() })),
  validation: z.object({ errors: z.array(z.string()), warnings: z.array(z.string()), checks: z.record(z.string(), z.unknown()) }),
  artifact: z.object({ checksum: z.string(), bytes: z.number().int(), files: z.number().int(), pages: z.number().int() }).nullable().describe('system.read only'),
  hasArtifact: z.boolean(),
  events: z.array(z.object({ at: z.string(), event: z.string(), from: Status.nullable(), to: Status.nullable(), actor: UserRef })),
}).meta({ id: 'ReleaseDetail' });

const Overview = z
  .object({
    active: ReleaseSummary.nullable(),
    lastSuccessful: z.object({ id: Uuid, key: z.string(), activatedAt: z.string().nullable() }).nullable(),
    running: z.array(z.object({ id: Uuid, key: z.string(), kind: RKind, status: Status, createdAt: z.string(), buildStartedAt: z.string().nullable() })),
    recent: z.array(ReleaseSummary),
    failed: z.array(ReleaseSummary),
    pending: z.array(
      z.object({ type: Type, id: Uuid, key: z.string(), title: z.string(), revision: z.number().int(), status: z.string(), liveRevision: z.number().int().nullable(), changedAt: z.string() })
    ),
    currentOnDisk: z.string().nullable().describe('Release the current symlink points to'),
  })
  .meta({ id: 'PublishingOverview' });

export async function publishingRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['publishing'];
  const read = { level: 'full', permission: 'content.read' } as const;

  r.get(
    '/api/v1/revisions',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'Revision history (all records, or one with type + entity)',
        querystring: z.object({
          type: Type.optional(),
          entity: Uuid.optional(),
          kind: Kind.optional(),
          q: z.string().trim().max(100).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(25),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: { 200: z.object({ items: z.array(RevisionItem), total: z.number().int() }), ...problems(400, 401, 403) },
      },
    },
    async (req) => listRevisions(requireDb(deps), { type: req.query.type, id: req.query.entity, kind: req.query.kind, q: req.query.q, limit: req.query.limit, offset: req.query.offset })
  );

  for (const type of TRANSLATABLE_TYPES) {
    const base = `/api/v1/content/${type}/:id`;
    const Params = z.object({ id: Uuid, n: z.coerce.number().int().min(1) });

    r.get(
      `${base}/revisions/:n`,
      {
        config: { access: read },
        schema: {
          tags,
          summary: `One revision of ${type}`,
          params: Params,
          response: { 200: z.object({ revision: RevisionItem, values: z.array(Value) }).meta({ id: 'RevisionDetail' }), ...problems(400, 401, 403, 404) },
        },
      },
      async (req) => {
        const db = requireDb(deps);
        const row = await getRevisionRow(db, type, req.params.id, req.params.n);
        if (!row) throw new Problem('not_found');
        const item = await revisionItem(db, row);
        const values = [...flatten(row.data).entries()].map(([k, v]) => {
          const p = k.split('|')[0]!;
          return { path: p, field: p.split('.')[0]!, locale: v.locale, value: v.value };
        });
        return { revision: item, values };
      }
    );

    r.get(
      `${base}/revisions/:n/compare`,
      {
        config: { access: read },
        schema: {
          tags,
          summary: `Compare a revision of ${type} with the current version (or with another revision)`,
          params: Params,
          querystring: z.object({ with: z.union([z.literal('current'), z.coerce.number().int().min(1)]).default('current') }),
          response: {
            200: z.object({ from: z.number().int(), to: z.number().int(), entries: z.array(DiffEntry), truncated: z.boolean() }).meta({ id: 'RevisionComparison' }),
            ...problems(400, 401, 403, 404),
          },
        },
      },
      async (req) => {
        const db = requireDb(deps);
        const a = await getRevisionRow(db, type, req.params.id, req.params.n);
        const b = req.query.with === 'current' ? await latestRevisionRow(db, type, req.params.id) : await getRevisionRow(db, type, req.params.id, req.query.with);
        if (!a || !b) throw new Problem('not_found');
        return { from: a.number, to: b.number, ...diffRecords(a.data, b.data) };
      }
    );

    r.post(
      `${base}/revisions/:n/restore`,
      {
        config: { access: { level: 'full', permission: 'content.edit' } },
        schema: {
          tags,
          summary: `Restore a revision of ${type} as a new working version`,
          description:
            'Creates a new revision from the old one; nothing is overwritten and the live site does not change until a release is published. Status and slug stay as they are now. If-Match = the record version (ETag of the content record). SEO data needs seo.edit.',
          params: Params,
          headers: IfMatch,
          response: { 200: z.object({ revision: z.number().int(), entityVersion: z.number().int(), fields: z.array(z.string()) }), ...problems(400, 401, 403, 404, 409, 428) },
        },
      },
      async (req, reply) => {
        const res = await restoreRevision(deps, type, authOf(req).user, req.params.id, req.params.n, parseIfMatch(req.headers['if-match']), clientInfo(deps, req));
        reply.header('etag', etag(res.entityVersion));
        return res;
      }
    );

    for (const action of ['publish', 'unpublish'] as const)
      r.post(
        `${base}/${action}`,
        {
          config: { access: { level: 'full', permission: 'content.publish' } },
          schema: {
            tags,
            summary: action === 'publish' ? `Mark a draft of ${type} for publication` : `Take a record of ${type} off the next release`,
            description: 'Changes the working copy only (draft ⇄ published). The live site changes when a release is published. If-Match = record version.',
            params: z.object({ id: Uuid }),
            headers: IfMatch,
            response: { 200: z.object({ status: z.enum(['draft', 'published']), version: z.number().int() }), ...problems(400, 401, 403, 404, 409, 428) },
          },
        },
        async (req, reply) => {
          const res = await setPublished(deps, type, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), action === 'publish', clientInfo(deps, req));
          reply.header('etag', etag(res.version));
          return res;
        }
      );
  }

  r.get(
    '/api/v1/publishing/overview',
    { config: { access: read }, schema: { tags, summary: 'Active release, builds in progress, recent releases, unpublished changes', response: { 200: Overview, ...problems(401, 403) } } },
    async () => publishingOverview(deps)
  );

  r.get(
    '/api/v1/releases',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'Releases and preview builds',
        querystring: z.object({ kind: RKind.optional(), status: Status.optional(), limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0) }),
        response: { 200: z.object({ items: z.array(ReleaseSummary), total: z.number().int() }), ...problems(400, 401, 403) },
      },
    },
    async (req) => listReleases(requireDb(deps), req.query)
  );

  r.get(
    '/api/v1/releases/:id',
    { config: { access: read }, schema: { tags, summary: 'One release: snapshot, changes, validation, history', params: z.object({ id: Uuid }), response: { 200: ReleaseDetail, ...problems(400, 401, 403, 404) } } },
    async (req, reply) => {
      const rel = await getRelease(requireDb(deps), req.params.id, { technical: hasPermission(authOf(req).user.role, 'system.read') });
      reply.header('etag', etag(rel.version));
      return rel;
    }
  );

  const Create = z.object({ note: z.string().trim().max(300).nullable().optional() }).strict();
  r.post(
    '/api/v1/releases',
    {
      config: { access: { level: 'full', permission: 'content.publish' } },
      schema: {
        tags,
        summary: 'Create a release candidate',
        description: 'Captures a snapshot of the published records now (one consistent transaction) and queues its build. Nothing is published yet.',
        body: Create,
        response: { 201: ReleaseDetail, ...problems(400, 401, 403) },
      },
    },
    async (req, reply) => {
      const rel = await createRelease(deps, authOf(req).user, { kind: 'release', note: req.body.note }, clientInfo(deps, req));
      return reply.code(201).header('etag', etag(rel.version)).send(rel);
    }
  );
  r.post(
    '/api/v1/previews',
    {
      config: { access: { level: 'full', permission: ['content.edit', 'seo.edit', 'content.publish'] } },
      schema: {
        tags,
        summary: 'Build a preview of the working copy (drafts included)',
        description: 'A preview build can be opened through a preview link but can never become the live site.',
        body: Create,
        response: { 201: ReleaseDetail, ...problems(400, 401, 403) },
      },
    },
    async (req, reply) => {
      const rel = await createRelease(deps, authOf(req).user, { kind: 'preview', note: req.body.note }, clientInfo(deps, req));
      return reply.code(201).header('etag', etag(rel.version)).send(rel);
    }
  );

  const actionRoute = (action: 'activate' | 'rollback', access: { level: 'full'; permission: 'content.publish' | 'system.rollback'; stepUp?: boolean }, summary: string, description: string) =>
    r.post(
      `/api/v1/releases/:id/${action}`,
      {
        config: { access },
        schema: { tags, summary, description, params: z.object({ id: Uuid }), headers: IfMatch, response: { 200: ReleaseDetail, ...problems(400, 401, 403, 404, 409, 428) } },
      },
      async (req, reply) => {
        const rel = await activateRelease(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), action === 'activate' ? 'publish' : 'rollback', clientInfo(deps, req));
        reply.header('etag', etag(rel.version));
        return rel;
      }
    );
  actionRoute(
    'activate',
    { level: 'full', permission: 'content.publish' },
    'Publish a ready release (switch the live site to it)',
    'Atomic switch of the served artifact; the previous release stays available for rollback. 409 when the release is not ready, older than the live one, or another publication runs.'
  );
  actionRoute(
    'rollback',
    { level: 'full', permission: 'system.rollback', stepUp: true },
    'Roll the live site back to a previously published release',
    'Re-activates the stored artifact of a retired release; no rebuild. Owner / Admin with a fresh second factor.'
  );

  r.post(
    '/api/v1/releases/:id/retry',
    {
      config: { access: { level: 'full', permission: 'system.deploy' } },
      schema: { tags, summary: 'Build a failed release again (same snapshot)', params: z.object({ id: Uuid }), response: { 201: ReleaseDetail, ...problems(400, 401, 403, 404, 409) } },
    },
    async (req, reply) => {
      const rel = await retryRelease(deps, authOf(req).user, req.params.id, clientInfo(deps, req));
      return reply.code(201).header('etag', etag(rel.version)).send(rel);
    }
  );

  r.post(
    '/api/v1/releases/:id/preview',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'One-time preview link for a built release or preview build',
        description: 'Returns a link to the preview origin with a one-time token in the URL fragment (never sent to a server). Valid 30 minutes, bound to this session.',
        params: z.object({ id: Uuid }),
        body: z.object({ path: z.string().max(200).optional() }).strict(),
        response: { 200: z.object({ url: z.string(), expiresAt: z.string() }).meta({ id: 'PreviewLink' }), ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (req, reply) => {
      const a = authOf(req);
      reply.header('cache-control', 'no-store');
      return createPreviewGrant(deps, a.user, a.session, req.params.id, req.body.path ?? '/', clientInfo(deps, req));
    }
  );
  r.post(
    '/api/v1/preview/revoke',
    { config: { access: read }, schema: { tags, summary: 'Close every open preview of the current user', response: { 200: z.object({ revoked: z.number().int() }), ...problems(401, 403) } } },
    async (req) => ({ revoked: await revokePreviewGrants(deps, authOf(req).user, clientInfo(deps, req)) })
  );

}
