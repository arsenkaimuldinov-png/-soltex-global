/**
 * Releases (Phase G, docs/admin-publishing.md §3–§6).
 *
 *  - «Создать релиз» captures a SNAPSHOT of the working copy in one REPEATABLE READ transaction:
 *    the published records (seed format, with their translations) and the revision number of every
 *    record. The worker builds exactly that snapshot later; edits made meanwhile are not in it.
 *  - Status changes follow @soltex/core/domain RELEASE_TRANSITIONS only; each one is written to
 *    release_events (append-only) and audited.
 *  - Activation and rollback switch the `current` symlink atomically (artifacts.ts) and only then
 *    commit the database change; any failure switches back, so the previously active release
 *    stays live. Rollback re-activates an existing artifact: no rebuild.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { CONTENT_LOCALES, canTransition, type ReleaseKind, type ReleaseStatus, type TranslatedLocale } from '@soltex/core/domain';
import type { ContentStore } from '@soltex/core/content';
import type { Queryable } from '../db/client.ts';
import * as s from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import type { UserRow } from '../auth/sessions.ts';
import { exportStore } from '../content/export.ts';
import { serialize } from '../content/seed-files.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { effectiveStates } from '../content/translations/service.ts';
import { canonical, recordsOf, recordTitle, syncRevisions } from './revisions.ts';
import { readCurrent, smokeCheck, switchCurrent, verifyArtifact } from './artifacts.ts';

type ReleaseRow = typeof s.releases.$inferSelect;

export const ACTIVATION_LOCK = 724_002;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function releaseEvent(
  db: Queryable,
  releaseId: string,
  event: string,
  actorId: string | null,
  from: ReleaseStatus | null,
  to: ReleaseStatus | null,
  detail: Record<string, unknown> = {}
) {
  await db.insert(s.releaseEvents).values({ releaseId, event, actorId, fromStatus: from, toStatus: to, detail });
}

/**
 * Change a release's status (with the transition rule) and write the event, in `db` (a
 * transaction). `expect` guards against concurrent changes: the row must still be in `from`.
 */
