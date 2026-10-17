/**
 * /api/v1/content: content management (Phase E, docs/admin-content.md).
 *
 *   GET    /api/v1/content/{collection}                    list (search, status, sort, paging)    content.read
 *   POST   /api/v1/content/{collection}                    create a draft                          content.edit
 *   GET    /api/v1/content/{collection}/{id}               read (ETag = version)                   content.read
 *   PATCH  /api/v1/content/{collection}/{id}               update (If-Match)                       content.edit | seo.edit, per field
 *   POST   /api/v1/content/{collection}/{id}/archive       draft → archived (If-Match)             content.edit
 *   POST   /api/v1/content/{collection}/{id}/restore       archived → draft (If-Match)             content.edit
 *   GET    /api/v1/content/pages, GET/PATCH …/pages/{id}   fixed pages (no create/archive)
 *   GET    /api/v1/content/media                           existing media for pickers              media.read
 *
 * Collections: projects, technologies, products, epcm-stages, patents, videos. Request and response
 * schemas are generated per collection from content/cms/collections.ts, so the OpenAPI document
 * describes every field of every type.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { EFFECTIVE_TRANSLATION_STATES, SOURCE_LOCALE, TRANSLATED_LOCALES } from '@soltex/core/domain';
import { SLUG_MAX_LENGTH } from '@soltex/core/seo';
import type { Deps } from '../deps.ts';
import { clientInfo, requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import { authOf } from '../auth/guard.ts';
import { COLLECTION_DEFS, COLLECTIONS, requiredOnCreate, type CollectionDef, type EnFieldDef } from '../content/cms/collections.ts';
import { LIMITS, trInputSchema, trOutputSchema } from '../content/cms/fields.ts';
import { createRecord, etag, getRecord, listRecords, parseIfMatch, setArchived, updateRecord } from '../content/cms/service.ts';
import { getPage, listPages, PageFields, PageUpdateInput, updatePage } from '../content/cms/pages.ts';
import { problems, Uuid } from './schemas.ts';

const Status = z.enum(['draft', 'published', 'archived']);
const TrState = z.enum(EFFECTIVE_TRANSLATION_STATES).describe('Effective translation state; outdated = approved for an older source text');
const UserRefSchema = z.object({ id: Uuid, name: z.string() }).nullable();
const TranslationsSummary = z.object(Object.fromEntries(TRANSLATED_LOCALES.map((l) => [l, TrState])) as Record<(typeof TRANSLATED_LOCALES)[number], typeof TrState>);
const TranslationsDetail = z.object(
  Object.fromEntries(TRANSLATED_LOCALES.map((l) => [l, z.object({ status: TrState, approvedAt: z.string().nullable() })])) as Record<
    (typeof TRANSLATED_LOCALES)[number],
    z.ZodObject<{ status: typeof TrState; approvedAt: z.ZodNullable<z.ZodString> }>
  >
);
// Required by the service (428 precondition_required when missing), optional in the schema so a
// missing header is answered with 428, not with a generic validation error.
const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the change is based on (the ETag of GET), e.g. "3"') });

const RecordMeta = {
  id: Uuid,
  key: z.string().describe('Stable content ID (technical)'),
  status: Status,
  position: z.number().int(),
  version: z.number().int().describe('Optimistic lock: send as If-Match when changing the record'),
  sourceLocale: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: UserRefSchema,
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  translations: TranslationsDetail,
};

function enInput(f: EnFieldDef): z.ZodType {
  switch (f.kind) {
    case 'string':
      return z.string().trim().max(f.max ?? LIMITS.line);
    case 'stringNull':
      return z.string().trim().max(f.max ?? LIMITS.line).nullable();
    case 'bool':
      return z.boolean();
    case 'media':
    case 'ref':
      return Uuid;
    case 'mediaNull':
      return Uuid.nullable();
    case 'enumNull':
      return z.enum(f.values as [string, ...string[]]).nullable();
    case 'placements':
      return z.array(z.enum(f.values as [string, ...string[]])).min(1).max(f.values!.length);
    case 'mediaList':
    case 'refList':
      return z.array(Uuid).max(LIMITS.items);
  }
}

function enOutput(f: EnFieldDef): z.ZodType {
  switch (f.kind) {
    case 'string':
      return z.string();
    case 'stringNull':
    case 'mediaNull':
      return z.string().nullable();
    case 'bool':
      return z.boolean();
    case 'media':
    case 'ref':
      return Uuid;
    case 'enumNull':
      return z.enum(f.values as [string, ...string[]]).nullable();
    case 'placements':
      return z.array(z.enum(f.values as [string, ...string[]]));
    case 'mediaList':
    case 'refList':
      return z.array(Uuid);
  }
}

const pascal = (name: string) => name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Request and response schemas of one collection, derived from its description. */
function schemasOf(def: CollectionDef) {
  const base = pascal(def.name);
  const input: Record<string, z.ZodType> = {};
  const output: Record<string, z.ZodType> = {};
  if (def.routable) {
    input.slug = z.string().trim().max(SLUG_MAX_LENGTH).describe('Lowercase Latin letters, digits and hyphens; identical in every language');
    output.slug = z.string();
  }
  for (const f of def.en) {
    input[f.name] = enInput(f);
    output[f.name] = enOutput(f);
  }
  for (const f of def.tr) {
    input[f.name] = trInputSchema(f.kind, f.max);
    output[f.name] = trOutputSchema(f.kind);
  }
  input.position = z.number().int().min(0).max(100000);
  const required = new Set(requiredOnCreate(def));
  const createShape = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, required.has(k) ? v : v.optional()]));
  return {
    create: z.object(createShape).strict().meta({ id: `${base}Create` }),
    update: z
      .object(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v.optional()])))
      .strict()
      .meta({ id: `${base}Update` }),
    record: z.object({ ...RecordMeta, fields: z.object(output).meta({ id: `${base}Fields` }) }).meta({ id: `${base}Record` }),
  };
}

