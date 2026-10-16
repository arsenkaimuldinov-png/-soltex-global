/**
 * Redirects (Phase I-2, docs/admin-seo.md §8).
 *
 *   GET    /api/v1/redirects                          list (search, source, paging) + issues       redirects.read
 *   GET    /api/v1/redirects/{id}                     one rule (ETag = version)                     redirects.read
 *   POST   /api/v1/redirects                          create (normalized, collapsed, checked)       redirects.manage
 *   PATCH  /api/v1/redirects/{id}                     change (If-Match)                             redirects.manage
 *   DELETE /api/v1/redirects/{id}                     delete (If-Match)                             redirects.manage
 *   POST   /api/v1/content/{collection}/{id}/slug     change the address of a published record
 *                                                     (+ 301 from the old address, If-Match)        redirects.manage
 *
 *   GET    /internal/v1/redirect                      lookup for nginx (X-Lookup-Path); loopback
 *                                                     only, not under /api, not in OpenAPI          (none)
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CONTENT_LOCALES } from '@soltex/core/domain';
import { PATH_MAX_LENGTH, SEO_ISSUE_CODES, SEO_SEVERITIES, SLUG_MAX_LENGTH } from '@soltex/core/seo';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { COLLECTION_DEFS, COLLECTIONS } from '../content/cms/collections.ts';
import { changeSlug, etag, parseIfMatch } from '../content/cms/service.ts';
import { countHit, createRedirect, deleteRedirect, getRedirect, listRedirects, lookupRedirect, updateRedirect } from '../seo/redirects.ts';
import { NoContent, problems, Uuid } from './schemas.ts';

const Source = z.enum(['manual', 'slug_change', 'import']);
const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the change is based on (the ETag of GET), e.g. "3"') });

const Issue = z
  .object({
    code: z.enum(SEO_ISSUE_CODES as unknown as [string, ...string[]]),
    severity: z.enum(SEO_SEVERITIES),
    type: z.string(),
    key: z.string(),
    locale: z.enum(CONTENT_LOCALES).nullable(),
    field: z.string().nullable(),
    params: z.record(z.string(), z.union([z.string(), z.number()])),
  })
  .meta({ id: 'RedirectIssue' });

const Redirect = z
  .object({
    id: Uuid,
    key: z.string(),
    from: z.string().describe('Source path (decoded, no trailing slash). With allLocales: without a language prefix'),
    to: z.string().describe('Target path on this site'),
    statusCode: z.union([z.literal(301), z.literal(302)]),
    allLocales: z.boolean().describe('Also for /ru, /zh, /tr, /ar and /es + the paths'),
    source: Source,
    hits: z.number().int().describe('Requests served by this rule on the live site'),
    lastHitAt: z.string().nullable(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    updatedBy: z.object({ id: Uuid, name: z.string() }).nullable(),
    issues: z.array(Issue).describe('SEO checks of this rule in the next release'),
  })
  .meta({ id: 'Redirect' });

const RedirectInput = z
  .object({
    from: z.string().trim().min(1).max(PATH_MAX_LENGTH),
    to: z.string().trim().min(1).max(PATH_MAX_LENGTH),
    statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
    allLocales: z.boolean().default(true),
  })
  .strict();

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export async function redirectRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['seo'];
  const read = { level: 'full', permission: 'redirects.read' } as const;
  const manage = { level: 'full', permission: 'redirects.manage' } as const;

  r.get(
    '/api/v1/redirects',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'List redirects',
        querystring: z.object({
          q: z.string().trim().max(200).optional().describe('Search in source and target paths'),
          source: Source.optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: {
          200: z.object({ items: z.array(Redirect), total: z.number().int(), issues: z.object({ blocking: z.number().int(), warning: z.number().int() }).describe('All redirect issues in the next release') }),
          ...problems(400, 401, 403),
        },
      },
    },
    async (req) => listRedirects(deps, req.query)
  );

  r.get(
    '/api/v1/redirects/:id',
    { config: { access: read }, schema: { tags, summary: 'Read one redirect', params: z.object({ id: Uuid }), response: { 200: Redirect, ...problems(401, 403, 404) } } },
    async (req, reply) => {
      const v = await getRedirect(deps, req.params.id);
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.post(
    '/api/v1/redirects',
    {
      config: { access: manage },
      schema: {
        tags,
        summary: 'Create a redirect',
        description:
          'Paths are normalized (this site’s address accepted, percent-escapes decoded, trailing slash dropped). The target is followed through existing rules and rules pointing to the source are rewritten (no chains). 409 redirect_exists for a duplicate source, 409 redirect_rejected for a BLOCKING SEO issue (target missing, shadows a live page, …).',
        body: RedirectInput,
        response: { 201: Redirect, ...problems(400, 401, 403, 409) },
      },
    },
    async (req, reply) => {
      const v = await createRedirect(deps, authOf(req).user, req.body as never, clientInfo(deps, req));
      reply.code(201).header('etag', etag(v.version));
      return v;
    }
  );

  r.patch(
    '/api/v1/redirects/:id',
    {
      config: { access: manage },
      schema: { tags, summary: 'Change a redirect', params: z.object({ id: Uuid }), headers: IfMatch, body: RedirectInput, response: { 200: Redirect, ...problems(400, 401, 403, 404, 409, 428) } },
    },
    async (req, reply) => {
      const v = await updateRedirect(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), req.body as never, clientInfo(deps, req));
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.delete(
    '/api/v1/redirects/:id',
    {
      config: { access: manage },
      schema: { tags, summary: 'Delete a redirect', params: z.object({ id: Uuid }), headers: IfMatch, response: { 204: NoContent, ...problems(401, 403, 404, 409, 428) } },
    },
    async (req, reply) => {
      await deleteRedirect(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), clientInfo(deps, req));
      return reply.code(204).send(null);
    }
  );

  for (const name of COLLECTIONS) {
    const def = COLLECTION_DEFS[name];
    if (!def.routable) continue;
    r.post(
      `/api/v1/content/${name}/:id/slug`,
      {
        config: { access: manage },
        schema: {
          tags: ['content'],
          summary: `Change the address of a published ${def.routable}`,
          description:
            'The slug changes in every language. With `redirect` (default) a 301 from the old address is created for all languages and redirects to the old address are rewritten. Drafts change the slug with PATCH.',
          params: z.object({ id: Uuid }),
          headers: IfMatch,
          body: z.object({ slug: z.string().trim().min(1).max(SLUG_MAX_LENGTH), redirect: z.boolean().default(true) }).strict(),
          response: {
            200: z
              .object({
                id: Uuid,
                slug: z.string(),
                version: z.number().int(),
                redirect: z.object({ from: z.string(), to: z.string() }).nullable(),
                rewritten: z.number().int().describe('Older redirects now pointing to the new address'),
                removed: z.number().int().describe('Redirects removed (from the new address, or reversed)'),
              })
              .meta({ id: 'SlugChangeResult' }),
            ...problems(400, 401, 403, 404, 409, 428),
          },
        },
      },
      async (req, reply) => {
        const res = await changeSlug(deps, def, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), req.body as { slug: string; redirect: boolean }, clientInfo(deps, req));
        reply.header('etag', etag(res.record.version));
        return { id: res.record.id, slug: String(res.record.fields.slug), version: res.record.version, redirect: res.redirect, rewritten: res.rewritten, removed: res.removed };
      }
    );
  }

  // nginx @lookup (approved §11.1–§11.2). Not a general API: one header in, a redirect or 404 out.
  app.get('/internal/v1/redirect', { config: { access: { level: 'public' } }, schema: { hide: true } }, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const raw = req.headers['x-lookup-path'];
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '') || typeof raw !== 'string') return reply.code(404).send();
    const hit = await lookupRedirect(deps, raw);
    if (!hit) {
      req.log.debug('redirect lookup: no match');
      return reply.code(404).send();
    }
    if (hit.key) countHit(deps, hit.key, (e) => req.log.warn({ err: e }, 'redirect hit counter failed'));
    return reply.code(hit.statusCode).header('location', hit.location).send();
  });
}
