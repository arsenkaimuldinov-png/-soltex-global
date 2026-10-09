/**
 * Pages: the fixed pages and detail-page templates of the site (review §G). Their structure is
 * owned by code — @soltex/core/content PAGE_REGISTRY — so pages are listed, read and edited, never
 * created, archived or restructured (no page builder). The editor changes the source-language
 * texts of the existing slots, list items, header and legal body, the named images and the SEO data.
 *
 * Same rules as content collections (service.ts): If-Match versions, field-level authorization,
 * audit in the transaction, translations keep their text and follow structural changes only.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { CONTENT_LOCALES, SOURCE_LOCALE, TRANSLATED_LOCALES } from '@soltex/core/domain';
import { PAGE_REGISTRY, placeholdersMatch, PageCopyV1, type PageDef, type PageKey } from '@soltex/core/content';
import { z } from 'zod';
import type { Queryable } from '../../db/client.ts';
import * as s from '../../db/schema.ts';
import type { ClientInfo, Deps } from '../../deps.ts';
import { requireDb } from '../../deps.ts';
import { recordAudit } from '../../audit/audit.ts';
import { Problem, type FieldError } from '../../http/problem.ts';
import type { UserRow } from '../../auth/sessions.ts';
import { changes, LabelValueItemInput, LIMITS, ListOriginError, sourceValue, TextItemInput, translationValue, validateOrigins } from './fields.ts';
import { authorizeFields, FieldsDenied, refuseFields, trStateOf, type ContentStatus, type RecordView, type TrState, type UserRef } from './service.ts';

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

const line = z.string().trim().min(1).max(LIMITS.line);
const lineNull = z.string().trim().max(LIMITS.line).nullable();
const textNull = z.string().trim().max(LIMITS.text).nullable();

export const PageUpdateInput = z
  .object({
    header: z
      .object({
        badgeNumber: z.string().trim().max(10),
        badgeLabel: line,
        title: line,
        subtitle: lineNull,
        description: textNull,
        meta: z.array(LabelValueItemInput).max(LIMITS.items),
        actionLabel: lineNull,
      })
      .partial()
      .strict()
      .optional(),
    copy: z.record(z.string(), z.string().max(LIMITS.text)).optional().describe('Slot → source-language text; only existing slots'),
    lists: z
      .record(z.string(), z.array(z.record(z.string(), z.string().trim().min(1).max(LIMITS.text))))
      .optional()
      .describe('List key → items (same number, same order) → text field → source-language text'),
    media: z.record(z.string(), z.string().uuid()).optional().describe('Image slot → media id'),
    body: z.array(TextItemInput).max(200).nullable().optional().describe('Legal pages: paragraphs'),
    seoMetaTitle: z.string().trim().max(200).nullable().optional(),
    seoMetaDescription: z.string().trim().max(400).nullable().optional(),
    ogImage: z.string().uuid().nullable().optional(),
    noindex: z.boolean().optional(),
  })
  .strict();
export type PageUpdate = z.infer<typeof PageUpdateInput>;

export const PageFields = z.object({
  header: z
    .object({
      badgeNumber: z.string(),
      badgeLabel: z.string(),
      title: z.string(),
      subtitle: z.string().nullable(),
      description: z.string().nullable(),
      meta: z.array(z.object({ label: z.string(), value: z.string() })),
      actionLabel: z.string().nullable(),
    })
    .nullable(),
  copy: z.record(z.string(), z.string()),
  lists: z.record(z.string(), z.array(z.record(z.string(), z.string()))),
  media: z.record(z.string(), z.string()),
  body: z.array(z.string()).nullable(),
  seoMetaTitle: z.string().nullable(),
  seoMetaDescription: z.string().nullable(),
  ogImage: z.string().nullable(),
  noindex: z.boolean(),
});
export type PageFieldsValue = z.infer<typeof PageFields>;

// ---------------------------------------------------------------------------

type PageRow = typeof s.pages.$inferSelect;
type PageTrRow = typeof s.pageTranslations.$inferSelect;

interface LoadedPage {
  page: PageRow;
  def: PageDef;
  tr: Record<string, PageTrRow>;
  media: Array<{ slot: string; mediaId: string }>;
  items: Array<{ id: string; listKey: string; position: number; structure: unknown; texts: Record<string, Record<string, string>> }>;
}

async function loadPage(db: Queryable, id: string, lock = false): Promise<LoadedPage | null> {
  const q = db.select().from(s.pages).where(eq(s.pages.id, id));
  const [page] = lock ? await q.for('update') : await q;
  if (!page) return null;
  const def = PAGE_REGISTRY[page.pageKey as PageKey];
  if (!def) throw new Error(`page ${page.key}: no registry entry for "${page.pageKey}"`);
  const trRows = await db.select().from(s.pageTranslations).where(eq(s.pageTranslations.pageId, id));
  const tr = Object.fromEntries(trRows.map((r) => [r.locale, r]));
  const media = await db.select({ slot: s.pageMedia.slot, mediaId: s.pageMedia.mediaId }).from(s.pageMedia).where(eq(s.pageMedia.pageId, id)).orderBy(asc(s.pageMedia.position));
  const itemRows = await db.select().from(s.pageListItems).where(eq(s.pageListItems.pageId, id)).orderBy(asc(s.pageListItems.listKey), asc(s.pageListItems.position));
  const itemTr = itemRows.length ? await db.select().from(s.pageListItemTranslations).where(inArray(s.pageListItemTranslations.itemId, itemRows.map((i) => i.id))) : [];
  const items = itemRows.map((i) => ({
    id: i.id,
    listKey: i.listKey,
    position: i.position,
    structure: i.structure,
    texts: Object.fromEntries(itemTr.filter((t) => t.itemId === i.id).map((t) => [t.locale, t.texts as Record<string, string>])),
  }));
  return { page, def, tr, media, items };
}

const path = (field: string) => `$.${field}`;

function fieldsOf(l: LoadedPage): PageFieldsValue {
  const src = l.tr[SOURCE_LOCALE]!;
  const copy = Object.fromEntries(PageCopyV1.parse(src.copy).map((c) => [c.slot, c.text]));
  const lists: Record<string, Array<Record<string, string>>> = {};
  for (const listKey of l.page.listKeys) {
    const textFields = l.def.lists[listKey]?.texts ?? [];
    lists[listKey] = l.items
      .filter((i) => i.listKey === listKey)
      .map((i) => Object.fromEntries(textFields.map((f) => [f, i.texts[SOURCE_LOCALE]?.[path(f)] ?? ''])));
  }
  return {
    header: l.page.hasHeader
      ? {
          badgeNumber: l.page.headerBadgeNumber ?? '',
          badgeLabel: src.headerBadgeLabel ?? '',
          title: src.headerTitle ?? '',
          subtitle: src.headerSubtitle,
          description: src.headerDescription,
          meta: (src.headerMeta as Array<{ label: string; value: string }> | null) ?? [],
          actionLabel: src.headerActionLabel,
        }
      : null,
    copy,
    lists,
    media: Object.fromEntries(l.media.map((m) => [m.slot, m.mediaId])),
    body: (src.body as string[] | null) ?? null,
    seoMetaTitle: src.seoMetaTitle,
    seoMetaDescription: src.seoMetaDescription,
    ogImage: l.page.ogImageId,
    noindex: l.page.noindex,
  };
}

export interface PageView extends Omit<RecordView, 'fields'> {
  pageKey: string;
  kind: 'page' | 'template';
  fields: PageFieldsValue;
}

async function pageView(db: Queryable, l: LoadedPage): Promise<PageView> {
  const p = l.page;
  const [u] = p.updatedBy ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.id, p.updatedBy)) : [];
  const translations = {} as PageView['translations'];
  for (const loc of TRANSLATED_LOCALES) translations[loc] = { status: trStateOf(l.tr[loc], p.sourceRevision), approvedAt: l.tr[loc]?.approvedAt ?? null };
  return {
    id: p.id,
    key: p.key,
    pageKey: p.pageKey,
    kind: p.kind,
    status: p.status as ContentStatus,
    position: p.position,
    version: p.version,
    sourceLocale: p.sourceLocale,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    updatedBy: (u as UserRef | undefined) ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    translations,
    fields: fieldsOf(l),
  };
}

export async function listPages(deps: Deps) {
  const db = requireDb(deps);
  const rows = await db
    .select({ p: s.pages, title: s.pageTranslations.headerTitle })
    .from(s.pages)
    .innerJoin(s.pageTranslations, and(eq(s.pageTranslations.pageId, s.pages.id), eq(s.pageTranslations.locale, SOURCE_LOCALE)))
    .orderBy(asc(s.pages.position), asc(s.pages.key));
  const states = await db
    .select({ owner: s.pageTranslations.pageId, locale: s.pageTranslations.locale, trStatus: s.pageTranslations.trStatus, approvedSourceRevision: s.pageTranslations.approvedSourceRevision })
    .from(s.pageTranslations);
  const userIds = [...new Set(rows.map((r) => r.p.updatedBy).filter((x): x is string => !!x))];
  const users = userIds.length ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, userIds)) : [];
  return {
    items: rows.map((r) => ({
      id: r.p.id,
      key: r.p.key,
      pageKey: r.p.pageKey,
      kind: r.p.kind,
      title: r.title,
      status: r.p.status as ContentStatus,
      position: r.p.position,
      sourceLocale: r.p.sourceLocale,
      updatedAt: r.p.updatedAt.toISOString(),
      updatedBy: users.find((u) => u.id === r.p.updatedBy) ?? null,
      translations: Object.fromEntries(
        TRANSLATED_LOCALES.map((l) => [l, trStateOf(states.find((x) => x.owner === r.p.id && x.locale === l), r.p.sourceRevision)])
      ) as Record<(typeof TRANSLATED_LOCALES)[number], TrState>,
    })),
  };
}

export async function getPage(deps: Deps, id: string): Promise<PageView> {
  const db = requireDb(deps);
  const l = await loadPage(db, id);
  if (!l) throw new Problem('not_found');
  return pageView(db, l);
}

// ---------------------------------------------------------------------------

/** Is a changed page field translated text (Phase F source revision)? Images, badge number, ogImage and noindex are not. */
export const isTranslatedPageField = (name: string): boolean =>
  name.startsWith('copy.') || name.startsWith('lists.') || name === 'body' || name === 'seoMetaTitle' || name === 'seoMetaDescription' || (name.startsWith('header.') && name !== 'header.badgeNumber');

