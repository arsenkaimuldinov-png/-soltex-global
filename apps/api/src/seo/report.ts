/**
 * SEO reports (Phase I-1, docs/admin-seo.md): the shared checker of @soltex/core/seo applied to
 * the working copy in the database.
 *
 *  - site report   = what the NEXT release would contain (records marked published);
 *  - record report = the same, with this record counted as published (a draft is checked before
 *                    it is marked for publication), filtered to the record;
 *  - blocking issues refuse «Отметить к публикации» (setPublished) and «Создать релиз»
 *    (createRelease); the site build refuses them too (build-snapshots).
 *
 * Computed on request from one export (≈ 50 ms); nothing is stored (deviation I-1: no seo_issues table).
 */
import { sql } from 'drizzle-orm';
import type { ContentStore } from '@soltex/core/content';
import { checkSeo, DEFAULT_SITE_URL, formatSeoIssue, localizedPath, type SeoIssue, type SeoPageMeta, type SeoReport, type SeoTranslationState } from '@soltex/core/seo';
import type { Queryable } from '../db/client.ts';
import { Problem } from '../http/problem.ts';
import { exportStore } from '../content/export.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { effectiveStates } from '../content/translations/service.ts';
import { recordsOf, recordTitle } from '../publishing/revisions.ts';

export interface SeoContext {
  store: ContentStore;
  translationState: (type: TranslatableType, key: string, locale: string) => SeoTranslationState;
}

export async function seoContext(db: Queryable, store?: ContentStore): Promise<SeoContext> {
  const states = new Map<string, SeoTranslationState>();
  for (const s of await effectiveStates(db)) states.set(`${s.type}/${s.key}/${s.locale}`, s.state);
  return { store: store ?? (await exportStore(db)), translationState: (type, key, locale) => states.get(`${type}/${key}/${locale}`) ?? 'missing' };
}

export const runChecks = (ctx: SeoContext, store: ContentStore = ctx.store): SeoReport => checkSeo(store, { translationState: (t, k, l) => ctx.translationState(t, k, l) });

/** The store with one record counted as published (a draft checked before publication). */
export function asPublished(store: ContentStore, type: TranslatableType, key: string): ContentStore {
  const k = REVIEW_TABLES[type].storeKey as keyof ContentStore;
  const list = store[k] as unknown as Array<{ id: string; status: string }>;
  return { ...store, [k]: list.map((r) => (r.id === key && r.status === 'draft' ? { ...r, status: 'published' } : r)) } as ContentStore;
}

export const issuesOf = (report: SeoReport, type: TranslatableType, key: string) => report.issues.filter((i) => i.type === type && i.key === key);

export const absoluteUrl = (m: Pick<SeoPageMeta, 'path' | 'locale'>, siteUrl = DEFAULT_SITE_URL) => `${siteUrl}${localizedPath(m.path, m.locale)}`;

/** Refuse with the blocking issues (RFC 9457 `seo_blocking`; field = editor field or record, message = issue code). */
export function assertNoBlocking(issues: SeoIssue[], detail: string) {
  const blocking = issues.filter((i) => i.severity === 'blocking');
  if (!blocking.length) return;
  throw new Problem('seo_blocking', `${detail} ${blocking.slice(0, 3).map(formatSeoIssue).join('; ')}`, {
    errors: blocking.slice(0, 50).map((i) => ({ field: `${i.type}/${i.key}${i.locale ? `:${i.locale}` : ''}${i.field ? `:${i.field}` : ''}`, message: i.code })),
  });
}

/** Record ids (uuid) and titles of the keys referenced by issues, for links in the admin. */
export async function recordRefs(db: Queryable, store: ContentStore): Promise<Map<string, { id: string; title: string; status: string }>> {
  const out = new Map<string, { id: string; title: string; status: string }>();
  for (const type of TRANSLATABLE_TYPES) {
    const { rows } = await db.execute(sql.raw(`SELECT id, key, status FROM ${REVIEW_TABLES[type].entity}`));
    const titles = new Map(recordsOf(store, type).map((r) => [r.id, recordTitle(type, r)]));
    for (const r of rows as Array<{ id: string; key: string; status: string }>) out.set(`${type}/${r.key}`, { id: r.id, title: titles.get(r.key) ?? r.key, status: r.status });
  }
  return out;
}
