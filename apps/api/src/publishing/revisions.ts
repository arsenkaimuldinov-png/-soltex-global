/**
 * Content revisions (Phase G, docs/admin-publishing.md §2; review §M).
 *
 *  - Every content mutation of the seven admin-managed types writes one revision IN THE SAME
 *    TRANSACTION (Phase E create / update / archive / restore, publish / unpublish, page update,
 *    Phase F translation save / approve / reopen, revision restore). A failed mutation rolls its
 *    revision back with it; there are no orphan revisions.
 *  - A revision holds the entity's complete record in the ContentStore (seed) format: all
 *    languages, translation states, relations and media by stable key. That is the smallest
 *    representation from which the version can be shown, compared, restored and built.
 *  - Numbers are per entity (1, 2, 3 …), allocated under the entity row lock the mutation already
 *    holds, and protected by a unique constraint. Revisions are append-only (database trigger).
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { isLocalized, type ContentStore } from '@soltex/core/content';
import type { RevisionKind } from '@soltex/core/domain';
import type { Queryable } from '../db/client.ts';
import * as s from '../db/schema.ts';
import { exportStore } from '../content/export.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';

export type EntityRecord = Record<string, unknown> & { id: string; status: string };

export interface RevisionInput {
  type: TranslatableType;
  /** Entity uuid. */
  id: string;
  kind: RevisionKind;
  actorId: string | null;
  locale?: string | null;
  summary?: Record<string, unknown>;
}

/** Key order independent JSON (jsonb / json round trips and comparisons). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value ?? null);
}

export const recordsOf = (store: ContentStore, type: TranslatableType) => store[REVIEW_TABLES[type].storeKey] as unknown as EntityRecord[];

/** Source-language title of a record (page header title, or the key for pages without a header). */
export function recordTitle(type: TranslatableType, rec: EntityRecord): string {
  const t = type === 'pages' ? (rec.header as { title?: unknown } | null)?.title : rec.title;
  return isLocalized(t) && t.en.trim() ? t.en : rec.id;
}

interface EntityHead {
  id: string;
  key: string;
  version: number;
  sourceRevision: number;
}

async function entityHead(db: Queryable, type: TranslatableType, id: string): Promise<EntityHead | null> {
  const r = REVIEW_TABLES[type];
  const { rows } = await db.execute(sql`SELECT id, key, version, source_revision FROM ${sql.raw(r.entity)} WHERE id = ${id}`);
  const row = rows[0] as { id: string; key: string; version: number; source_revision: number } | undefined;
  return row ? { id: row.id, key: row.key, version: row.version, sourceRevision: row.source_revision } : null;
}

async function nextNumber(db: Queryable, type: TranslatableType, id: string): Promise<number> {
  const [{ n }] = (await db
    .select({ n: sql<number>`coalesce(max(${s.contentRevisions.number}), 0)::int` })
    .from(s.contentRevisions)
    .where(and(eq(s.contentRevisions.entityType, type), eq(s.contentRevisions.entityId, id)))) as [{ n: number }];
  return Number(n) + 1;
}

/**
 * Write a revision of the entity's current state. Call inside the mutation's transaction, after
 * the content rows are written (the export reads the uncommitted state of the same transaction).
 */
export async function recordRevision(db: Queryable, input: RevisionInput, store?: ContentStore): Promise<number> {
  const head = await entityHead(db, input.type, input.id);
  if (!head) throw new Error(`revision: ${input.type} ${input.id} not found`);
  const st = store ?? (await exportStore(db));
  const rec = recordsOf(st, input.type).find((r) => r.id === head.key);
  if (!rec) throw new Error(`revision: ${input.type} ${head.key} missing from the export`);
  const number = await nextNumber(db, input.type, input.id);
  await db.insert(s.contentRevisions).values({
    entityType: input.type,
    entityId: input.id,
    entityKey: head.key,
    number,
    kind: input.kind,
    locale: input.locale ?? null,
    sourceRevision: head.sourceRevision,
    entityVersion: head.version,
    title: recordTitle(input.type, rec),
    data: rec,
    summary: input.summary ?? {},
    createdBy: input.actorId,
  });
  return number;
}

/**
 * Make the revision history match the content (run by db:migrate and db:import): an entity
 * without revisions gets a `baseline` revision, an entity whose latest revision differs from its
 * current content (changed outside the CMS, e.g. by an import) gets a revision of `kind`.
 */
