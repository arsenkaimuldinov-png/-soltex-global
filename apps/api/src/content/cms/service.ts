/**
 * Content collections: list, read, create (draft), update, archive, restore
 * (docs/admin-content.md). Everything goes through this service; routes only validate and
 * authorise the endpoint.
 *
 *  - Optimistic locking: every write names the version it was based on (If-Match). The entity row
 *    is updated `WHERE version = <expected>` and its version raised by one in the same statement;
 *    no match → 409 edit_conflict. Nothing is ever overwritten silently.
 *  - Field-level authorization: only fields whose value actually changes are checked; SEO fields
 *    need seo.edit, every other field content.edit (@soltex/core/domain deniedContentFields).
 *  - Status: Phase E creates drafts and moves drafts to and from the archive. Publishing and
 *    unpublishing are the publishing system (Phase G); a published record's slug changes together
 *    with a redirect (Phase I).
 *  - Translations: the source language is edited; translated languages keep their text and status
 *    and only follow structural changes (fields.ts); never-translated languages (status 'missing')
 *    are untranslated copies of the source and follow it completely.
 *  - Every write is audited in the same transaction.
 *  - Phase F: a change of a translated field raises the entity's source_revision (approved
 *    translations become outdated); every write to a language row raises that row's version (the
 *    concurrency token of the translation editor).
 */
import crypto from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  CONTENT_LOCALES,
  SOURCE_LOCALE,
  TRANSLATED_LOCALES,
  deniedContentFields,
  effectiveTranslationState,
  type EffectiveTranslationState,
  type StoredTranslationState,
  type TranslatedLocale,
} from '@soltex/core/domain';
import { DETAIL_PATH_PREFIX, slugify, slugProblem } from '@soltex/core/seo';
import type { Queryable } from '../../db/client.ts';
import * as s from '../../db/schema.ts';
import type { ClientInfo, Deps } from '../../deps.ts';
import { requireDb } from '../../deps.ts';
import { recordAudit } from '../../audit/audit.ts';
import { Problem, type FieldError } from '../../http/problem.ts';
import { slugChangeRedirects } from '../../seo/redirects.ts';
import type { UserRow } from '../../auth/sessions.ts';
import { COLLECTION_DEFS, requiredOnCreate, type CollectionDef, type EnFieldDef } from './collections.ts';
import { recordRevision } from '../../publishing/revisions.ts';
import { changes, ListOriginError, sourceValue, translationValue, validateOrigins, type TrKind } from './fields.ts';

// Drizzle tables are addressed by property name here (one implementation for six collections).
type AnyTable = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ContentStatus = 'draft' | 'published' | 'archived';
/** Effective translation state (Phase F: `outdated` = approved for an older source revision). */
export type TrState = EffectiveTranslationState;

export interface UserRef {
  id: string;
  name: string;
}

export interface ListItem {
  id: string;
  key: string;
  title: string;
  slug: string | null;
  status: ContentStatus;
  position: number;
  sourceLocale: string;
  updatedAt: string;
  updatedBy: UserRef | null;
  translations: Record<TranslatedLocale, TrState>;
}

export interface RecordView {
  id: string;
  key: string;
  status: ContentStatus;
  position: number;
  version: number;
  sourceLocale: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: UserRef | null;
  publishedAt: string | null;
  archivedAt: string | null;
  translations: Record<TranslatedLocale, { status: TrState; approvedAt: string | null }>;
  fields: Record<string, unknown>;
}

export interface ListQuery {
  q?: string;
  status?: ContentStatus;
  sort?: 'position' | 'title' | 'updated';
  limit: number;
  offset: number;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const pgCode = (e: unknown): string | undefined => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.cause?.code ?? err.code;
};

/** Raised inside a write transaction when a role may not change some fields (audited after rollback). */
export class FieldsDenied extends Error {
  constructor(readonly fields: string[]) {
    super('fields denied');
  }
}

/** Throws FieldsDenied when `actor` may not change some of `changed`. */
export function authorizeFields(actor: UserRow, changed: string[]) {
  const denied = deniedContentFields(actor.role, changed);
  if (denied.length) throw new FieldsDenied(denied);
}

/**
 * Turn a FieldsDenied into an audited 403. The audit row is written outside the (rolled back)
 * write transaction, so the refusal itself is never lost.
 */
