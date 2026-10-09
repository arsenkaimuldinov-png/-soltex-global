/**
 * Translation management (Phase F, docs/admin-translations.md).
 *
 *  - Overview and list: one UNION ALL query over the seven entity types (no N+1); the effective
 *    state ("outdated" included) is computed in SQL with the same rule as
 *    @soltex/core/domain effectiveTranslationState.
 *  - Read: source and target values of every translatable field (document.ts).
 *  - Save: changes the TARGET language row only (never the source), keeps the structure of the
 *    source, sets the state to in_progress. Field-level authorization as in Phase E (SEO texts need
 *    seo.edit, other texts content.edit).
 *  - Approve / reopen: content.publish. Approval records the source revision it reviewed.
 *  - Concurrency: ETag "<sourceRevision>.<rowVersion>" of the target row. A source text change or
 *    another save of the same language in between → 409 edit_conflict.
 *  - Every change is audited in its transaction; refusals are audited after rollback.
 */
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import {
  SOURCE_LOCALE,
  TRANSLATED_LOCALES,
  deniedTranslationFields,
  effectiveTranslationState,
  nextTranslationState,
  translationCompletion,
  type EffectiveTranslationState,
  type StoredTranslationState,
  type TranslatedLocale,
} from '@soltex/core/domain';
import { PAGE_REGISTRY, PageCopyV1, type PageKey } from '@soltex/core/content';
import type { Queryable } from '../../db/client.ts';
import * as s from '../../db/schema.ts';
import type { ClientInfo, Deps } from '../../deps.ts';
import { requireDb } from '../../deps.ts';
import { recordAudit } from '../../audit/audit.ts';
import { Problem, type FieldError } from '../../http/problem.ts';
import type { UserRow } from '../../auth/sessions.ts';
import { COLLECTION_DEFS, type CollectionName } from '../cms/collections.ts';
import { LIMITS } from '../cms/fields.ts';
import { recordRevision } from '../../publishing/revisions.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../review-tables.ts';
import { type TranslationValue, groupOf, hasSourceText, kindOfTr, placeholdersOfValue, textsOf, validateValue, type DocumentField, type FieldSpec } from './document.ts';