export async function contentRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const read = { level: 'full', permission: 'content.read' } as const;
  const edit = { level: 'full', permission: 'content.edit' } as const;
  const editAny = { level: 'full', permission: ['content.edit', 'seo.edit'] } as const;

  const ListItem = z
    .object({
      id: Uuid,
      key: z.string(),
      title: z.string(),
      slug: z.string().nullable(),
      status: Status,
      position: z.number().int(),
      sourceLocale: z.string(),
      updatedAt: z.string(),
      updatedBy: UserRefSchema,
      translations: TranslationsSummary,
    })
    .meta({ id: 'ContentListItem' });

  for (const name of COLLECTIONS) {
    const def = COLLECTION_DEFS[name];
    const sc = schemasOf(def);
    const base = `/api/v1/content/${name}`;
    const tags = ['content'];

    r.get(
      base,
      {
        config: { access: read },
        schema: {
          tags,
          summary: `List ${name}`,
          querystring: z.object({
            q: z.string().trim().max(100).optional().describe('Search in the source-language title, slug and key'),
            status: Status.optional(),
            sort: z.enum(['position', 'title', 'updated']).default('position'),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
          }),
          response: { 200: z.object({ items: z.array(ListItem), total: z.number().int() }), ...problems(400, 401, 403) },
        },
      },
      async (request) => listRecords(deps, def, request.query)
    );

    r.get(
      `${base}/:id`,
      {
        config: { access: read },
        schema: { tags, summary: `Read one of ${name}`, params: z.object({ id: Uuid }), response: { 200: sc.record, ...problems(401, 403, 404) } },
      },
      async (request, reply) => {
        const rec = await getRecord(deps, def, request.params.id);
        reply.header('etag', etag(rec.version));
        return rec;
      }
    );

    r.post(
      base,
      {
        config: { access: edit },
        schema: {
          tags,
          summary: `Create a draft in ${name}`,
          description:
            'Creates a draft. Required: the title and what cannot be empty (images, relations). Other languages start as untranslated copies. A slug or SEO texts need seo.edit; without a slug one is proposed from the title.',
          body: sc.create,
          response: { 201: sc.record, ...problems(400, 401, 403, 409) },
        },
      },
      async (request, reply) => {
        const rec = await createRecord(deps, def, authOf(request).user, request.body as Record<string, unknown>, clientInfo(deps, request));
        return reply.code(201).header('etag', etag(rec.version)).send(rec);
      }
    );

    r.patch(
      `${base}/:id`,
      {
        config: { access: editAny },
        schema: {
          tags,
          summary: `Update one of ${name}`,
          description:
            'Send only changed fields and If-Match with the version you edited. 409 edit_conflict when someone saved in between. SEO fields need seo.edit, all others content.edit. Lists: each item names its current position (`from`) or null when new, so translations stay attached.',
          params: z.object({ id: Uuid }),
          headers: IfMatch,
          body: sc.update,
          response: { 200: sc.record, ...problems(400, 401, 403, 404, 409, 428) },
        },
      },
      async (request, reply) => {
        const rec = await updateRecord(
          deps,
          def,
          authOf(request).user,
          request.params.id,
          parseIfMatch(request.headers['if-match']),
          request.body as Record<string, unknown>,
          clientInfo(deps, request)
        );
        reply.header('etag', etag(rec.version));
        return rec;
      }
    );

    for (const action of ['archive', 'restore'] as const)
      r.post(
        `${base}/:id/${action}`,
        {
          config: { access: edit },
          schema: {
            tags,
            summary: action === 'archive' ? `Archive a draft of ${name}` : `Restore an archived record of ${name} as a draft`,
            description: 'Published records are unpublished by the publishing system (Phase G), not archived here.',
            params: z.object({ id: Uuid }),
            headers: IfMatch,
            response: { 200: sc.record, ...problems(401, 403, 404, 409, 428) },
          },
        },
        async (request, reply) => {
          const rec = await setArchived(
            deps,
            def,
            authOf(request).user,
            request.params.id,
            parseIfMatch(request.headers['if-match']),
            action === 'archive',
            clientInfo(deps, request)
          );
          reply.header('etag', etag(rec.version));
          return rec;
        }
      );
  }

  // ---- pages --------------------------------------------------------------
  const PageListItem = z
    .object({
      id: Uuid,
      key: z.string(),
      pageKey: z.string(),
      kind: z.enum(['page', 'template']),
      title: z.string().nullable(),
      status: Status,
      position: z.number().int(),
      sourceLocale: z.string(),
      updatedAt: z.string(),
      updatedBy: UserRefSchema,
      translations: TranslationsSummary,
    })
    .meta({ id: 'PageListItem' });
  const PageRecord = z
    .object({ ...RecordMeta, pageKey: z.string(), kind: z.enum(['page', 'template']), fields: PageFields.meta({ id: 'PageFields' }) })
    .meta({ id: 'PageRecord' });

  r.get(
    '/api/v1/content/pages',
    { config: { access: read }, schema: { tags: ['content'], summary: 'List the fixed pages and templates', response: { 200: z.object({ items: z.array(PageListItem) }), ...problems(401, 403) } } },
    async () => listPages(deps)
  );
  r.get(
    '/api/v1/content/pages/:id',
    { config: { access: read }, schema: { tags: ['content'], summary: 'Read a page', params: z.object({ id: Uuid }), response: { 200: PageRecord, ...problems(401, 403, 404) } } },
    async (request, reply) => {
      const p = await getPage(deps, request.params.id);
      reply.header('etag', etag(p.version));
      return p;
    }
  );
  r.patch(
    '/api/v1/content/pages/:id',
    {
      config: { access: editAny },
      schema: {
        tags: ['content'],
        summary: 'Update the texts, images and SEO data of a page',
        description: 'The page structure (slots, list items, images) is owned by code (page registry); only existing slots can be changed.',
        params: z.object({ id: Uuid }),
        headers: IfMatch,
        body: PageUpdateInput.meta({ id: 'PageUpdate' }),
        response: { 200: PageRecord, ...problems(400, 401, 403, 404, 409, 428) },
      },
    },
    async (request, reply) => {
      const p = await updatePage(deps, authOf(request).user, request.params.id, parseIfMatch(request.headers['if-match']), request.body, clientInfo(deps, request));
      reply.header('etag', etag(p.version));
      return p;
    }
  );

  // ---- media for pickers (read-only; uploads are Phase J) -----------------
  const MediaItem = z
    .object({ id: Uuid, key: z.string(), kind: z.enum(['image', 'video']), src: z.string(), width: z.number().int().nullable(), height: z.number().int().nullable(), alt: z.string().nullable(), fileName: z.string(), version: z.number().int() })
    .meta({ id: 'MediaItem' });
  r.get(
    '/api/v1/content/media',
    {
      config: { access: { level: 'full', permission: 'media.read' } },
      schema: {
        tags: ['content'],
        summary: 'Existing media (for pickers)',
        querystring: z.object({ kind: z.enum(['image', 'video']).optional(), q: z.string().trim().max(100).optional() }),
        response: { 200: z.object({ items: z.array(MediaItem) }), ...problems(400, 401, 403) },
      },
    },
    async (request) => {
      const db = requireDb(deps);
      const q = request.query.q ? `%${request.query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      const rows = await db
        .select({ m: s.media, alt: s.mediaTranslations.alt })
        .from(s.media)
        .leftJoin(s.mediaTranslations, and(eq(s.mediaTranslations.mediaId, s.media.id), eq(s.mediaTranslations.locale, SOURCE_LOCALE)))
        .where(and(request.query.kind ? eq(s.media.kind, request.query.kind) : undefined, q ? or(ilike(s.media.key, q), ilike(s.media.src, q), ilike(s.media.originalName, q)) : undefined))
        .orderBy(desc(s.media.createdAt), asc(s.media.key));
      return {
        items: rows.map(({ m, alt }) => ({
          id: m.id,
          key: m.key,
          kind: m.kind,
          src: m.src,
          width: m.width,
          height: m.height,
          alt: alt ?? null,
          fileName: m.originalName ?? decodeURIComponent(m.src.split('/').pop() ?? m.src),
          version: m.version,
        })),
      };
    }
  );
}