export async function syncRevisions(db: Queryable, kind: 'import' | 'baseline'): Promise<number> {
  // An empty database (fresh migration, before the first import) has nothing to record.
  if (!(await db.execute(sql`SELECT 1 FROM settings LIMIT 1`)).rows.length) return 0;
  const store = await exportStore(db);
  const latest = await db.execute(
    sql`SELECT DISTINCT ON (entity_type, entity_id) entity_type, entity_id, data FROM content_revisions ORDER BY entity_type, entity_id, number DESC`
  );
  const byEntity = new Map((latest.rows as Array<{ entity_type: string; entity_id: string; data: unknown }>).map((r) => [`${r.entity_type}/${r.entity_id}`, r.data]));
  let written = 0;
  for (const type of TRANSLATABLE_TYPES) {
    const r = REVIEW_TABLES[type];
    const { rows } = await db.execute(sql.raw(`SELECT id, key FROM ${r.entity}`));
    const ids = new Map((rows as Array<{ id: string; key: string }>).map((x) => [x.key, x.id]));
    for (const rec of recordsOf(store, type)) {
      const id = ids.get(rec.id);
      if (!id) continue;
      const prev = byEntity.get(`${type}/${id}`);
      if (prev !== undefined && canonical(prev) === canonical(rec)) continue;
      await recordRevision(db, { type, id, kind: prev === undefined ? 'baseline' : kind, actorId: null }, store);
      written++;
    }
  }
  return written;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface RevisionListQuery {
  type?: TranslatableType;
  id?: string;
  kind?: RevisionKind;
  q?: string;
  limit: number;
  offset: number;
}

export async function listRevisions(db: Queryable, q: RevisionListQuery) {
  const where: SQL[] = [];
  if (q.type) where.push(eq(s.contentRevisions.entityType, q.type));
  if (q.id) where.push(eq(s.contentRevisions.entityId, q.id));
  if (q.kind) where.push(eq(s.contentRevisions.kind, q.kind));
  if (q.q?.trim()) {
    const like = `%${q.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(${s.contentRevisions.title} ILIKE ${like} OR ${s.contentRevisions.entityKey} ILIKE ${like})`);
  }
  const cond = where.length ? and(...where) : undefined;
  const rows = await db
    .select({
      id: s.contentRevisions.id,
      entityType: s.contentRevisions.entityType,
      entityId: s.contentRevisions.entityId,
      entityKey: s.contentRevisions.entityKey,
      number: s.contentRevisions.number,
      kind: s.contentRevisions.kind,
      locale: s.contentRevisions.locale,
      sourceRevision: s.contentRevisions.sourceRevision,
      title: s.contentRevisions.title,
      summary: s.contentRevisions.summary,
      createdAt: s.contentRevisions.createdAt,
      createdBy: s.contentRevisions.createdBy,
      author: s.users.name,
      total: sql<number>`count(*) over ()::int`,
    })
    .from(s.contentRevisions)
    .leftJoin(s.users, eq(s.users.id, s.contentRevisions.createdBy))
    .where(cond)
    .orderBy(desc(s.contentRevisions.createdAt), desc(s.contentRevisions.id))
    .limit(q.limit)
    .offset(q.offset);
  let total = rows.length ? Number(rows[0]!.total) : 0;
  if (!rows.length && q.offset > 0) {
    const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(s.contentRevisions).where(cond)) as [{ n: number }];
    total = Number(n);
  }
  // Latest number per listed entity (one query): marks the current version.
  const latest = new Map<string, number>();
  const ids = [...new Set(rows.map((r) => r.entityId))];
  if (ids.length) {
    const res = await db.execute(
      sql`SELECT entity_type, entity_id, max(number)::int AS n FROM content_revisions WHERE entity_id = ANY(${sql.param(ids)}::uuid[]) GROUP BY entity_type, entity_id`
    );
    for (const r of res.rows as Array<{ entity_type: string; entity_id: string; n: number }>) latest.set(`${r.entity_type}/${r.entity_id}`, Number(r.n));
  }
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      entityType: r.entityType as TranslatableType,
      entityId: r.entityId,
      entityKey: r.entityKey,
      number: r.number,
      kind: r.kind,
      locale: r.locale,
      sourceRevision: r.sourceRevision,
      title: r.title,
      fields: Array.isArray((r.summary as { fields?: unknown }).fields) ? ((r.summary as { fields: string[] }).fields) : [],
      restoredFrom: typeof (r.summary as { restored_from?: unknown }).restored_from === 'number' ? (r.summary as { restored_from: number }).restored_from : null,
      createdAt: r.createdAt.toISOString(),
      author: r.createdBy ? { id: r.createdBy, name: r.author ?? '' } : null,
      current: latest.get(`${r.entityType}/${r.entityId}`) === r.number,
    })),
  };
}