/** Changed field names (for authorization and the audit log): header.title, copy.heroTitle, lists.timeline, media.heroImage, body, seoMetaTitle… */
function changedPageFields(l: LoadedPage, input: PageUpdate, errors: FieldError[]): string[] {
  const cur = fieldsOf(l);
  const out: string[] = [];
  if (input.header) {
    if (!cur.header) errors.push({ field: 'header', message: 'not_on_this_page' });
    else
      for (const [k, v] of Object.entries(input.header)) {
        if (v === undefined) continue;
        const now = (cur.header as Record<string, unknown>)[k];
        const changed = k === 'meta' ? changes('labelValue', v, now) : (v === '' && now === null ? false : v !== now);
        if (changed) out.push(`header.${k}`);
      }
  }
  for (const [slot, text] of Object.entries(input.copy ?? {})) {
    const def = l.def.slots.find((d) => d.key === slot);
    if (!def) errors.push({ field: `copy.${slot}`, message: 'not_on_this_page' });
    else if (text !== cur.copy[slot]) {
      if (!text.trim()) errors.push({ field: `copy.${slot}`, message: 'required' });
      else if (!placeholdersMatch(def, text)) errors.push({ field: `copy.${slot}`, message: 'placeholders' });
      out.push(`copy.${slot}`);
    }
  }
  for (const [listKey, items] of Object.entries(input.lists ?? {})) {
    const def = l.def.lists[listKey];
    const now = cur.lists[listKey];
    if (!def || !now) {
      errors.push({ field: `lists.${listKey}`, message: 'not_on_this_page' });
      continue;
    }
    if (items.length !== now.length || items.some((it) => Object.keys(it).some((k) => !def.texts.includes(k)))) {
      errors.push({ field: `lists.${listKey}`, message: 'structure_is_fixed' });
      continue;
    }
    if (items.some((it, i) => Object.entries(it).some(([k, v]) => v !== now[i]![k]))) out.push(`lists.${listKey}`);
  }
  for (const [slot, mediaId] of Object.entries(input.media ?? {})) {
    if (!l.def.media.includes(slot)) errors.push({ field: `media.${slot}`, message: 'not_on_this_page' });
    else if (mediaId !== cur.media[slot]) out.push(`media.${slot}`);
  }
  if (input.body !== undefined) {
    if (!l.def.body) errors.push({ field: 'body', message: 'not_on_this_page' });
    else if (changes('listNull', input.body, cur.body)) out.push('body');
  }
  for (const k of ['seoMetaTitle', 'seoMetaDescription', 'ogImage', 'noindex'] as const) {
    if (input[k] === undefined) continue;
    if (!l.def.seo) {
      errors.push({ field: k, message: 'not_on_this_page' });
      continue;
    }
    const v = input[k] === '' ? null : input[k];
    if (v !== cur[k]) out.push(k);
  }
  return out;
}

