/**
 * Translation management (Phase F, docs/admin-translations.md).
 *
 *   GET   /api/v1/translations/overview                                   counts per language and type       content.read
 *   GET   /api/v1/translations                                            list (filters, sort, paging)       content.read
 *   GET   /api/v1/content/{type}/{id}/translations/{locale}               source + target (ETag)             content.read
 *   PATCH /api/v1/content/{type}/{id}/translations/{locale}               save target texts (If-Match)       content.edit | seo.edit, per field
 *   POST  /api/v1/content/{type}/{id}/translations/{locale}/approve       in_progress | outdated → approved  content.publish
 *   POST  /api/v1/content/{type}/{id}/translations/{locale}/reopen        approved | outdated → in_progress  content.publish
 *
 * {type}: pages, projects, technologies, products, epcm-stages, patents, videos.
 * {locale}: a translated language (ru, zh, tr, ar, es); the source language (en) is edited in the
 * content editors (Phase E), never here.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { EFFECTIVE_TRANSLATION_STATES, STORED_TRANSLATION_STATES, TRANSLATED_LOCALES, type TranslatedLocale } from '@soltex/core/domain';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { getTranslation, listTranslations, parseTranslationIfMatch, reviewTranslation, saveTranslation, translationOverview } from '../content/translations/service.ts';
import { problems, Uuid } from './schemas.ts';

const Locale = z.enum(TRANSLATED_LOCALES as unknown as [TranslatedLocale, ...TranslatedLocale[]]);
const Type = z.enum(TRANSLATABLE_TYPES as unknown as [TranslatableType, ...TranslatableType[]]);
const State = z.enum(EFFECTIVE_TRANSLATION_STATES);
const UserRefSchema = z.object({ id: Uuid, name: z.string() }).nullable();

// Values of translatable fields (document.ts). Objects are strict so a page list item is never
// mistaken for a pair or a title/description item.
const Pair = z.object({ label: z.string(), value: z.string() }).strict();
const TitleDesc = z.object({ title: z.string(), description: z.string() }).strict();
const PatentInfo = z.object({ patentNumber: z.string(), location: z.string(), keyPoints: z.array(z.string()) }).strict();
const Value = z
  .union([z.string(), z.array(z.string()), z.array(Pair), z.array(TitleDesc), PatentInfo, z.array(z.record(z.string(), z.string()))])
  .meta({ id: 'TranslationValue', description: 'text · list · pairs · titleDesc · patentInfo · records (see the field kind)' });

const Field = z
  .object({
    name: z.string().describe('copy.<slot>, header.<field>, lists.<key>, body, seoMetaTitle, or a collection field name'),
    kind: z.enum(['text', 'list', 'pairs', 'titleDesc', 'patentInfo', 'records']),
    group: z.enum(['content', 'seo']).describe('seo fields need seo.edit, content fields content.edit'),
    multiline: z.boolean(),
    max: z.number().int(),
    itemFields: z.array(z.string()).optional(),
    placeholders: z.array(z.string()).describe('{name} placeholders the translation must keep'),
    source: Value,
    target: Value.nullable(),
  })
  .meta({ id: 'TranslationField' });

const Summary = z
  .object({
    locale: Locale,
    total: z.number().int(),
    missing: z.number().int(),
    inProgress: z.number().int(),
    outdated: z.number().int(),
    approved: z.number().int(),
    completion: z.number().int().describe('approved for the current source / total, %, rounded down'),
  })
  .meta({ id: 'TranslationLocaleSummary' });

const Overview = z
  .object({
    sourceLocale: z.string(),
    total: z.number().int().describe('Translatable items: non-archived records of the seven types'),
    locales: z.array(Summary),
    types: z.array(z.object({ type: Type, total: z.number().int(), locales: z.array(Summary) })),
  })
  .meta({ id: 'TranslationOverview' });

const ListItem = z
  .object({
    type: Type,
    id: Uuid,
    key: z.string(),
    title: z.string(),
    entityStatus: z.string(),
    locale: Locale,
    state: State,
    sourceRevision: z.number().int(),
    approvedSourceRevision: z.number().int().nullable(),
    sourceChangedSinceEdit: z.boolean(),
    updatedAt: z.string(),
    updatedBy: UserRefSchema,
  })
  .meta({ id: 'TranslationListItem' });

const View = z
  .object({
    type: Type,
    id: Uuid,
    key: z.string(),
    title: z.string(),
    entityStatus: z.string(),
    locale: Locale,
    sourceLocale: z.string(),
    state: State,
    storedState: z.enum(STORED_TRANSLATION_STATES),
    sourceRevision: z.number().int(),
    approvedSourceRevision: z.number().int().nullable(),
    editedSourceRevision: z.number().int().nullable(),
    sourceChangedSinceEdit: z.boolean(),
    approvedAt: z.string().nullable(),
    approvedBy: UserRefSchema,
    updatedAt: z.string(),
    updatedBy: UserRefSchema,
    etag: z.string().describe('Send as If-Match to save, approve or reopen'),
    editable: z.boolean(),
    sameAsSource: z.array(z.string()),
    fields: z.array(Field),
  })
  .meta({ id: 'Translation' });

const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. The ETag of GET, e.g. "3.7" (source revision . row version)') });
const Params = z.object({ id: Uuid, locale: Locale });

export async function translationRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['translations'];
  const read = { level: 'full', permission: 'content.read' } as const;
  const edit = { level: 'full', permission: ['content.edit', 'seo.edit'] } as const;
  const review = { level: 'full', permission: 'content.publish' } as const;

  r.get(
    '/api/v1/translations/overview',
    { config: { access: read }, schema: { tags, summary: 'Translation completeness per language and type', response: { 200: Overview, ...problems(401, 403) } } },
    async () => translationOverview(deps)
  );

  r.get(
    '/api/v1/translations',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'List translations (one row per record and language)',
        querystring: z.object({
          locale: Locale.optional(),
          type: Type.optional(),
          state: z.enum([...EFFECTIVE_TRANSLATION_STATES, 'attention']).optional().describe('attention = everything not approved for the current source'),
          entity: Uuid.optional().describe('Only the translations of one record'),
          q: z.string().trim().max(100).optional().describe('Search in the source-language title and the key'),
          sort: z.enum(['type', 'title', 'updated', 'state']).default('type'),
          limit: z.coerce.number().int().min(1).max(100).default(25),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: { 200: z.object({ items: z.array(ListItem), total: z.number().int() }), ...problems(400, 401, 403) },
      },
    },
    async (request) => listTranslations(deps, request.query)
  );

  for (const type of TRANSLATABLE_TYPES) {
    const base = `/api/v1/content/${type}/:id/translations/:locale`;
    r.get(
      base,
      {
        config: { access: read },
        schema: { tags, summary: `Read a translation of ${type}`, params: Params, response: { 200: View, ...problems(400, 401, 403, 404) } },
      },
      async (request, reply) => {
        const v = await getTranslation(deps, type, request.params.id, request.params.locale);
        reply.header('etag', v.etag);
        return v;
      }
    );
    r.patch(
      base,
      {
        config: { access: edit },
        schema: {
          tags,
          summary: `Save a translation of ${type}`,
          description:
            'Changes the target language only; the structure (fields, list items) stays that of the source. The state becomes in_progress. SEO texts need seo.edit, other texts content.edit. If-Match required; 409 edit_conflict when the source text or this translation changed in between.',
          params: Params,
          headers: IfMatch,
          body: z.object({ fields: z.record(z.string(), Value).describe('Field name → translated value (changed fields)') }).strict().meta({ id: 'TranslationUpdate' }),
          response: { 200: View, ...problems(400, 401, 403, 404, 409, 428) },
        },
      },
      async (request, reply) => {
        const v = await saveTranslation(
          deps,
          type,
          authOf(request).user,
          request.params.id,
          request.params.locale,
          parseTranslationIfMatch(request.headers['if-match']),
          request.body.fields,
          clientInfo(deps, request)
        );
        reply.header('etag', v.etag);
        return v;
      }
    );
    for (const action of ['approve', 'reopen'] as const)
      r.post(
        `${base}/${action}`,
        {
          config: { access: review },
          schema: {
            tags,
            summary: action === 'approve' ? `Approve a translation of ${type}` : `Return an approved translation of ${type} to work`,
            description:
              action === 'approve'
                ? 'in_progress or outdated → approved. Records the source revision that was reviewed. Not for missing translations.'
                : 'approved or outdated → in_progress.',
            params: Params,
            headers: IfMatch,
            response: { 200: View, ...problems(400, 401, 403, 404, 409, 428) },
          },
        },
        async (request, reply) => {
          const v = await reviewTranslation(
            deps,
            type,
            action,
            authOf(request).user,
            request.params.id,
            request.params.locale,
            parseTranslationIfMatch(request.headers['if-match']),
            clientInfo(deps, request)
          );
          reply.header('etag', v.etag);
          return v;
        }
      );
  }
}