export async function refuseFields(deps: Deps, client: ClientInfo, actor: UserRow, resourceType: string, resourceId: string | null, e: FieldsDenied): Promise<never> {
  await recordAudit(deps, client, { action: resourceId ? 'content.update' : 'content.create', result: 'denied', actorId: actor.id, resourceType, resourceId, summary: { fields: e.fields } });
  throw new Problem('forbidden', 'Эти поля нельзя изменять с вашей ролью.', { errors: e.fields.map((field) => ({ field, message: 'not_allowed' })) });
}

/** Parse an If-Match header: `"3"`, `W/"3"` or `3`. */
export function parseIfMatch(header: string | undefined): number {
  if (!header) throw new Problem('precondition_required');
  const m = header.trim().match(/^(?:W\/)?"?(\d{1,9})"?$/);
  if (!m) throw new Problem('precondition_required');
  return Number(m[1]);
}

export const etag = (version: number) => `"${version}"`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function userRefs(db: Queryable, ids: (string | null)[]): Promise<Map<string, UserRef>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

type TrRowState = { locale: string; trStatus: StoredTranslationState | null; approvedSourceRevision: number | null };

/** Effective state of one language row (same rule as the translation API and @soltex/core/domain). */
export const trStateOf = (row: TrRowState | undefined, sourceRevision: number): TrState =>
  effectiveTranslationState(row?.trStatus ?? null, row?.approvedSourceRevision ?? null, sourceRevision);

function trStates(rows: TrRowState[], sourceRevision: number): Record<TranslatedLocale, TrState> {
  const out = {} as Record<TranslatedLocale, TrState>;
  for (const l of TRANSLATED_LOCALES) out[l] = trStateOf(rows.find((r) => r.locale === l), sourceRevision);
  return out;
}

