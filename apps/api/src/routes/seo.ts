/**
 * SEO reports (Phase I-1, docs/admin-seo.md). Read-only; the checks themselves live in
 * @soltex/core/seo and also run in the site build, «Отметить к публикации» and «Создать релиз».
 *
 *   GET /api/v1/seo/report                       next release: every issue of every public page   seo.read
 *   GET /api/v1/content/{type}/{id}/seo          one record (as if published): effective title /
 *                                                description / URL per language + its issues      seo.read
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { CONTENT_LOCALES } from '@soltex/core/domain';
import { SEO_ISSUE_CODES, SEO_SEVERITIES } from '@soltex/core/seo';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { Problem } from '../http/problem.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { absoluteUrl, asPublished, issuesOf, recordRefs, runChecks, seoContext } from '../seo/report.ts';
import { mediaSizes } from '../media/service.ts';
import { problems, Uuid } from './schemas.ts';

const Type = z.enum(TRANSLATABLE_TYPES as unknown as [TranslatableType, ...TranslatableType[]]);
const Locale = z.enum(CONTENT_LOCALES);
const Severity = z.enum(SEO_SEVERITIES);
const Code = z.enum(SEO_ISSUE_CODES as unknown as [string, ...string[]]);
const Summary = z.object({ blocking: z.number().int(), warning: z.number().int(), info: z.number().int() }).meta({ id: 'SeoSummary' });

const Issue = z
  .object({
    code: Code,
    severity: Severity,
    type: z.union([Type, z.literal('redirects')]),
    key: z.string(),
    locale: Locale.nullable(),
    field: z.string().nullable().describe('Editor field the issue points to'),
    params: z.record(z.string(), z.union([z.string(), z.number()])),
  })
  .meta({ id: 'SeoIssue' });

const SiteIssue = Issue.extend({
  record: z.object({ id: Uuid, title: z.string(), status: z.string() }).nullable().describe('The record in the admin (null for redirects)'),
}).meta({ id: 'SeoSiteIssue' });

const PageMeta = z
  .object({
    locale: Locale,
    servedLocale: Locale.describe('Language the page is served in (English when the translation is not approved)'),
    url: z.string(),
    path: z.string(),
    title: z.string(),
    description: z.string(),
    titleSource: z.enum(['override', 'default']),
    descriptionSource: z.enum(['override', 'default']),
    indexable: z.boolean(),
  })
  .meta({ id: 'SeoPageMeta' });

export async function seoRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['seo'];
  const read = { level: 'full', permission: 'seo.read' } as const;

  r.get(
    '/api/v1/seo/report',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'SEO check of the next release (all public pages, all languages)',
        querystring: z.object({ severity: Severity.optional(), locale: Locale.optional(), type: z.union([Type, z.literal('redirects')]).optional() }),
        response: {
          200: z.object({ summary: Summary, pages: z.number().int().describe('Public pages checked (route × language)'), issues: z.array(SiteIssue), checkedAt: z.string() }).meta({ id: 'SeoReport' }),
          ...problems(400, 401, 403),
        },
      },
    },
    async (req) => {
      const db = requireDb(deps);
      const ctx = await seoContext(db, undefined, await mediaSizes(deps, db));
      const report = runChecks(ctx);
      const refs = await recordRefs(db, ctx.store);
      const q = req.query;
      const issues = report.issues
        .filter((i) => (!q.severity || i.severity === q.severity) && (!q.locale || i.locale === q.locale) && (!q.type || i.type === q.type))
        .map((i) => ({ ...i, record: i.type === 'redirects' ? null : (refs.get(`${i.type}/${i.key}`) ?? null) }));
      return { summary: report.summary, pages: report.pages.length, issues, checkedAt: deps.now().toISOString() };
    }
  );

  for (const type of TRANSLATABLE_TYPES) {
    r.get(
      `/api/v1/content/${type}/:id/seo`,
      {
        config: { access: read },
        schema: {
          tags,
          summary: `SEO of one ${type} record (as if published)`,
          description: 'Effective title, description and URL per language (what the site renders) and the issues of this record. A draft is checked as if it were published.',
          params: z.object({ id: Uuid }),
          response: {
            200: z.object({ summary: Summary, meta: z.array(PageMeta), issues: z.array(Issue), canPublish: z.boolean().describe('No BLOCKING issue') }).meta({ id: 'SeoRecordReport' }),
            ...problems(400, 401, 403, 404),
          },
        },
      },
      async (req) => {
        const db = requireDb(deps);
        const { rows } = await db.execute(sql`SELECT key FROM ${sql.raw(REVIEW_TABLES[type].entity)} WHERE id = ${req.params.id}`);
        const key = (rows[0] as { key: string } | undefined)?.key;
        if (!key) throw new Problem('not_found');
        const ctx = await seoContext(db, undefined, await mediaSizes(deps, db));
        const report = runChecks(ctx, asPublished(ctx.store, type, key));
        const issues = issuesOf(report, type, key);
        const summary = { blocking: 0, warning: 0, info: 0 };
        for (const i of issues) summary[i.severity]++;
        const meta = report.pages
          .filter((m) => m.type === type && m.key === key)
          .map((m) => ({ locale: m.locale, servedLocale: m.servedLocale, url: absoluteUrl(m), path: m.path, title: m.title, description: m.description, titleSource: m.titleSource, descriptionSource: m.descriptionSource, indexable: m.indexable }));
        return { summary, meta, issues, canPublish: summary.blocking === 0 };
      }
    );
  }
}