/** One revision in the list format (author, "current" flag). */
export async function revisionItem(db: Queryable, row: typeof s.contentRevisions.$inferSelect) {
  const latest = await latestRevisionRow(db, row.entityType as TranslatableType, row.entityId);
  const [author] = row.createdBy ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.id, row.createdBy)) : [];
  const summary = row.summary as { fields?: unknown; restored_from?: unknown };
  return {
    id: row.id,
    entityType: row.entityType as TranslatableType,
    entityId: row.entityId,
    entityKey: row.entityKey,
    number: row.number,
    kind: row.kind,
    locale: row.locale,
    sourceRevision: row.sourceRevision,
    title: row.title,
    fields: Array.isArray(summary.fields) ? (summary.fields as string[]) : [],
    restoredFrom: typeof summary.restored_from === 'number' ? summary.restored_from : null,
    createdAt: row.createdAt.toISOString(),
    author: author ?? null,
    current: latest?.number === row.number,
  };
}

export async function getRevisionRow(db: Queryable, type: TranslatableType, id: string, number: number) {
  const [row] = await db
    .select()
    .from(s.contentRevisions)
    .where(and(eq(s.contentRevisions.entityType, type), eq(s.contentRevisions.entityId, id), eq(s.contentRevisions.number, number)));
  return row ?? null;
}

export async function latestRevisionRow(db: Queryable, type: TranslatableType, id: string) {
  const [row] = await db
    .select()
    .from(s.contentRevisions)
    .where(and(eq(s.contentRevisions.entityType, type), eq(s.contentRevisions.entityId, id)))
    .orderBy(desc(s.contentRevisions.number))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface DiffEntry {
  /** Path in the record, e.g. "title", "scope.2", "seo.metaTitle", "translationStatus.ru.status". */
  path: string;
  /** Top-level field (groups the entries in the admin). */
  field: string;
  /** Language of a translated text; null for language-independent values. */
  locale: string | null;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

type Leaf = string | number | boolean | null;

/** Flatten a record to path → value; translated texts become one entry per language. */
export function flatten(value: unknown, path = '', out = new Map<string, { locale: string | null; value: Leaf }>()) {
  if (isLocalized(value)) {
    for (const [l, t] of Object.entries(value)) out.set(`${path}|${l}`, { locale: l, value: t as string });
    return out;
  }
  if (Array.isArray(value)) {
    if (!value.length) out.set(path, { locale: null, value: '(пусто)' });
    value.forEach((v, i) => flatten(v, path ? `${path}.${i}` : String(i), out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'translationStatus') {
        for (const [l, st] of Object.entries(v as Record<string, { status: string }>)) out.set(`translationStatus.${l}.status|${l}`, { locale: l, value: st.status });
        continue;
      }
      flatten(v, path ? `${path}.${k}` : k, out);
    }
    return out;
  }
  out.set(path, { locale: null, value: (value ?? null) as Leaf });
  return out;
}

/** Field-by-field, language-by-language differences between two records (`before` → `after`). */
export function diffRecords(before: unknown, after: unknown, limit = 400): { entries: DiffEntry[]; truncated: boolean } {
  const a = flatten(before);
  const b = flatten(after);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const entries: DiffEntry[] = [];
  for (const k of keys) {
    const x = a.get(k);
    const y = b.get(k);
    if (x && y && x.value === y.value) continue;
    const path = k.split('|')[0]!;
    entries.push({ path, field: path.split('.')[0]!, locale: (x ?? y)!.locale, before: x?.value ?? null, after: y?.value ?? null });
  }
  return { entries: entries.slice(0, limit), truncated: entries.length > limit };
}

/** Top-level fields that differ (for summaries and field-level authorization). */
export const changedTopFields = (before: unknown, after: unknown) => [...new Set(diffRecords(before, after, 100000).entries.map((e) => e.field))];