export async function updatePage(deps: Deps, actor: UserRow, id: string, expectedVersion: number, input: PageUpdate, client: ClientInfo): Promise<PageView> {
  try {
    return await writePage(deps, actor, id, expectedVersion, input, client);
  } catch (e) {
    if (e instanceof FieldsDenied) await refuseFields(deps, client, actor, 'page', id, e);
    throw e;
  }
}

async function writePage(deps: Deps, actor: UserRow, id: string, expectedVersion: number, input: PageUpdate, client: ClientInfo): Promise<PageView> {
  const db = requireDb(deps);
  return db.transaction(async (tx) => {
    const l = await loadPage(tx, id, true);
    if (!l) throw new Problem('not_found');
    if (l.page.version !== expectedVersion) throw new Problem('edit_conflict');
    const errors: FieldError[] = [];
    const changed = changedPageFields(l, input, errors);
    if (errors.length) throw new Problem('validation_failed', undefined, { errors });
    if (!changed.length) return pageView(tx, l);

    authorizeFields(actor, changed);

    // Images must exist and be images.
    const mediaIds = [...Object.values(input.media ?? {}), ...(input.ogImage ? [input.ogImage] : [])];
    if (mediaIds.length) {
      const found = await tx.select({ id: s.media.id, kind: s.media.kind }).from(s.media).where(inArray(s.media.id, mediaIds));
      for (const [slot, mid] of [...Object.entries(input.media ?? {}).map(([k, v]) => [`media.${k}`, v]), ...(input.ogImage ? [['ogImage', input.ogImage]] : [])])
        if (!found.some((f) => f.id === mid && f.kind === 'image')) errors.push({ field: slot!, message: 'not_an_image' });
    }
    const src = l.tr[SOURCE_LOCALE]!;
    try {
      if (input.header?.meta !== undefined) validateOrigins('labelValue', input.header.meta, src.headerMeta, 'header.meta');
      if (input.body !== undefined) validateOrigins('listNull', input.body, src.body, 'body');
    } catch (e) {
      if (e instanceof ListOriginError) errors.push({ field: e.message, message: 'invalid_list_origin' });
      else throw e;
    }
    if (errors.length) throw new Problem('validation_failed', undefined, { errors });

    const now = deps.now();
    const has = (name: string) => changed.includes(name);
    const set: Record<string, unknown> = { version: expectedVersion + 1, updatedAt: now, updatedBy: actor.id };
    // Phase F: only a change of translated source text makes approved translations outdated.
    if (changed.some(isTranslatedPageField)) set.sourceRevision = sql`${s.pages.sourceRevision} + 1`;
    if (has('header.badgeNumber')) set.headerBadgeNumber = input.header!.badgeNumber;
    if (has('ogImage')) set.ogImageId = input.ogImage ?? null;
    if (has('noindex')) set.noindex = input.noindex;
    const updated = await tx
      .update(s.pages)
      .set(set)
      .where(and(eq(s.pages.id, id), eq(s.pages.version, expectedVersion)))
      .returning({ id: s.pages.id });
    if (!updated.length) throw new Problem('edit_conflict');

    const textCols = {
      'header.badgeLabel': ['headerBadgeLabel', 'text'],
      'header.title': ['headerTitle', 'text'],
      'header.subtitle': ['headerSubtitle', 'textNull'],
      'header.description': ['headerDescription', 'textNull'],
      'header.actionLabel': ['headerActionLabel', 'textNull'],
      seoMetaTitle: ['seoMetaTitle', 'textNull'],
      seoMetaDescription: ['seoMetaDescription', 'textNull'],
    } as const;
    const valueOf = (name: string): unknown => (name.startsWith('header.') ? (input.header as Record<string, unknown>)[name.slice(7)] : (input as Record<string, unknown>)[name]);

    for (const locale of CONTENT_LOCALES) {
      const cur = l.tr[locale]!;
      // Never-translated languages ('missing') are untranslated copies of the source and follow it.
      const mirror = locale === SOURCE_LOCALE || cur.trStatus === 'missing';
      const row: Record<string, unknown> = {};
      for (const [name, [col, kind]] of Object.entries(textCols)) {
        if (!has(name)) continue;
        const v = valueOf(name);
        row[col] = mirror ? sourceValue(kind, v) : translationValue(kind, v, (src as Record<string, unknown>)[col], (cur as Record<string, unknown>)[col], name);
      }
      if (has('header.meta'))
        row.headerMeta = mirror ? sourceValue('labelValue', input.header!.meta) : translationValue('labelValue', input.header!.meta, src.headerMeta, cur.headerMeta, 'header.meta');
      if (has('body')) row.body = mirror ? sourceValue('listNull', input.body) : translationValue('listNull', input.body, src.body, cur.body, 'body');
      if (mirror && changed.some((c) => c.startsWith('copy.')))
        row.copy = PageCopyV1.parse(cur.copy).map((c) => (input.copy && c.slot in input.copy ? { slot: c.slot, text: input.copy[c.slot] } : c));
      if (Object.keys(row).length)
        await tx
          .update(s.pageTranslations)
          .set({ ...row, version: sql`${s.pageTranslations.version} + 1`, updatedAt: now, updatedBy: actor.id })
          .where(and(eq(s.pageTranslations.pageId, id), eq(s.pageTranslations.locale, locale)));
    }

    // List item texts: the source language and never-translated languages (same items, same structure).
    const mirrored = CONTENT_LOCALES.filter((loc) => loc === SOURCE_LOCALE || l.tr[loc]?.trStatus === 'missing');
    if (changed.some((c) => c.startsWith('lists.')))
      await tx
        .update(s.pageTranslations)
        .set({ version: sql`${s.pageTranslations.version} + 1` })
        .where(and(eq(s.pageTranslations.pageId, id), inArray(s.pageTranslations.locale, [...mirrored])));
    for (const [listKey, items] of Object.entries(input.lists ?? {})) {
      if (!has(`lists.${listKey}`)) continue;
      const rows = l.items.filter((i) => i.listKey === listKey);
      for (const [i, item] of items.entries()) {
        const row = rows[i]!;
        for (const loc of mirrored) {
          const texts = { ...row.texts[loc] };
          for (const [field, text] of Object.entries(item)) texts[path(field)] = text;
          await tx
            .update(s.pageListItemTranslations)
            .set({ texts, updatedAt: now, updatedBy: actor.id })
            .where(and(eq(s.pageListItemTranslations.itemId, row.id), eq(s.pageListItemTranslations.locale, loc)));
        }
      }
    }
    for (const [slot, mediaId] of Object.entries(input.media ?? {}))
      if (has(`media.${slot}`)) await tx.update(s.pageMedia).set({ mediaId }).where(and(eq(s.pageMedia.pageId, id), eq(s.pageMedia.slot, slot)));

    await recordAudit(deps, client, { action: 'content.update', result: 'success', actorId: actor.id, resourceType: 'page', resourceId: id, summary: { fields: changed } }, tx);
    return pageView(tx, (await loadPage(tx, id))!);
  });
}