type AnyTable = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface UserRef {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// ETag
// ---------------------------------------------------------------------------

export const translationEtag = (sourceRevision: number, version: number) => `"${sourceRevision}.${version}"`;

export function parseTranslationIfMatch(header: string | undefined): { sourceRevision: number; version: number } {
  if (!header) throw new Problem('precondition_required');
  const m = header.trim().match(/^(?:W\/)?"?(\d{1,9})\.(\d{1,9})"?$/);
  if (!m) throw new Problem('precondition_required');
  return { sourceRevision: Number(m[1]), version: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// Overview and list (SQL over all types)
// ---------------------------------------------------------------------------

const STATE_SQL = `CASE WHEN x.tr_status = 'approved' AND x.approved_source_revision >= e.source_revision THEN 'approved'
  WHEN x.tr_status = 'approved' THEN 'outdated' ELSE coalesce(x.tr_status::text, 'missing') END`;

/** One row per (non-archived entity, translated language) of every type. */
function unionSql(): string {
  return TRANSLATABLE_TYPES.map((type, i) => {
    const r = REVIEW_TABLES[type];
    return `SELECT '${type}'::text AS type, ${i} AS type_order, e.id, e.key, e.status::text AS entity_status, e.position,
  e.source_revision, ${r.title} AS title, x.locale, x.tr_status::text AS stored_state, ${STATE_SQL} AS state,
  x.approved_source_revision, x.edited_source_revision, x.updated_at, x.updated_by
FROM ${r.entity} e
JOIN ${r.tr} t ON t.${r.owner} = e.id AND t.locale = '${SOURCE_LOCALE}'
JOIN ${r.tr} x ON x.${r.owner} = e.id AND x.locale <> '${SOURCE_LOCALE}'
WHERE e.status <> 'archived'`;
  }).join('\nUNION ALL\n');
}

/** Effective translation state of every (non-archived record, translated language) — one query. */
export async function effectiveStates(db: Queryable): Promise<Array<{ type: TranslatableType; key: string; entityStatus: string; locale: TranslatedLocale; state: EffectiveTranslationState }>> {
  const { rows } = await db.execute(sql.raw(`SELECT type, key, entity_status, locale, state FROM (${unionSql()}) u ORDER BY type_order, position, key, locale`));
  return (rows as Array<{ type: TranslatableType; key: string; entity_status: string; locale: TranslatedLocale; state: EffectiveTranslationState }>).map((r) => ({
    type: r.type,
    key: r.key,
    entityStatus: r.entity_status,
    locale: r.locale,
    state: r.state,
  }));
}

export interface LocaleSummary {
  locale: TranslatedLocale;
  total: number;
  missing: number;
  inProgress: number;
  outdated: number;
  approved: number;
  /** approved / total, rounded down, 0–100 */
  completion: number;
}

export interface Overview {
  sourceLocale: string;
  /** Translatable items (non-archived entities of the seven types). */
  total: number;
  locales: LocaleSummary[];
  types: Array<{ type: TranslatableType; total: number; locales: LocaleSummary[] }>;
}

const emptySummary = (locale: TranslatedLocale): LocaleSummary => ({ locale, total: 0, missing: 0, inProgress: 0, outdated: 0, approved: 0, completion: 0 });

function add(sum: LocaleSummary, state: EffectiveTranslationState, n: number) {
  sum.total += n;
  if (state === 'missing') sum.missing += n;
  else if (state === 'in_progress') sum.inProgress += n;
  else if (state === 'outdated') sum.outdated += n;
  else sum.approved += n;
  sum.completion = translationCompletion(sum.approved, sum.total);
}

export async function translationOverview(deps: Deps): Promise<Overview> {
  const db = requireDb(deps);
  const { rows } = await db.execute(sql.raw(`SELECT type, locale, state, count(*)::int AS n FROM (${unionSql()}) u GROUP BY type, locale, state`));
  const all = new Map(TRANSLATED_LOCALES.map((l) => [l, emptySummary(l)]));
  const byType = new Map(TRANSLATABLE_TYPES.map((t) => [t, new Map(TRANSLATED_LOCALES.map((l) => [l, emptySummary(l)]))]));
  for (const r of rows as Array<{ type: TranslatableType; locale: TranslatedLocale; state: EffectiveTranslationState; n: number }>) {
    if (!all.has(r.locale)) continue;
    add(all.get(r.locale)!, r.state, r.n);
    add(byType.get(r.type)!.get(r.locale)!, r.state, r.n);
  }
  const locales = [...all.values()];
  return {
    sourceLocale: SOURCE_LOCALE,
    total: locales[0]?.total ?? 0,
    locales,
    types: TRANSLATABLE_TYPES.map((type) => {
      const ls = [...byType.get(type)!.values()];
      return { type, total: ls[0]?.total ?? 0, locales: ls };
    }),
  };
}

export interface TranslationListQuery {
  locale?: TranslatedLocale;
  type?: TranslatableType;
  state?: EffectiveTranslationState | 'attention';
  entity?: string;
  q?: string;
  sort: 'type' | 'title' | 'updated' | 'state';
  limit: number;
  offset: number;
}

export interface TranslationListItem {
  type: TranslatableType;
  id: string;
  key: string;
  title: string;
  entityStatus: string;
  locale: TranslatedLocale;
  state: EffectiveTranslationState;
  sourceRevision: number;
  approvedSourceRevision: number | null;
  sourceChangedSinceEdit: boolean;
  updatedAt: string;
  updatedBy: UserRef | null;
}

export async function listTranslations(deps: Deps, q: TranslationListQuery): Promise<{ items: TranslationListItem[]; total: number }> {
  const db = requireDb(deps);
  const where: SQL[] = [sql`true`];
  if (q.locale) where.push(sql`u.locale = ${q.locale}`);
  if (q.type) where.push(sql`u.type = ${q.type}`);
  if (q.state === 'attention') where.push(sql`u.state <> 'approved'`);
  else if (q.state) where.push(sql`u.state = ${q.state}`);
  if (q.entity) where.push(sql`u.id = ${q.entity}::uuid`);
  if (q.q?.trim()) {
    const like = `%${q.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(u.title ILIKE ${like} OR u.key ILIKE ${like})`);
  }
  const stateOrder = sql.raw(`CASE u.state WHEN 'outdated' THEN 0 WHEN 'missing' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END`);
  const localeOrder = sql.raw(`array_position(ARRAY[${TRANSLATED_LOCALES.map((l) => `'${l}'`).join(',')}]::text[], u.locale)`);
  const order =
    q.sort === 'title'
      ? sql`u.title COLLATE "C", u.type_order, ${localeOrder}`
      : q.sort === 'updated'
        ? sql`u.updated_at DESC, u.type_order, u.position, ${localeOrder}`
        : q.sort === 'state'
          ? sql`${stateOrder}, u.type_order, u.position, u.key, ${localeOrder}`
          : sql`u.type_order, u.position, u.key, ${localeOrder}`;
  const { rows } = await db.execute(sql`
    SELECT u.*, count(*) OVER ()::int AS total FROM (${sql.raw(unionSql())}) u
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${order}
    LIMIT ${q.limit} OFFSET ${q.offset}`);
  const list = rows as Row[];
  const users = await userRefs(db, list.map((r) => r.updated_by));
  return {
    total: list.length ? Number(list[0]!.total) : await countOnly(db, where),
    items: list.map((r) => ({
      type: r.type,
      id: r.id,
      key: r.key,
      title: r.title ?? r.key,
      entityStatus: r.entity_status,
      locale: r.locale,
      state: r.state,
      sourceRevision: r.source_revision,
      approvedSourceRevision: r.approved_source_revision,
      sourceChangedSinceEdit: r.state === 'in_progress' && r.edited_source_revision !== null && r.edited_source_revision < r.source_revision,
      updatedAt: new Date(r.updated_at).toISOString(),
      updatedBy: r.updated_by ? users.get(r.updated_by) ?? null : null,
    })),
  };
}

/** Total when the requested page is past the end (no rows to carry the window count). */
async function countOnly(db: Queryable, where: SQL[]): Promise<number> {
  const { rows } = await db.execute(sql`SELECT count(*)::int AS n FROM (${sql.raw(unionSql())}) u WHERE ${sql.join(where, sql` AND `)}`);
  return Number((rows[0] as { n: number }).n);
}

async function userRefs(db: Queryable, ids: Array<string | null>): Promise<Map<string, UserRef>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

// ---------------------------------------------------------------------------
// One translation: loading as a document
// ---------------------------------------------------------------------------

interface Loaded {
  type: TranslatableType;
  entity: Row;
  source: Row;
  target: Row;
  title: string;
  fields: DocumentField[];
  /** Page list items (pages only): id per list key, in order. */
  items: Array<{ id: string; listKey: string; sourceTexts: Record<string, string>; targetTexts: Record<string, string> }>;
}

const pathOf = (field: string) => `$.${field}`;

async function loadCollection(db: Queryable, name: CollectionName, id: string, locale: TranslatedLocale, lock: boolean): Promise<Loaded | null> {
  const def = COLLECTION_DEFS[name];
  const t = def.table as AnyTable;
  const tr = def.trTable as AnyTable;
  const q = db.select().from(t).where(eq(t.id, id));
  const [entity] = lock ? await q.for('update') : await q;
  if (!entity) return null;
  const rows = await db.select().from(tr).where(and(eq(tr[def.trOwner], id), inArray(tr.locale, [SOURCE_LOCALE, locale])));
  const source = rows.find((r: Row) => r.locale === SOURCE_LOCALE);
  const target = rows.find((r: Row) => r.locale === locale);
  if (!source || !target) throw new Error(`${name} ${id}: missing ${SOURCE_LOCALE}/${locale} translation row`);
  const fields: DocumentField[] = [];
  for (const f of def.tr) {
    const kind = kindOfTr(f.kind);
    const src = source[f.column] ?? null;
    if (!hasSourceText(kind, src)) continue;
    const max = f.max ?? LIMITS.text;
    fields.push({
      name: f.name,
      kind,
      group: groupOf(f.name),
      multiline: kind === 'text' && max > LIMITS.line,
      max,
      placeholders: placeholdersOfValue(kind, src),
      source: src as TranslationValue,
      target: (target[f.column] ?? null) as TranslationValue | null,
    });
  }
  return { type: name, entity, source, target, title: source[def.titleField] ?? entity.key, fields, items: [] };
}

const PAGE_HEADER: Array<{ name: string; column: string; kind: 'text' | 'pairs'; max: number }> = [
  { name: 'header.badgeLabel', column: 'headerBadgeLabel', kind: 'text', max: LIMITS.line },
  { name: 'header.title', column: 'headerTitle', kind: 'text', max: LIMITS.line },
  { name: 'header.subtitle', column: 'headerSubtitle', kind: 'text', max: LIMITS.line },
  { name: 'header.description', column: 'headerDescription', kind: 'text', max: LIMITS.text },
  { name: 'header.meta', column: 'headerMeta', kind: 'pairs', max: LIMITS.item },
  { name: 'header.actionLabel', column: 'headerActionLabel', kind: 'text', max: LIMITS.line },
];
const PAGE_SEO = [
  { name: 'seoMetaTitle', column: 'seoMetaTitle', max: 200 },
  { name: 'seoMetaDescription', column: 'seoMetaDescription', max: 400 },
];

async function loadPage(db: Queryable, id: string, locale: TranslatedLocale, lock: boolean): Promise<Loaded | null> {
  const q = db.select().from(s.pages).where(eq(s.pages.id, id));
  const [page] = lock ? await q.for('update') : await q;
  if (!page) return null;
  const def = PAGE_REGISTRY[page.pageKey as PageKey];
  if (!def) throw new Error(`page ${page.key}: no registry entry`);
  const rows = await db.select().from(s.pageTranslations).where(and(eq(s.pageTranslations.pageId, id), inArray(s.pageTranslations.locale, [SOURCE_LOCALE, locale])));
  const source = rows.find((r) => r.locale === SOURCE_LOCALE) as Row | undefined;
  const target = rows.find((r) => r.locale === locale) as Row | undefined;
  if (!source || !target) throw new Error(`page ${page.key}: missing ${SOURCE_LOCALE}/${locale} translation row`);

  const fields: DocumentField[] = [];
  const push = (spec: FieldSpec, src: unknown, tgt: unknown) => {
    if (hasSourceText(spec.kind, src)) fields.push({ ...spec, placeholders: placeholdersOfValue(spec.kind, src), source: src as TranslationValue, target: tgt as TranslationValue | null });
  };
  if (page.hasHeader)
    for (const h of PAGE_HEADER)
      push({ name: h.name, kind: h.kind, group: 'content', multiline: h.max > LIMITS.line, max: h.max }, source[h.column] ?? null, target[h.column] ?? null);
  const srcCopy = PageCopyV1.parse(source.copy);
  const tgtCopy = PageCopyV1.parse(target.copy);
  for (const slot of def.slots) {
    const src = srcCopy.find((c) => c.slot === slot.key)?.text ?? null;
    push({ name: `copy.${slot.key}`, kind: 'text', group: 'content', multiline: slot.multiline, max: LIMITS.text }, src, tgtCopy.find((c) => c.slot === slot.key)?.text ?? null);
  }
  const itemRows = await db
    .select()
    .from(s.pageListItems)
    .where(eq(s.pageListItems.pageId, id))
    .orderBy(asc(s.pageListItems.listKey), asc(s.pageListItems.position));
  const itemTr = itemRows.length
    ? await db
        .select()
        .from(s.pageListItemTranslations)
        .where(and(inArray(s.pageListItemTranslations.itemId, itemRows.map((i) => i.id)), inArray(s.pageListItemTranslations.locale, [SOURCE_LOCALE, locale])))
    : [];
  const items = itemRows.map((i) => ({
    id: i.id,
    listKey: i.listKey,
    sourceTexts: (itemTr.find((x) => x.itemId === i.id && x.locale === SOURCE_LOCALE)?.texts ?? {}) as Record<string, string>,
    targetTexts: (itemTr.find((x) => x.itemId === i.id && x.locale === locale)?.texts ?? {}) as Record<string, string>,
  }));
  for (const listKey of page.listKeys) {
    const textFields = def.lists[listKey]?.texts ?? [];
    const of = items.filter((i) => i.listKey === listKey);
    if (!textFields.length || !of.length) continue;
    const pick = (texts: Record<string, string>) => Object.fromEntries(textFields.filter((f) => pathOf(f) in texts).map((f) => [f, texts[pathOf(f)]!]));
    push(
      { name: `lists.${listKey}`, kind: 'records', group: 'content', multiline: true, max: LIMITS.text, itemFields: [...textFields] },
      of.map((i) => pick(i.sourceTexts)),
      of.map((i) => pick(i.targetTexts))
    );
  }
  if (def.body) push({ name: 'body', kind: 'list', group: 'content', multiline: true, max: LIMITS.item }, source.body ?? null, target.body ?? null);
  if (def.seo)
    for (const f of PAGE_SEO) push({ name: f.name, kind: 'text', group: 'seo', multiline: f.max > LIMITS.line, max: f.max }, source[f.column] ?? null, target[f.column] ?? null);
  return { type: 'pages', entity: page as Row, source, target, title: source.headerTitle ?? page.pageKey, fields, items };
}

async function loadTranslation(db: Queryable, type: TranslatableType, id: string, locale: TranslatedLocale, lock = false): Promise<Loaded> {
  const l = type === 'pages' ? await loadPage(db, id, locale, lock) : await loadCollection(db, type, id, locale, lock);
  if (!l) throw new Problem('not_found');
  return l;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export interface TranslationView {
  type: TranslatableType;
  id: string;
  key: string;
  title: string;
  entityStatus: string;
  locale: TranslatedLocale;
  sourceLocale: string;
  state: EffectiveTranslationState;
  storedState: StoredTranslationState;
  sourceRevision: number;
  approvedSourceRevision: number | null;
  editedSourceRevision: number | null;
  sourceChangedSinceEdit: boolean;
  approvedAt: string | null;
  approvedBy: UserRef | null;
  updatedAt: string;
  updatedBy: UserRef | null;
  /** ETag value: send it as If-Match when saving, approving or reopening. */
  etag: string;
  /** False for archived records (read-only). */
  editable: boolean;
  /** Fields whose translation is still identical to the source text (hint for reviewers). */
  sameAsSource: string[];
  fields: DocumentField[];
}

const stateOf = (l: Loaded): EffectiveTranslationState =>
  effectiveTranslationState((l.target.trStatus ?? null) as StoredTranslationState | null, l.target.approvedSourceRevision ?? null, l.entity.sourceRevision);

async function view(db: Queryable, l: Loaded): Promise<TranslationView> {
  const users = await userRefs(db, [l.target.updatedBy, l.target.approvedBy]);
  const state = stateOf(l);
  const edited = l.target.editedSourceRevision ?? null;
  return {
    type: l.type,
    id: l.entity.id,
    key: l.entity.key,
    title: l.title,
    entityStatus: l.entity.status,
    locale: l.target.locale,
    sourceLocale: SOURCE_LOCALE,
    state,
    storedState: (l.target.trStatus ?? 'missing') as StoredTranslationState,
    sourceRevision: l.entity.sourceRevision,
    approvedSourceRevision: l.target.approvedSourceRevision ?? null,
    editedSourceRevision: edited,
    sourceChangedSinceEdit: state === 'in_progress' && edited !== null && edited < l.entity.sourceRevision,
    approvedAt: l.target.approvedAt ?? null,
    approvedBy: l.target.approvedBy ? users.get(l.target.approvedBy) ?? null : null,
    updatedAt: (l.target.updatedAt as Date).toISOString(),
    updatedBy: l.target.updatedBy ? users.get(l.target.updatedBy) ?? null : null,
    etag: translationEtag(l.entity.sourceRevision, l.target.version),
    editable: l.entity.status !== 'archived',
    sameAsSource: state === 'missing' ? [] : l.fields.filter((f) => JSON.stringify(textsOf(f.kind, f.source)) === JSON.stringify(textsOf(f.kind, f.target))).map((f) => f.name),
    fields: l.fields,
  };
}

export async function getTranslation(deps: Deps, type: TranslatableType, id: string, locale: TranslatedLocale): Promise<TranslationView> {
  const db = requireDb(deps);
  return view(db, await loadTranslation(db, type, id, locale));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Raised inside a write transaction when a role may not change some fields (audited after rollback). */
export class TranslationFieldsDenied extends Error {
  constructor(readonly fields: string[]) {
    super('fields denied');
  }
}

function checkPreconditions(l: Loaded, expected: { sourceRevision: number; version: number }) {
  if (l.entity.sourceRevision !== expected.sourceRevision || l.target.version !== expected.version) throw new Problem('edit_conflict');
  if (l.entity.status === 'archived') throw new Problem('invalid_transition', 'Запись в архиве: её переводы доступны только для чтения.');
}

const audited = (type: TranslatableType) => REVIEW_TABLES[type].resourceType;

async function refuse(deps: Deps, client: ClientInfo, actor: UserRow, type: TranslatableType, id: string, locale: string, e: TranslationFieldsDenied): Promise<never> {
  await recordAudit(deps, client, { action: 'translation.update', result: 'denied', actorId: actor.id, resourceType: audited(type), resourceId: id, summary: { locale, fields: e.fields } });
  throw new Problem('forbidden', 'Эти поля перевода нельзя изменять с вашей ролью.', { errors: e.fields.map((field) => ({ field, message: 'not_allowed' })) });
}

/**
 * Save target-language texts. `input` = field name → new value (only fields to change; unchanged
 * values are ignored). Result state: in_progress. A save without changes of a `missing`
 * translation marks it in_progress too (the translator confirms the copied texts as a start).
 */
export async function saveTranslation(
  deps: Deps,
  type: TranslatableType,
  actor: UserRow,
  id: string,
  locale: TranslatedLocale,
  expected: { sourceRevision: number; version: number },
  input: Record<string, unknown>,
  client: ClientInfo
): Promise<TranslationView> {
  const db = requireDb(deps);
  try {
    return await db.transaction(async (tx) => {
      const l = await loadTranslation(tx, type, id, locale, true);
      checkPreconditions(l, expected);
      const before = stateOf(l);

      const errors: FieldError[] = [];
      const changed: Array<{ field: DocumentField; value: unknown }> = [];
      for (const [name, raw] of Object.entries(input)) {
        const field = l.fields.find((f) => f.name === name);
        if (!field) {
          errors.push({ field: name, message: 'not_translatable' });
          continue;
        }
        if (JSON.stringify(raw) === JSON.stringify(field.target)) continue;
        const r = validateValue(field, field.source, raw);
        if ('error' in r) errors.push({ field: name, message: r.error });
        else if (JSON.stringify(r.value) !== JSON.stringify(field.target)) changed.push({ field, value: r.value });
      }
      if (errors.length) throw new Problem('validation_failed', undefined, { errors });
      if (!changed.length && before !== 'missing') return view(tx, l);

      // Field-level authorization (only what changes). Confirming a missing translation is a content action.
      const names = changed.length ? changed.map((c) => c.field.name) : ['content'];
      const denied = deniedTranslationFields(actor.role, names);
      if (denied.length) throw new TranslationFieldsDenied(denied);

      const now = deps.now();
      await writeValues(tx, l, changed, now, actor.id);
      const tr = trTable(type);
      const updated = await tx
        .update(tr.table)
        .set({ trStatus: 'in_progress', editedSourceRevision: l.entity.sourceRevision, version: sql`${tr.table.version} + 1`, updatedAt: now, updatedBy: actor.id })
        .where(and(eq(tr.table[tr.owner], id), eq(tr.table.locale, locale), eq(tr.table.version, expected.version)))
        .returning({ v: tr.table.version });
      if (!updated.length) throw new Problem('edit_conflict');
      await recordRevision(tx, { type, id, kind: 'translation', actorId: actor.id, locale, summary: { fields: changed.map((c) => c.field.name) } });
      await recordAudit(
        deps,
        client,
        {
          action: 'translation.update',
          result: 'success',
          actorId: actor.id,
          resourceType: audited(type),
          resourceId: id,
          summary: { locale, fields: changed.map((c) => c.field.name), previous_status: before, status: 'in_progress', revision: l.entity.sourceRevision },
        },
        tx
      );
      return view(tx, await loadTranslation(tx, type, id, locale));
    });
  } catch (e) {
    if (e instanceof TranslationFieldsDenied) await refuse(deps, client, actor, type, id, locale, e);
    throw e;
  }
}

function trTable(type: TranslatableType): { table: AnyTable; owner: string } {
  if (type === 'pages') return { table: s.pageTranslations, owner: 'pageId' };
  const def = COLLECTION_DEFS[type];
  return { table: def.trTable, owner: def.trOwner };
}

async function writeValues(tx: Queryable, l: Loaded, changed: Array<{ field: DocumentField; value: unknown }>, now: Date, actorId: string) {
  if (!changed.length) return;
  const { table, owner } = trTable(l.type);
  const set: Record<string, unknown> = {};
  if (l.type !== 'pages') {
    const def = COLLECTION_DEFS[l.type];
    for (const c of changed) set[def.tr.find((f) => f.name === c.field.name)!.column] = c.value;
  } else {
    let copy = PageCopyV1.parse(l.target.copy);
    for (const c of changed) {
      const n = c.field.name;
      const header = PAGE_HEADER.find((h) => h.name === n);
      const seo = PAGE_SEO.find((h) => h.name === n);
      if (header) set[header.column] = c.value;
      else if (seo) set[seo.column] = c.value;
      else if (n === 'body') set.body = c.value;
      else if (n.startsWith('copy.')) {
        const slot = n.slice(5);
        copy = copy.map((x) => (x.slot === slot ? { slot, text: c.value as string } : x));
        set.copy = copy;
      } else if (n.startsWith('lists.')) {
        const listKey = n.slice(6);
        const items = l.items.filter((i) => i.listKey === listKey);
        for (const [i, values] of (c.value as Array<Record<string, string>>).entries()) {
          const item = items[i]!;
          const texts = { ...item.targetTexts };
          for (const [f, v] of Object.entries(values)) texts[pathOf(f)] = v;
          await tx
            .update(s.pageListItemTranslations)
            .set({ texts, updatedAt: now, updatedBy: actorId })
            .where(and(eq(s.pageListItemTranslations.itemId, item.id), eq(s.pageListItemTranslations.locale, l.target.locale)));
        }
      }
    }
  }
  if (Object.keys(set).length) await tx.update(table).set(set).where(and(eq(table[owner], l.entity.id), eq(table.locale, l.target.locale)));
}

/** Approve (in_progress | outdated → approved) or reopen (approved | outdated → in_progress). content.publish (route). */
export async function reviewTranslation(
  deps: Deps,
  type: TranslatableType,
  action: 'approve' | 'reopen',
  actor: UserRow,
  id: string,
  locale: TranslatedLocale,
  expected: { sourceRevision: number; version: number },
  client: ClientInfo
): Promise<TranslationView> {
  const db = requireDb(deps);
  return db.transaction(async (tx) => {
    const l = await loadTranslation(tx, type, id, locale, true);
    checkPreconditions(l, expected);
    const before = stateOf(l);
    const next = nextTranslationState(action, before);
    if (!next)
      throw new Problem(
        'invalid_transition',
        action === 'approve'
          ? before === 'missing'
            ? 'Перевода ещё нет: сначала сохраните переведённый текст.'
            : 'Перевод уже утверждён.'
          : 'Перевод не утверждён — возвращать в работу нечего.'
      );
    const { table, owner } = trTable(type);
    const now = deps.now();
    const set: Record<string, unknown> =
      action === 'approve'
        ? {
            trStatus: 'approved',
            approvedSourceRevision: l.entity.sourceRevision,
            approvedBy: actor.id,
            approvedAt: now.toISOString().slice(0, 10),
            // Seed-format hash: written by the export for current approvals (export.ts finishApprovals).
            approvedSourceHash: null,
          }
        : { trStatus: 'in_progress' };
    const updated = await tx
      .update(table)
      .set({ ...set, version: sql`${table.version} + 1` })
      .where(and(eq(table[owner], id), eq(table.locale, locale), eq(table.version, expected.version)))
      .returning({ v: table.version });
    if (!updated.length) throw new Problem('edit_conflict');
    await recordRevision(tx, { type, id, kind: action, actorId: actor.id, locale });
    await recordAudit(
      deps,
      client,
      {
        action: action === 'approve' ? 'translation.approve' : 'translation.reopen',
        result: 'success',
        actorId: actor.id,
        resourceType: audited(type),
        resourceId: id,
        summary: { locale, previous_status: before, status: next, revision: l.entity.sourceRevision },
      },
      tx
    );
    return view(tx, await loadTranslation(tx, type, id, locale));
  });
}