export async function listRecords(deps: Deps, def: CollectionDef, query: ListQuery): Promise<{ items: ListItem[]; total: number }> {
  const db = requireDb(deps);
  const t = def.table as AnyTable;
  const tr = def.trTable as AnyTable;
  const join = and(eq(tr[def.trOwner], t.id), eq(tr.locale, SOURCE_LOCALE));
  const where: SQL[] = [];
  if (query.status) where.push(eq(t.status, query.status));
  if (query.q?.trim()) {
    const like = `%${query.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const parts = [ilike(tr[def.titleField], like), ilike(t.key, like)];
    if (def.routable) parts.push(ilike(tr.slug, like));
    where.push(or(...parts)!);
  }
  const cond = where.length ? and(...where) : undefined;
  const order =
    query.sort === 'title' ? [asc(tr[def.titleField]), asc(t.key)] : query.sort === 'updated' ? [desc(t.updatedAt), asc(t.key)] : [asc(t.position), asc(t.key)];
  const rows = await db
    .select({ e: t, title: tr[def.titleField], slug: def.routable ? tr.slug : sql<null>`null` })
    .from(t)
    .innerJoin(tr, join)
    .where(cond)
    .orderBy(...order)
    .limit(query.limit)
    .offset(query.offset);
  const [{ n }] = (await db.select({ n: count() }).from(t).innerJoin(tr, join).where(cond)) as [{ n: number }];
  const ids = rows.map((r: { e: { id: string } }) => r.e.id);
  const states = ids.length
    ? await db.select({ owner: tr[def.trOwner], locale: tr.locale, trStatus: tr.trStatus, approvedSourceRevision: tr.approvedSourceRevision }).from(tr).where(inArray(tr[def.trOwner], ids))
    : [];
  const users = await userRefs(db, rows.map((r: { e: { updatedBy: string | null } }) => r.e.updatedBy));
  return {
    total: Number(n),
    items: rows.map((r: { e: Record<string, any>; title: string; slug: string | null }) => ({
      id: r.e.id,
      key: r.e.key,
      title: r.title,
      slug: r.slug,
      status: r.e.status,
      position: r.e.position,
      sourceLocale: r.e.sourceLocale,
      updatedAt: r.e.updatedAt.toISOString(),
      updatedBy: r.e.updatedBy ? users.get(r.e.updatedBy) ?? null : null,
      translations: trStates(states.filter((x: { owner: string }) => x.owner === r.e.id), r.e.sourceRevision),
    })),
  };
}

interface Loaded {
  entity: Record<string, any>;
  tr: Record<string, Record<string, any>>;
  gallery: string[];
  relatedProjects: string[];
}

async function load(db: Queryable, def: CollectionDef, id: string, lock = false): Promise<Loaded | null> {
  const t = def.table as AnyTable;
  const tr = def.trTable as AnyTable;
  const q = db.select().from(t).where(eq(t.id, id));
  const [entity] = lock ? await q.for('update') : await q;
  if (!entity) return null;
  const rows = await db.select().from(tr).where(eq(tr[def.trOwner], id));
  const byLocale = Object.fromEntries(rows.map((r: Record<string, any>) => [r.locale as string, r]));
  for (const l of CONTENT_LOCALES) if (!byLocale[l]) throw new Error(`${def.name} ${id}: missing ${l} translation`);
  const gallery = def.name === 'projects'
    ? (await db.select().from(s.projectGallery).where(eq(s.projectGallery.projectId, id)).orderBy(asc(s.projectGallery.position))).map((g) => g.mediaId)
    : [];
  const relatedProjects = def.name === 'technologies'
    ? (await db.select().from(s.technologyProjects).where(eq(s.technologyProjects.technologyId, id)).orderBy(asc(s.technologyProjects.position))).map((x) => x.projectId)
    : [];
  return { entity, tr: byLocale, gallery, relatedProjects };
}

function enValue(f: EnFieldDef, l: Loaded): unknown {
  if (f.kind === 'mediaList') return l.gallery;
  if (f.kind === 'refList') return l.relatedProjects;
  return l.entity[f.column!] ?? null;
}

async function view(db: Queryable, def: CollectionDef, l: Loaded): Promise<RecordView> {
  const e = l.entity;
  const src = l.tr[SOURCE_LOCALE]!;
  const fields: Record<string, unknown> = {};
  if (def.routable) fields.slug = src.slug;
  for (const f of def.en) fields[f.name] = enValue(f, l);
  for (const f of def.tr) fields[f.name] = src[f.column] ?? null;
  const users = await userRefs(db, [e.updatedBy]);
  const translations = {} as RecordView['translations'];
  for (const loc of TRANSLATED_LOCALES) translations[loc] = { status: trStateOf(l.tr[loc] as TrRowState, e.sourceRevision), approvedAt: l.tr[loc]!.approvedAt ?? null };
  return {
    id: e.id,
    key: e.key,
    status: e.status,
    position: e.position,
    version: e.version,
    sourceLocale: e.sourceLocale,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    updatedBy: e.updatedBy ? users.get(e.updatedBy) ?? null : null,
    publishedAt: iso(e.publishedAt),
    archivedAt: iso(e.archivedAt),
    translations,
    fields,
  };
}

export async function getRecord(deps: Deps, def: CollectionDef, id: string): Promise<RecordView> {
  const db = requireDb(deps);
  const l = await load(db, def, id);
  if (!l) throw new Problem('not_found');
  return view(db, def, l);
}

// ---------------------------------------------------------------------------
// Validation of references and slugs
// ---------------------------------------------------------------------------

async function checkMedia(db: Queryable, ids: string[], kind: 'image' | 'video', field: string, errors: FieldError[]) {
  if (!ids.length) return;
  const rows = await db.select({ id: s.media.id, kind: s.media.kind }).from(s.media).where(inArray(s.media.id, ids));
  for (const id of ids) {
    const m = rows.find((r) => r.id === id);
    if (!m) errors.push({ field, message: 'unknown_media' });
    else if (m.kind !== kind) errors.push({ field, message: kind === 'image' ? 'not_an_image' : 'not_a_video' });
  }
}

async function checkRefs(db: Queryable, target: 'technologies' | 'projects', ids: string[], field: string, errors: FieldError[]) {
  if (!ids.length) return;
  const t = COLLECTION_DEFS[target].table as AnyTable;
  const rows = await db.select({ id: t.id, status: t.status }).from(t).where(inArray(t.id, ids));
  for (const id of ids) {
    const r = rows.find((x: { id: string }) => x.id === id);
    if (!r) errors.push({ field, message: 'unknown_reference' });
    else if (r.status === 'archived') errors.push({ field, message: 'archived_reference' });
  }
}

async function validateEnFields(db: Queryable, def: CollectionDef, input: Record<string, unknown>, errors: FieldError[]) {
  for (const f of def.en) {
    if (!(f.name in input)) continue;
    const v = input[f.name];
    if ((f.kind === 'media' || f.kind === 'mediaNull') && v !== null) await checkMedia(db, [v as string], f.mediaKind!, f.name, errors);
    if (f.kind === 'mediaList') {
      const ids = v as string[];
      if (new Set(ids).size !== ids.length) errors.push({ field: f.name, message: 'duplicate' });
      await checkMedia(db, ids, f.mediaKind!, f.name, errors);
    }
    if (f.kind === 'ref') await checkRefs(db, f.ref!, [v as string], f.name, errors);
    if (f.kind === 'refList') {
      const ids = v as string[];
      if (new Set(ids).size !== ids.length) errors.push({ field: f.name, message: 'duplicate' });
      await checkRefs(db, f.ref!, ids, f.name, errors);
    }
    if (f.kind === 'placements') {
      const list = v as string[];
      if (!list.length || new Set(list).size !== list.length) errors.push({ field: f.name, message: 'invalid' });
    }
  }
}

async function slugTaken(db: Queryable, def: CollectionDef, slug: string, exceptId: string | null): Promise<boolean> {
  const tr = def.trTable as AnyTable;
  const rows = await db
    .select({ owner: tr[def.trOwner] })
    .from(tr)
    .where(and(eq(tr.slug, slug), exceptId ? ne(tr[def.trOwner], exceptId) : undefined))
    .limit(1);
  return rows.length > 0;
}

function throwIfErrors(errors: FieldError[]) {
  if (errors.length) throw new Problem('validation_failed', undefined, { errors });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const defaultTr = (kind: TrKind): unknown => (kind === 'text' ? '' : kind === 'list' || kind === 'labelValue' || kind === 'titleDesc' ? [] : null);
const defaultEn = (f: EnFieldDef): unknown => (f.kind === 'string' ? '' : f.kind === 'bool' ? false : f.kind === 'mediaList' || f.kind === 'refList' ? [] : null);

async function writeChildren(tx: Queryable, def: CollectionDef, id: string, input: Record<string, unknown>) {
  if (def.name === 'projects' && 'gallery' in input) {
    await tx.delete(s.projectGallery).where(eq(s.projectGallery.projectId, id));
    const ids = input.gallery as string[];
    if (ids.length) await tx.insert(s.projectGallery).values(ids.map((mediaId, position) => ({ projectId: id, position, mediaId })));
  }
  if (def.name === 'technologies' && 'relatedProjects' in input) {
    await tx.delete(s.technologyProjects).where(eq(s.technologyProjects.technologyId, id));
    const ids = input.relatedProjects as string[];
    if (ids.length) await tx.insert(s.technologyProjects).values(ids.map((projectId, position) => ({ technologyId: id, position, projectId })));
  }
}

async function uniqueKey(db: Queryable, def: CollectionDef, base: string): Promise<string> {
  const t = def.table as AnyTable;
  for (let i = 1; i < 100; i++) {
    const key = i === 1 ? base : `${base}-${i}`;
    if (!(await db.select({ id: t.id }).from(t).where(eq(t.key, key)).limit(1)).length) return key;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createRecord(deps: Deps, def: CollectionDef, actor: UserRow, input: Record<string, unknown>, client: ClientInfo): Promise<RecordView> {
  const db = requireDb(deps);
  // Field-level: an explicit slug or SEO text needs seo.edit; without it the slug is proposed from the title.
  const provided = Object.keys(input).filter((k) => input[k] !== undefined && input[k] !== null && !(Array.isArray(input[k]) && (input[k] as unknown[]).length === 0) && input[k] !== false && input[k] !== '');
  try {
    authorizeFields(actor, provided);
  } catch (e) {
    if (e instanceof FieldsDenied) await refuseFields(deps, client, actor, def.resourceType, null, e);
    throw e;
  }

  const errors: FieldError[] = [];
  for (const name of requiredOnCreate(def)) if (input[name] === undefined || input[name] === null || input[name] === '') errors.push({ field: name, message: 'required' });
  throwIfErrors(errors);
  await validateEnFields(db, def, input, errors);
  let slug: string | null = null;
  if (def.routable) {
    if (typeof input.slug === 'string') {
      slug = input.slug;
      const p = slugProblem(def.routable, slug);
      if (p) errors.push({ field: 'slug', message: p });
      else if (await slugTaken(db, def, slug, null)) throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });
    } else {
      const base = slugify(String(input[def.titleField] ?? '')) || `draft-${crypto.randomUUID().slice(0, 6)}`;
      slug = slugProblem(def.routable, base) ? `draft-${crypto.randomUUID().slice(0, 6)}` : base;
      for (let i = 2; await slugTaken(db, def, slug, null); i++) slug = `${base.slice(0, 70)}-${i}`;
    }
  }
  throwIfErrors(errors);

  const t = def.table as AnyTable;
  const tr = def.trTable as AnyTable;
  const now = deps.now();
  try {
    return await db.transaction(async (tx) => {
      const [{ max }] = (await tx.select({ max: sql<number | null>`max(${t.position})` }).from(t)) as [{ max: number | null }];
      const key = await uniqueKey(tx, def, `${def.keyPrefix}-${slug ?? slugify(String(input[def.titleField])) ?? 'item'}`.replace(/-+$/, ''));
      const values: Record<string, unknown> = {
        key,
        status: 'draft',
        position: typeof input.position === 'number' ? input.position : (max ?? 0) + 1,
        sourceLocale: SOURCE_LOCALE,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.id,
        updatedBy: actor.id,
      };
      for (const f of def.en) if (f.column) values[f.column] = f.name in input && input[f.name] !== undefined ? input[f.name] : defaultEn(f);
      const [row] = await tx.insert(t).values(values).returning({ id: t.id });
      const id = (row as { id: string }).id;
      for (const locale of CONTENT_LOCALES) {
        const r: Record<string, unknown> = {
          [def.trOwner]: id,
          locale,
          trStatus: locale === SOURCE_LOCALE ? null : 'missing',
          approvedSourceHash: null,
          approvedAt: null,
          createdAt: now,
          updatedAt: now,
          createdBy: actor.id,
          updatedBy: actor.id,
        };
        if (def.routable) r.slug = slug;
        for (const f of def.tr) r[f.column] = f.name in input && input[f.name] !== undefined ? sourceValue(f.kind, input[f.name]) : defaultTr(f.kind);
        // (A new draft: every language is an untranslated copy of the source.)
        await tx.insert(tr).values(r);
      }
      await writeChildren(tx, def, id, input);
      await recordRevision(tx, { type: def.name, id, kind: 'create', actorId: actor.id, summary: { fields: provided } });
      await recordAudit(deps, client, { action: 'content.create', result: 'success', actorId: actor.id, resourceType: def.resourceType, resourceId: id, summary: { status: 'draft' } }, tx);
      return view(tx, def, (await load(tx, def, id))!);
    });
  } catch (e) {
    if (pgCode(e) === '23505') throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });
    throw e;
  }
}

/** Names of the fields in `input` whose value would change the record. */
function changedFields(def: CollectionDef, l: Loaded, input: Record<string, unknown>): string[] {
  const out: string[] = [];
  const src = l.tr[SOURCE_LOCALE]!;
  if (def.routable && input.slug !== undefined && input.slug !== src.slug) out.push('slug');
  if (input.position !== undefined && input.position !== l.entity.position) out.push('position');
  for (const f of def.en) {
    if (input[f.name] === undefined) continue;
    if (JSON.stringify(input[f.name]) !== JSON.stringify(enValue(f, l))) out.push(f.name);
  }
  for (const f of def.tr) {
    if (input[f.name] === undefined) continue;
    if (changes(f.kind, input[f.name], src[f.column] ?? null)) out.push(f.name);
  }
  return out;
}

export async function updateRecord(
  deps: Deps,
  def: CollectionDef,
  actor: UserRow,
  id: string,
  expectedVersion: number,
  input: Record<string, unknown>,
  client: ClientInfo
): Promise<RecordView> {
  const db = requireDb(deps);
  try {
    return await db.transaction(async (tx) => {
      const l = await load(tx, def, id, true);
      if (!l) throw new Problem('not_found');
      if (l.entity.version !== expectedVersion) throw new Problem('edit_conflict');
      if (l.entity.status === 'archived') throw new Problem('invalid_transition', 'Запись в архиве. Верните её из архива, чтобы изменить.');

      const changed = changedFields(def, l, input);
      if (!changed.length) return view(tx, def, l);
      authorizeFields(actor, changed);

      const errors: FieldError[] = [];
      const patch = Object.fromEntries(changed.map((k) => [k, input[k]]));
      await validateEnFields(tx, def, patch, errors);
      if ('slug' in patch) {
        if (l.entity.status !== 'draft')
          throw new Problem('invalid_transition', 'Адрес опубликованной записи меняется через «Изменить адрес»: со старого адреса будет создано перенаправление.', {
            errors: [{ field: 'slug', message: 'locked_published' }],
          });
        const p = slugProblem(def.routable!, patch.slug as string);
        if (p) errors.push({ field: 'slug', message: p });
        else if (await slugTaken(tx, def, patch.slug as string, id)) throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });
      }
      const src = l.tr[SOURCE_LOCALE]!;
      for (const f of def.tr) {
        if (!(f.name in patch)) continue;
        try {
          validateOrigins(f.kind, patch[f.name], src[f.column] ?? null, f.name);
        } catch (e) {
          if (e instanceof ListOriginError) errors.push({ field: e.message, message: 'invalid_list_origin' });
          else throw e;
        }
      }
      throwIfErrors(errors);

      const t = def.table as AnyTable;
      const tr = def.trTable as AnyTable;
      const now = deps.now();
      const set: Record<string, unknown> = { version: sql`${t.version} + 1`, updatedAt: now, updatedBy: actor.id };
      // Phase F: only a change of translated source text makes approved translations outdated.
      if (def.tr.some((f) => f.name in patch)) set.sourceRevision = sql`${t.sourceRevision} + 1`;
      if ('position' in patch) set.position = patch.position;
      for (const f of def.en) if (f.column && f.name in patch) set[f.column] = patch[f.name];
      const updated = await tx
        .update(t)
        .set(set)
        .where(and(eq(t.id, id), eq(t.version, expectedVersion)))
        .returning({ id: t.id });
      if (!updated.length) throw new Problem('edit_conflict');

      for (const locale of CONTENT_LOCALES) {
        const cur = l.tr[locale]!;
        const row: Record<string, unknown> = {};
        if ('slug' in patch) row.slug = patch.slug;
        for (const f of def.tr) {
          if (!(f.name in patch)) continue;
          // Never-translated languages ('missing') are untranslated copies of the source and follow it.
          const mirror = locale === SOURCE_LOCALE || cur.trStatus === 'missing';
          const next = mirror ? sourceValue(f.kind, patch[f.name]) : translationValue(f.kind, patch[f.name], src[f.column] ?? null, cur[f.column] ?? null, f.name);
          if (JSON.stringify(next) !== JSON.stringify(cur[f.column] ?? null)) row[f.column] = next;
        }
        if (Object.keys(row).length)
          await tx
            .update(tr)
            .set({ ...row, version: sql`${tr.version} + 1`, updatedAt: now, updatedBy: actor.id })
            .where(and(eq(tr[def.trOwner], id), eq(tr.locale, locale)));
      }
      await writeChildren(tx, def, id, patch);
      await recordRevision(tx, { type: def.name, id, kind: 'update', actorId: actor.id, summary: { fields: changed } });
      await recordAudit(deps, client, { action: 'content.update', result: 'success', actorId: actor.id, resourceType: def.resourceType, resourceId: id, summary: { fields: changed } }, tx);
      return view(tx, def, (await load(tx, def, id))!);
    });
  } catch (e) {
    if (e instanceof FieldsDenied) await refuseFields(deps, client, actor, def.resourceType, id, e);
    if (pgCode(e) === '23505') throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });
    throw e;
  }
}

/**
 * Change the address (slug) of a PUBLISHED record (Phase I-2, review §O). Drafts change it in the
 * form; a published record changes it only here, so the old address keeps working:
 *  - the slug is changed in every language row (one slug per entity) and the record version is
 *    raised; translations do not become outdated (the source text did not change);
 *  - with `redirect` (default) a 301 from the old to the new address is created for all languages
 *    and older redirects to the old address are rewritten (no chains); a redirect from the new
 *    address is removed either way (it would hide the page);
 *  - a revision and an audit entry are recorded. The change reaches the site with the next release.
 */
export async function changeSlug(
  deps: Deps,
  def: CollectionDef,
  actor: UserRow,
  id: string,
  expectedVersion: number,
  input: { slug: string; redirect: boolean },
  client: ClientInfo
): Promise<{ record: RecordView; redirect: { from: string; to: string } | null; rewritten: number; removed: number }> {
  const db = requireDb(deps);
  if (!def.routable) throw new Problem('not_found');
  try {
    return await db.transaction(async (tx) => {
      const l = await load(tx, def, id, true);
      if (!l) throw new Problem('not_found');
      if (l.entity.version !== expectedVersion) throw new Problem('edit_conflict');
      if (l.entity.status !== 'published')
        throw new Problem('invalid_transition', 'Через «Изменить адрес» меняется адрес опубликованной записи. У черновика адрес меняется в форме.');
      const oldSlug = l.tr[SOURCE_LOCALE]!.slug as string;
      const slug = input.slug.trim();
      if (slug === oldSlug) throw new Problem('validation_failed', undefined, { errors: [{ field: 'slug', message: 'unchanged' }] });
      const p = slugProblem(def.routable!, slug);
      if (p) throw new Problem('validation_failed', undefined, { errors: [{ field: 'slug', message: p }] });
      if (await slugTaken(tx, def, slug, id)) throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });

      const t = def.table as AnyTable;
      const tr = def.trTable as AnyTable;
      const now = deps.now();
      const updated = await tx
        .update(t)
        .set({ version: sql`${t.version} + 1`, updatedAt: now, updatedBy: actor.id })
        .where(and(eq(t.id, id), eq(t.version, expectedVersion)))
        .returning({ id: t.id });
      if (!updated.length) throw new Problem('edit_conflict');
      await tx.update(tr).set({ slug, version: sql`${tr.version} + 1`, updatedAt: now, updatedBy: actor.id }).where(eq(tr[def.trOwner], id));

      const prefix = DETAIL_PATH_PREFIX[def.name as keyof typeof DETAIL_PATH_PREFIX];
      const from = prefix + oldSlug;
      const to = prefix + slug;
      const res = await slugChangeRedirects(tx, deps, actor, from, to, input.redirect);
      await recordRevision(tx, { type: def.name, id, kind: 'update', actorId: actor.id, summary: { fields: ['slug'] } });
      await recordAudit(
        deps,
        client,
        { action: 'content.slug_change', result: 'success', actorId: actor.id, resourceType: def.resourceType, resourceId: id, summary: { slug, previous_slug: oldSlug, count: res.rewritten + res.removed + (res.created ? 1 : 0) } },
        tx
      );
      return { record: await view(tx, def, (await load(tx, def, id))!), redirect: res.created ? { from: res.created.fromPath, to: res.created.toPath } : null, rewritten: res.rewritten, removed: res.removed };
    });
  } catch (e) {
    if (pgCode(e) === '23505') throw new Problem('slug_taken', undefined, { errors: [{ field: 'slug', message: 'taken' }] });
    throw e;
  }
}

/**
 * Archive a draft / restore an archived record to draft. A published record leaves the site only
 * through unpublishing, which belongs to the publishing system (Phase G).
 */
export async function setArchived(
  deps: Deps,
  def: CollectionDef,
  actor: UserRow,
  id: string,
  expectedVersion: number,
  archive: boolean,
  client: ClientInfo
): Promise<RecordView> {
  const db = requireDb(deps);
  return db.transaction(async (tx) => {
    const l = await load(tx, def, id, true);
    if (!l) throw new Problem('not_found');
    if (l.entity.version !== expectedVersion) throw new Problem('edit_conflict');
    const from: ContentStatus = l.entity.status;
    if (archive && from !== 'draft')
      throw new Problem(
        'invalid_transition',
        from === 'published' ? 'Опубликованную запись сначала снимают с публикации — это появится вместе с публикацией сайта.' : 'Запись уже в архиве.'
      );
    if (!archive && from !== 'archived') throw new Problem('invalid_transition', 'Запись не в архиве.');
    const t = def.table as AnyTable;
    const now = deps.now();
    const updated = await tx
      .update(t)
      .set({ status: archive ? 'archived' : 'draft', archivedAt: archive ? now : null, version: sql`${t.version} + 1`, updatedAt: now, updatedBy: actor.id })
      .where(and(eq(t.id, id), eq(t.version, expectedVersion)))
      .returning({ id: t.id });
    if (!updated.length) throw new Problem('edit_conflict');
    await recordRevision(tx, { type: def.name, id, kind: archive ? 'archive' : 'unarchive', actorId: actor.id });
    await recordAudit(
      deps,
      client,
      { action: archive ? 'content.archive' : 'content.restore', result: 'success', actorId: actor.id, resourceType: def.resourceType, resourceId: id, summary: { status: archive ? 'archived' : 'draft' } },
      tx
    );
    return view(tx, def, (await load(tx, def, id))!);
  });
}