export async function transition(
  db: Queryable,
  row: Pick<ReleaseRow, 'id' | 'kind' | 'status'>,
  to: ReleaseStatus,
  actorId: string | null,
  event: string,
  set: Partial<typeof s.releases.$inferInsert> = {},
  detail: Record<string, unknown> = {}
): Promise<boolean> {
  if (!canTransition(row.status, to, row.kind)) throw new Error(`release ${row.id}: ${row.status} → ${to} is not allowed`);
  const updated = await db
    .update(s.releases)
    .set({ ...set, status: to, version: sql`${s.releases.version} + 1` })
    .where(and(eq(s.releases.id, row.id), eq(s.releases.status, row.status)))
    .returning({ id: s.releases.id });
  if (!updated.length) return false;
  await releaseEvent(db, row.id, event, actorId, row.status, to, detail);
  return true;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface TranslationSummary {
  locales: Record<TranslatedLocale, { approved: number; outdated: number; in_progress: number; missing: number }>;
  /** Records whose translation is shown in English (missing / in progress) or with an older approved text (outdated). */
  attention: Array<{ type: TranslatableType; key: string; locale: TranslatedLocale; state: 'outdated' | 'in_progress' | 'missing' }>;
}

const COLLECTION_KEYS = TRANSLATABLE_TYPES.map((t) => REVIEW_TABLES[t].storeKey);

/** Content of a build: published records (release) or everything not archived, drafts shown (preview). */
export function snapshotStore(store: ContentStore, kind: ReleaseKind): ContentStore {
  const out = { ...store } as Record<string, unknown>;
  for (const k of COLLECTION_KEYS) {
    const list = store[k] as unknown as Array<{ status: string }>;
    out[k] = kind === 'release' ? list.filter((r) => r.status === 'published') : list.filter((r) => r.status !== 'archived').map((r) => (r.status === 'draft' ? { ...r, status: 'published' } : r));
  }
  return out as unknown as ContentStore;
}

function releaseKey(kind: ReleaseKind, now: Date): string {
  const d = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${kind === 'release' ? 'R' : 'P'}-${d.slice(0, 8)}-${d.slice(8, 14)}-${crypto.randomBytes(3).toString('hex')}`;
}

async function activeRelease(db: Queryable): Promise<ReleaseRow | null> {
  const [row] = await db.select().from(s.releases).where(eq(s.releases.status, 'active')).limit(1);
  return row ?? null;
}

export async function createRelease(deps: Deps, actor: UserRow, input: { kind: ReleaseKind; note?: string | null }, client: ClientInfo) {
  const db = requireDb(deps);
  const id = await db.transaction(
    async (tx) => {
      await syncRevisions(tx, 'import');
      const full = await exportStore(tx);
      const store = snapshotStore(full, input.kind);
      const included = new Set<string>();
      for (const type of TRANSLATABLE_TYPES) for (const r of recordsOf(store, type)) included.add(`${type}/${r.id}`);
      const latest = await tx.execute(
        sql`SELECT DISTINCT ON (entity_type, entity_id) entity_type, entity_id, entity_key, number FROM content_revisions ORDER BY entity_type, entity_id, number DESC`
      );
      const entityRevisions: Record<string, number> = {};
      for (const r of latest.rows as Array<{ entity_type: string; entity_key: string; number: number }>) {
        const k = `${r.entity_type}/${r.entity_key}`;
        if (included.has(k)) entityRevisions[k] = Number(r.number);
      }
      const translations: TranslationSummary = { locales: {} as TranslationSummary['locales'], attention: [] };
      for (const l of CONTENT_LOCALES) if (l !== 'en') translations.locales[l] = { approved: 0, outdated: 0, in_progress: 0, missing: 0 };
      for (const st of await effectiveStates(tx)) {
        if (!included.has(`${st.type}/${st.key}`)) continue;
        translations.locales[st.locale][st.state]++;
        if (st.state !== 'approved') translations.attention.push({ type: st.type, key: st.key, locale: st.locale, state: st.state });
      }
      const warnings: string[] = [];
      for (const [l, c] of Object.entries(translations.locales)) {
        if (c.outdated) warnings.push(`translation_outdated:${l}:${c.outdated}`);
        if (c.in_progress + c.missing) warnings.push(`translation_fallback:${l}:${c.in_progress + c.missing}`);
      }
      const now = deps.now();
      const sha256 = crypto.createHash('sha256').update(serialize(store)).digest('hex');
      const [snap] = await tx
        .insert(s.contentSnapshots)
        .values({ kind: input.kind, sha256, store, entityRevisions, translations, createdBy: actor.id, createdAt: now })
        .returning({ id: s.contentSnapshots.id });
      // Coalescing: an older candidate still waiting for the build slot is replaced by this one.
      const waiting = await tx.select().from(s.releases).where(and(eq(s.releases.kind, input.kind), eq(s.releases.status, 'queued')));
      const active = await activeRelease(tx);
      const [row] = await tx
        .insert(s.releases)
        .values({
          key: releaseKey(input.kind, now),
          kind: input.kind,
          status: 'queued',
          snapshotId: snap!.id,
          previousReleaseId: active?.id ?? null,
          note: input.note?.trim() || null,
          validation: { errors: [], warnings, checks: {} },
          createdAt: now,
          createdBy: actor.id,
        })
        .returning();
      await releaseEvent(tx, row!.id, 'created', actor.id, null, 'queued', { records: included.size });
      for (const w of waiting) await transition(tx, w, 'superseded', actor.id, 'superseded', {}, { by: row!.key });
      await recordAudit(
        deps,
        client,
        { action: input.kind === 'release' ? 'release.create' : 'preview.build', result: 'success', actorId: actor.id, resourceType: 'release', resourceId: row!.id, summary: { status: 'queued', count: included.size } },
        tx
      );
      return row!.id;
    },
    { isolationLevel: 'repeatable read' }
  );
  return getRelease(db, id);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function users(db: Queryable, ids: Array<string | null>) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, { id: string; name: string }>();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export interface ReleaseListQuery {
  kind?: ReleaseKind;
  status?: ReleaseStatus;
  limit: number;
  offset: number;
}

export async function listReleases(db: Queryable, q: ReleaseListQuery) {
  const where: SQL[] = [];
  if (q.kind) where.push(eq(s.releases.kind, q.kind));
  if (q.status) where.push(eq(s.releases.status, q.status));
  const cond = where.length ? and(...where) : undefined;
  const rows = await db.select().from(s.releases).where(cond).orderBy(desc(s.releases.createdAt), desc(s.releases.key)).limit(q.limit).offset(q.offset);
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(s.releases).where(cond)) as [{ n: number }];
  const u = await users(db, rows.flatMap((r) => [r.createdBy, r.activatedBy]));
  return { total: Number(n), items: rows.map((r) => summary(r, u)) };
}

function summary(r: ReleaseRow, u: Map<string, { id: string; name: string }>) {
  const v = (r.validation ?? { errors: [], warnings: [] }) as { errors?: string[]; warnings?: string[] };
  return {
    id: r.id,
    key: r.key,
    kind: r.kind,
    status: r.status,
    version: r.version,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy ? u.get(r.createdBy) ?? null : null,
    buildStartedAt: iso(r.buildStartedAt),
    buildFinishedAt: iso(r.buildFinishedAt),
    activatedAt: iso(r.activatedAt),
    activatedBy: r.activatedBy ? u.get(r.activatedBy) ?? null : null,
    errors: (v.errors ?? []).length,
    warnings: (v.warnings ?? []).length,
    failure: (r.failure as { step: string; message: string } | null) ?? null,
  };
}

export interface ReleaseChange {
  type: TranslatableType;
  key: string;
  title: string;
  change: 'added' | 'changed' | 'removed';
  revision: number | null;
}

/** True when a record is identical in both stores (e.g. a restore that brought back the live text). */
function sameRecord(a: ContentStore | null, b: ContentStore, type: TranslatableType, key: string): boolean {
  if (!a) return false;
  const x = recordsOf(a, type).find((r) => r.id === key);
  const y = recordsOf(b, type).find((r) => r.id === key);
  return !!x && !!y && canonical(x) === canonical(y);
}

/** Records that differ between a snapshot and the active release's snapshot (by content, not only by revision number). */
async function changesAgainstActive(db: Queryable, snapshot: typeof s.contentSnapshots.$inferSelect, active: ReleaseRow | null): Promise<ReleaseChange[]> {
  let base: Record<string, number> = {};
  let baseStore: ContentStore | null = null;
  if (active) {
    const [snap] = await db.select().from(s.contentSnapshots).where(eq(s.contentSnapshots.id, active.snapshotId));
    base = (snap?.entityRevisions ?? {}) as Record<string, number>;
    baseStore = (snap?.store as ContentStore) ?? null;
  }
  const mine = snapshot.entityRevisions as Record<string, number>;
  const store = snapshot.store as ContentStore;
  const title = (st: ContentStore | null, k: string) => {
    const [type, key] = k.split('/') as [TranslatableType, string];
    const rec = st ? recordsOf(st, type).find((r) => r.id === key) : null;
    return rec ? recordTitle(type, rec) : key;
  };
  const out: ReleaseChange[] = [];
  for (const [k, n] of Object.entries(mine)) {
    const [type, key] = k.split('/') as [TranslatableType, string];
    if (!(k in base)) out.push({ type, key, title: title(store, k), change: 'added', revision: n });
    else if (base[k] !== n && !sameRecord(baseStore, store, type, key)) out.push({ type, key, title: title(store, k), change: 'changed', revision: n });
  }
  for (const k of Object.keys(base)) {
    if (k in mine) continue;
    const [type, key] = k.split('/') as [TranslatableType, string];
    out.push({ type, key, title: title(baseStore, k), change: 'removed', revision: null });
  }
  return out;
}

export async function getRelease(db: Queryable, id: string, opts: { technical?: boolean } = {}) {
  const [r] = await db.select().from(s.releases).where(eq(s.releases.id, id));
  if (!r) throw new Problem('not_found');
  const [snap] = await db.select().from(s.contentSnapshots).where(eq(s.contentSnapshots.id, r.snapshotId));
  const events = await db.select().from(s.releaseEvents).where(eq(s.releaseEvents.releaseId, id)).orderBy(s.releaseEvents.id);
  const u = await users(db, [r.createdBy, r.activatedBy, ...events.map((e) => e.actorId)]);
  const active = await activeRelease(db);
  const [prev] = r.previousReleaseId ? await db.select({ key: s.releases.key }).from(s.releases).where(eq(s.releases.id, r.previousReleaseId)) : [];
  const store = snap!.store as ContentStore;
  const counts = Object.fromEntries(TRANSLATABLE_TYPES.map((t) => [t, recordsOf(store, t).length])) as Record<TranslatableType, number>;
  const v = (r.validation ?? {}) as { errors?: string[]; warnings?: string[]; checks?: Record<string, unknown> };
  return {
    ...summary(r, u),
    previousRelease: r.previousReleaseId ? { id: r.previousReleaseId, key: prev?.key ?? '' } : null,
    isActive: active?.id === r.id,
    canActivate: r.kind === 'release' && r.status === 'ready',
    canRollback: r.kind === 'release' && r.status === 'retired',
    snapshot: { id: snap!.id, sha256: snap!.sha256, createdAt: snap!.createdAt.toISOString(), counts, records: Object.keys(snap!.entityRevisions as object).length },
    translations: snap!.translations as TranslationSummary,
    changes: r.kind === 'release' ? await changesAgainstActive(db, snap!, active && active.id !== r.id ? active : r.status === 'active' ? await previousOf(db, r) : active) : [],
    validation: { errors: v.errors ?? [], warnings: v.warnings ?? [], checks: opts.technical ? v.checks ?? {} : {} },
    artifact:
      r.artifactSha256 && opts.technical ? { checksum: r.artifactSha256, bytes: r.artifactBytes ?? 0, files: r.artifactFiles ?? 0, pages: r.artifactPages ?? 0 } : null,
    hasArtifact: !!r.artifactSha256,
    events: events.map((e) => ({
      at: e.at.toISOString(),
      event: e.event,
      from: e.fromStatus,
      to: e.toStatus,
      actor: e.actorId ? u.get(e.actorId) ?? null : null,
    })),
  };
}

async function previousOf(db: Queryable, r: ReleaseRow): Promise<ReleaseRow | null> {
  if (!r.previousReleaseId) return null;
  const [p] = await db.select().from(s.releases).where(eq(s.releases.id, r.previousReleaseId));
  return p ?? null;
}

/** Overview: active release, build in progress, recent releases and failures, pending changes. */
export async function publishingOverview(deps: Deps) {
  const db = requireDb(deps);
  const active = await activeRelease(db);
  const u = await users(db, [active?.createdBy ?? null, active?.activatedBy ?? null]);
  const running = await db.select().from(s.releases).where(inArray(s.releases.status, ['queued', 'building', 'validating'])).orderBy(s.releases.createdAt);
  const recent = await listReleases(db, { kind: 'release', limit: 5, offset: 0 });
  const failed = await listReleases(db, { kind: 'release', status: 'failed', limit: 5, offset: 0 });
  const [lastOk] = await db
    .select()
    .from(s.releases)
    .where(and(eq(s.releases.kind, 'release'), inArray(s.releases.status, ['active', 'retired'])))
    .orderBy(desc(s.releases.activatedAt))
    .limit(1);
  // Records whose latest revision differs from the one in the active release.
  const latest = await db.execute(
    sql`SELECT DISTINCT ON (entity_type, entity_id) entity_type, entity_id, entity_key, number, title, created_at, data FROM content_revisions ORDER BY entity_type, entity_id, number DESC`
  );
  let live: Record<string, number> = {};
  let liveStore: ContentStore | null = null;
  if (active) {
    const [snap] = await db.select({ e: s.contentSnapshots.entityRevisions, store: s.contentSnapshots.store }).from(s.contentSnapshots).where(eq(s.contentSnapshots.id, active.snapshotId));
    live = (snap?.e ?? {}) as Record<string, number>;
    liveStore = (snap?.store as ContentStore) ?? null;
  }
  const sameAsLive = (type: TranslatableType, key: string, data: unknown) => {
    const rec = liveStore ? recordsOf(liveStore, type).find((r) => r.id === key) : undefined;
    return !!rec && canonical(rec) === canonical(data);
  };
  const statuses = new Map<string, string>();
  for (const type of TRANSLATABLE_TYPES) {
    const { rows } = await db.execute(sql.raw(`SELECT key, status FROM ${REVIEW_TABLES[type].entity}`));
    for (const r of rows as Array<{ key: string; status: string }>) statuses.set(`${type}/${r.key}`, r.status);
  }
  const pending = (latest.rows as Array<{ entity_type: TranslatableType; entity_id: string; entity_key: string; number: number; title: string; created_at: string | Date; data: unknown }>)
    .filter((r) => {
      const k = `${r.entity_type}/${r.entity_key}`;
      const status = statuses.get(k);
      if (status === 'published') return live[k] !== Number(r.number) && !sameAsLive(r.entity_type, r.entity_key, typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      return k in live; // unpublished or archived since the active release
    })
    .map((r) => ({ type: r.entity_type, id: r.entity_id, key: r.entity_key, title: r.title, revision: Number(r.number), status: statuses.get(`${r.entity_type}/${r.entity_key}`) ?? 'draft', liveRevision: live[`${r.entity_type}/${r.entity_key}`] ?? null, changedAt: new Date(r.created_at).toISOString() }));
  return {
    active: active ? { ...summary(active, u) } : null,
    lastSuccessful: lastOk ? { id: lastOk.id, key: lastOk.key, activatedAt: iso(lastOk.activatedAt) } : null,
    running: running.map((r) => ({ id: r.id, key: r.key, kind: r.kind, status: r.status, createdAt: r.createdAt.toISOString(), buildStartedAt: iso(r.buildStartedAt) })),
    recent: recent.items,
    failed: failed.items,
    pending,
    currentOnDisk: readCurrent(deps.config.publishing.releasesDir),
  };
}

// ---------------------------------------------------------------------------
// Activation, rollback, retry
// ---------------------------------------------------------------------------

/** Run `fn` holding a session-level advisory lock on a dedicated connection; null when busy. */
export async function withAdvisoryLock<T>(deps: Deps, key: number, fn: () => Promise<T>): Promise<T | null> {
  const pool = (requireDb(deps) as unknown as { $client: { connect(): Promise<{ query(q: string, v?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }> } }).$client;
  const conn = await pool.connect();
  try {
    const { rows } = await conn.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
    if (!rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await conn.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    conn.release();
  }
}

export interface ActivationHooks {
  /** Tests: called after the symlink switch, before the database commit. */
  afterSwitch?: () => void | Promise<void>;
}

export async function activateRelease(
  deps: Deps,
  actor: UserRow,
  id: string,
  expectedVersion: number,
  mode: 'publish' | 'rollback',
  client: ClientInfo,
  hooks: ActivationHooks = {}
) {
  const db = requireDb(deps);
  const root = deps.config.publishing.releasesDir;
  const result = await withAdvisoryLock(deps, ACTIVATION_LOCK, async () => {
    const [target] = await db.select().from(s.releases).where(eq(s.releases.id, id));
    if (!target) throw new Problem('not_found');
    if (target.version !== expectedVersion) throw new Problem('edit_conflict');
    if (target.kind !== 'release') throw new Problem('invalid_transition', 'Предпросмотр нельзя опубликовать.');
    const want: ReleaseStatus = mode === 'publish' ? 'ready' : 'retired';
    if (target.status !== want)
      throw new Problem(
        'invalid_transition',
        target.status === 'active' ? 'Этот релиз уже на сайте.' : mode === 'publish' ? 'Опубликовать можно только проверенный релиз.' : 'Вернуть можно только ранее опубликованный релиз.'
      );
    const active = await activeRelease(db);
    if (mode === 'publish' && active) {
      const [mine] = await db.select({ at: s.contentSnapshots.createdAt }).from(s.contentSnapshots).where(eq(s.contentSnapshots.id, target.snapshotId));
      const [theirs] = await db.select({ at: s.contentSnapshots.createdAt }).from(s.contentSnapshots).where(eq(s.contentSnapshots.id, active.snapshotId));
      if (mine && theirs && mine.at < theirs.at)
        throw new Problem('invalid_transition', 'Этот релиз собран из более старого содержимого, чем релиз на сайте. Для возврата используйте откат.');
    }
    const fail = async (reason: string, message: string) => {
      await releaseEvent(db, target.id, 'activation_failed', actor.id, target.status, target.status, { reason });
      await recordAudit(deps, client, { action: mode === 'publish' ? 'release.activate' : 'release.rollback', result: 'failure', actorId: actor.id, resourceType: 'release', resourceId: target.id, summary: { reason } });
      throw new Problem('invalid_transition', message);
    };
    const check = verifyArtifact(root, target.key, target.artifactSha256 ?? '');
    if (!check.ok) return fail(`artifact_${check.reason}`, 'Файлы релиза отсутствуют или изменены — опубликовать их нельзя. Сайт не изменился.');
    let previous: string | null;
    try {
      previous = switchCurrent(root, target.key);
    } catch {
      return fail('switch_failed', 'Не удалось переключить сайт на этот релиз. Сайт не изменился.');
    }
    const restore = () => {
      try {
        if (previous) switchCurrent(root, previous);
        else removeCurrent(root);
      } catch {
        /* reported by the startup reconciliation */
      }
    };
    const problems = smokeCheck(root, CONTENT_LOCALES);
    if (problems.length) {
      restore();
      return fail('smoke_failed', 'Проверка после переключения не пройдена — сайт возвращён на предыдущий релиз.');
    }
    try {
      await hooks.afterSwitch?.();
      await db.transaction(async (tx) => {
        const [t] = await tx.select().from(s.releases).where(eq(s.releases.id, target.id)).for('update');
        if (!t || t.status !== want || t.version !== expectedVersion) throw new Problem('edit_conflict');
        if (active && active.id !== t.id) {
          const [a] = await tx.select().from(s.releases).where(eq(s.releases.id, active.id)).for('update');
          if (!a || a.status !== 'active') throw new Problem('edit_conflict');
          await transition(tx, a, 'retired', actor.id, mode === 'publish' ? 'replaced' : 'rolled_back_from', {}, { by: t.key });
        }
        await transition(tx, t, 'active', actor.id, mode === 'publish' ? 'activated' : 'rollback', { activatedAt: deps.now(), activatedBy: actor.id }, { replaced: active?.key ?? null });
        if (mode === 'publish') {
          const stale = await tx.select().from(s.releases).where(and(eq(s.releases.kind, 'release'), eq(s.releases.status, 'ready'), ne(s.releases.id, t.id)));
          for (const r of stale) await transition(tx, r, 'superseded', actor.id, 'superseded', {}, { by: t.key });
        }
        await recordAudit(
          deps,
          client,
          { action: mode === 'publish' ? 'release.activate' : 'release.rollback', result: 'success', actorId: actor.id, resourceType: 'release', resourceId: t.id, summary: { status: 'active', target: t.key } },
          tx
        );
      });
    } catch (e) {
      restore();
      if (e instanceof Problem) throw e;
      return fail('commit_failed', 'Не удалось сохранить публикацию — сайт возвращён на предыдущий релиз.');
    }
    return true;
  });
  if (result === null) throw new Problem('conflict', 'Сейчас выполняется другая публикация. Повторите через минуту.');
  return getRelease(db, id, { technical: true });
}

function removeCurrent(root: string) {
  // No release was active before: remove the link again.
  fs.rmSync(path.join(root, 'current'), { force: true });
}

/** A failed build is tried again as a new release with the same snapshot (system.deploy). */
export async function retryRelease(deps: Deps, actor: UserRow, id: string, client: ClientInfo) {
  const db = requireDb(deps);
  const newId = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(s.releases).where(eq(s.releases.id, id)).for('update');
    if (!r) throw new Problem('not_found');
    if (r.status !== 'failed') throw new Problem('invalid_transition', 'Повторить можно только неудавшуюся сборку.');
    const now = deps.now();
    const active = await activeRelease(tx);
    const [row] = await tx
      .insert(s.releases)
      .values({ key: releaseKey(r.kind, now), kind: r.kind, status: 'queued', snapshotId: r.snapshotId, previousReleaseId: active?.id ?? null, note: r.note, validation: { errors: [], warnings: ((r.validation as { warnings?: string[] } | null)?.warnings ?? []).filter((w) => w.startsWith('translation_')), checks: {} }, createdAt: now, createdBy: actor.id })
      .returning();
    await releaseEvent(tx, row!.id, 'created', actor.id, null, 'queued', { retry_of: r.key });
    await releaseEvent(tx, r.id, 'retried', actor.id, 'failed', 'failed', { by: row!.key });
    await recordAudit(deps, client, { action: 'release.retry', result: 'success', actorId: actor.id, resourceType: 'release', resourceId: row!.id, summary: { target: r.key } }, tx);
    return row!.id;
  });
  return getRelease(db, newId);
}
