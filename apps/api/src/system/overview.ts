/**
 * Phase L (review §X, approved §19): the numbers of «Обзор», the state of «Система» and the content
 * search of ⌘K. Read-only. Every block of the dashboard and every kind of search result is returned
 * only to a role with the matching read permission; nothing here exposes paths, connection strings
 * or secrets (approved §19).
 */
import fs from 'node:fs';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { hasPermission, SOURCE_LOCALE, type LeadStatus, type Role, type TranslatedLocale } from '@soltex/core/domain';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES, type TranslatableType } from '../content/review-tables.ts';
import { translationOverview } from '../content/translations/service.ts';
import { publishingOverview } from '../publishing/releases.ts';
import { runChecks, seoContext } from '../seo/report.ts';
import { listMedia, mediaSizes, needsAttention } from '../media/service.ts';

/** Database application name of the worker process; «Система» looks for it in pg_stat_activity. */
export const WORKER_APPLICATION_NAME = 'soltex-worker';

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

// ---------------------------------------------------------------------------
// Обзор
// ---------------------------------------------------------------------------

export interface LastBuild {
  key: string;
  ok: boolean;
  finishedAt: string;
  durationSeconds: number | null;
  /** Failure message in Russian (failed builds only). */
  reason: string | null;
}

async function lastBuild(db: ReturnType<typeof requireDb>): Promise<LastBuild | null> {
  const [r] = await db
    .select()
    .from(s.releases)
    .where(and(eq(s.releases.kind, 'release'), isNotNull(s.releases.buildFinishedAt)))
    .orderBy(desc(s.releases.buildFinishedAt))
    .limit(1);
  if (!r) return null;
  const failed = r.status === 'failed';
  return {
    key: r.key,
    ok: !failed,
    finishedAt: r.buildFinishedAt!.toISOString(),
    durationSeconds: r.buildStartedAt ? Math.max(0, Math.round((r.buildFinishedAt!.getTime() - r.buildStartedAt.getTime()) / 1000)) : null,
    reason: failed ? (((r.failure as { message?: string } | null)?.message ?? null) as string | null) : null,
  };
}

export async function dashboard(deps: Deps, role: Role) {
  const db = requireDb(deps);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(role, p);
  const out: {
    leads?: { byStatus: Partial<Record<LeadStatus, number>>; notifyFailed: number; formsLive: boolean };
    seo?: { blocking: number; warning: number; info: number };
    translations?: { locales: Array<{ locale: TranslatedLocale; total: number; missing: number; inProgress: number; outdated: number; completion: number }> };
    content?: { drafts: Array<{ type: TranslatableType; count: number }>; pending: number; recent: Array<{ type: TranslatableType; id: string; title: string; at: string; by: string | null }> };
    publishing?: { active: { key: string; activatedAt: string | null } | null; lastBuild: LastBuild | null; running: number };
    media?: { total: number; attention: number; pendingCopies: number };
  } = {};

  if (can('leads.read')) {
    const rows = await db
      .select({ status: s.leads.status, n: sql<number>`count(*)::int` })
      .from(s.leads)
      .where(and(isNull(s.leads.deletedAt), isNull(s.leads.anonymizedAt)))
      .groupBy(s.leads.status);
    const [{ n: failed }] = (await db.execute(sql`SELECT count(*)::int AS n FROM outbox WHERE kind = 'lead.created' AND sent_at IS NULL AND last_error IS NOT NULL`)).rows as [{ n: number }];
    out.leads = { byStatus: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])), notifyFailed: Number(failed), formsLive: deps.config.site.leadsEnabled };
  }

  if (can('seo.read')) {
    const report = runChecks(await seoContext(db, undefined, await mediaSizes(deps, db)));
    out.seo = report.summary;
  }

  if (can('content.read')) {
    const t = await translationOverview(deps);
    out.translations = { locales: t.locales.map(({ locale, total, missing, inProgress, outdated, completion }) => ({ locale, total, missing, inProgress, outdated, completion })) };

    const drafts: Array<{ type: TranslatableType; count: number }> = [];
    for (const type of TRANSLATABLE_TYPES) {
      const { rows } = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${REVIEW_TABLES[type].entity} WHERE status = 'draft'`));
      const count = Number((rows[0] as { n: number }).n);
      if (count) drafts.push({ type, count });
    }
    const pub = await publishingOverview(deps);
    // The last edit of each of the five most recently edited records (edits by people, not imports).
    const { rows: recentRows } = await db.execute(sql`
      SELECT r.entity_type AS type, r.entity_id AS id, r.title, r.created_at AS at, u.name AS by
      FROM (SELECT DISTINCT ON (entity_type, entity_id) * FROM content_revisions WHERE created_by IS NOT NULL ORDER BY entity_type, entity_id, created_at DESC, id DESC) r
      LEFT JOIN users u ON u.id = r.created_by
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 5`);
    out.content = {
      drafts,
      pending: pub.pending.length,
      recent: (recentRows as Array<{ type: TranslatableType; id: string; title: string; at: Date | string; by: string | null }>).map((r) => ({ type: r.type, id: r.id, title: r.title, at: new Date(r.at).toISOString(), by: r.by ?? null })),
    };
    out.publishing = {
      active: pub.active ? { key: pub.active.key, activatedAt: pub.active.activatedAt ?? null } : null,
      lastBuild: await lastBuild(db),
      running: pub.running.filter((r) => r.kind === 'release').length,
    };
  }

  if (can('media.read')) {
    const { items } = await listMedia(deps, {});
    out.media = {
      total: items.length,
      attention: items.filter(needsAttention).length,
      pendingCopies: items.filter((m) => m.variants.state === 'pending').length,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Система
// ---------------------------------------------------------------------------

export interface DiskUsage {
  /** What lives there, in Russian. */
  label: string;
  totalBytes: number;
  freeBytes: number;
}

/** Free and total space of the file systems holding the releases and the media library (one entry per device). */
export function diskUsage(dirs: Array<{ label: string; dir: string }>): DiskUsage[] {
  const out: Array<DiskUsage & { dev: number }> = [];
  for (const { label, dir } of dirs) {
    try {
      const dev = fs.statSync(dir).dev;
      const same = out.find((d) => d.dev === dev);
      if (same) {
        same.label = `${same.label}, ${label.toLowerCase()}`;
        continue;
      }
      const st = fs.statfsSync(dir);
      out.push({ label, dev, totalBytes: st.blocks * st.bsize, freeBytes: st.bavail * st.bsize });
    } catch {
      /* missing directory: not reported */
    }
  }
  return out.map(({ dev: _dev, ...d }) => d);
}

export async function systemStatus(deps: Deps) {
  const db = requireDb(deps);
  const t0 = performance.now();
  let database: { ok: boolean; latencyMs: number; version: string | null; sizeBytes: number | null };
  try {
    const { rows } = await db.execute(sql`SELECT current_setting('server_version') AS v, pg_database_size(current_database())::bigint AS size`);
    const r = rows[0] as { v: string; size: string };
    database = { ok: true, latencyMs: Math.round(performance.now() - t0), version: r.v.split(' ')[0] ?? null, sizeBytes: Number(r.size) };
  } catch {
    database = { ok: false, latencyMs: Math.round(performance.now() - t0), version: null, sizeBytes: null };
  }

  const { rows: w } = await db.execute(
    sql`SELECT count(*)::int AS n, min(backend_start) AS since, max(greatest(state_change, query_start)) AS last FROM pg_stat_activity WHERE application_name = ${WORKER_APPLICATION_NAME}`
  );
  const worker = w[0] as { n: number; since: Date | null; last: Date | null };

  const [queue] = (
    await db.execute(sql`SELECT
      (SELECT count(*)::int FROM releases WHERE status IN ('queued', 'building', 'validating')) AS builds,
      (SELECT count(*)::int FROM outbox WHERE sent_at IS NULL) AS mail,
      (SELECT count(*)::int FROM outbox WHERE sent_at IS NULL AND last_error IS NOT NULL) AS mail_failed,
      (SELECT count(*)::int FROM media WHERE kind = 'image' AND width IS NOT NULL AND (variants IS NULL OR variants->>'source' IS DISTINCT FROM src)) AS copies`)
  ).rows as [{ builds: number; mail: number; mail_failed: number; copies: number }];

  const [active] = await db.select().from(s.releases).where(eq(s.releases.status, 'active')).limit(1);
  const [lastOk] = await db
    .select()
    .from(s.releases)
    .where(and(eq(s.releases.kind, 'release'), inArray(s.releases.status, ['ready', 'active', 'retired', 'superseded']), isNotNull(s.releases.buildFinishedAt)))
    .orderBy(desc(s.releases.buildFinishedAt))
    .limit(1);
  const [lastFailed] = await db
    .select()
    .from(s.releases)
    .where(and(eq(s.releases.kind, 'release'), eq(s.releases.status, 'failed')))
    .orderBy(desc(s.releases.createdAt))
    .limit(1);
  const build = (r: typeof lastOk) =>
    r
      ? {
          key: r.key,
          at: iso(r.buildFinishedAt ?? r.createdAt)!,
          durationSeconds: r.buildStartedAt && r.buildFinishedAt ? Math.round((r.buildFinishedAt.getTime() - r.buildStartedAt.getTime()) / 1000) : null,
          reason: r.status === 'failed' ? ((r.failure as { message?: string } | null)?.message ?? null) : null,
        }
      : null;

  return {
    database,
    worker: { running: Number(worker.n) > 0, since: iso(worker.since), lastActivity: iso(worker.last) },
    queue: { builds: Number(queue.builds), mail: Number(queue.mail), mailFailed: Number(queue.mail_failed), imageCopies: Number(queue.copies) },
    site: {
      active: active ? { key: active.key, activatedAt: iso(active.activatedAt) } : null,
      lastSuccessfulBuild: build(lastOk),
      lastFailedBuild: build(lastFailed),
    },
    disk: diskUsage([
      { label: 'Релизы сайта', dir: deps.config.publishing.releasesDir },
      { label: 'Медиатека', dir: deps.config.media.dir },
    ]),
    mail: { configured: deps.config.mail !== null, recipients: deps.config.leads.notifyTo.length },
    backups: backupStatus(deps),
    checkedAt: deps.now().toISOString(),
  };
}

/** Older than this, the last backup is reported as stale (the timer runs nightly). */
export const BACKUP_STALE_MS = 36 * 60 * 60 * 1000;

/**
 * Backups (Phase N-0): deploy/scripts/backup.sh writes the time of its last success to
 * BACKUP_STATUS_FILE. Only that time is read — no paths, sizes or credentials reach the admin.
 */
export function backupStatus(deps: Deps): { configured: boolean; lastSuccessAt: string | null; stale: boolean } {
  const file = deps.config.backupStatusFile;
  if (!file) return { configured: false, lastSuccessAt: null, stale: false };
  let at: Date | null = null;
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    const d = new Date(text);
    if (/^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(d.getTime())) at = d;
  } catch {
    /* no backup yet, or unreadable: reported as stale */
  }
  return { configured: true, lastSuccessAt: at ? at.toISOString() : null, stale: !at || deps.now().getTime() - at.getTime() > BACKUP_STALE_MS };
}

// ---------------------------------------------------------------------------
// ⌘K content search
// ---------------------------------------------------------------------------

export type SearchHit =
  | { kind: 'content'; type: TranslatableType; id: string; title: string; status: 'draft' | 'published' | 'archived'; match: string | null }
  | { kind: 'media'; id: string; title: string; mediaKind: 'image' | 'video' }
  | { kind: 'lead'; id: string; title: string; status: LeadStatus };

export const SEARCH_MIN_LENGTH = 2 as const;
const PER_GROUP = 5;

const likeOf = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Titles of the seven content types in every language and their stable keys; media file names
 * and paths; lead numbers and names. Groups the role may not read are left out.
 */
export async function search(deps: Deps, role: Role, query: string): Promise<SearchHit[]> {
  const db = requireDb(deps);
  const q = query.trim();
  if (q.length < SEARCH_MIN_LENGTH) return [];
  const like = likeOf(q);
  const hits: SearchHit[] = [];

  if (hasPermission(role, 'content.read')) {
    for (const type of TRANSLATABLE_TYPES) {
      const t = REVIEW_TABLES[type];
      const title = t.title; // uses aliases t (translation) and e (entity)
      const { rows } = await db.execute(sql`
        SELECT e.id, e.key, e.status,
          (SELECT ${sql.raw(title)} FROM ${sql.raw(t.tr)} t WHERE t.${sql.raw(t.owner)} = e.id AND t.locale = ${SOURCE_LOCALE}) AS title,
          (SELECT t.locale || '|' || ${sql.raw(title)} FROM ${sql.raw(t.tr)} t
             WHERE t.${sql.raw(t.owner)} = e.id AND ${sql.raw(title)} ILIKE ${like}
             ORDER BY (t.locale = ${SOURCE_LOCALE}) DESC, t.locale LIMIT 1) AS hit
        FROM ${sql.raw(t.entity)} e
        WHERE e.key ILIKE ${like}
           OR EXISTS (SELECT 1 FROM ${sql.raw(t.tr)} t WHERE t.${sql.raw(t.owner)} = e.id AND ${sql.raw(title)} ILIKE ${like})
        ORDER BY (e.status = 'archived'), e.position
        LIMIT ${PER_GROUP}`);
      for (const r of rows as Array<{ id: string; key: string; status: 'draft' | 'published' | 'archived'; title: string | null; hit: string | null }>) {
        const [locale, text] = r.hit ? [r.hit.slice(0, r.hit.indexOf('|')), r.hit.slice(r.hit.indexOf('|') + 1)] : [null, null];
        // Show the matching translation when it is not the source title (e.g. a Russian query).
        const match = locale && locale !== SOURCE_LOCALE && text !== r.title ? `${locale.toUpperCase()}: ${text}` : null;
        hits.push({ kind: 'content', type, id: r.id, title: r.title ?? r.key, status: r.status, match });
      }
    }
  }

  if (hasPermission(role, 'media.read')) {
    const rows = await db
      .select({ id: s.media.id, key: s.media.key, src: s.media.src, name: s.media.originalName, kind: s.media.kind })
      .from(s.media)
      .where(sql`${s.media.key} ILIKE ${like} OR ${s.media.src} ILIKE ${like} OR ${s.media.originalName} ILIKE ${like}`)
      .orderBy(desc(s.media.updatedAt))
      .limit(PER_GROUP);
    for (const r of rows) hits.push({ kind: 'media', id: r.id, title: r.name ?? r.src.split('/').pop() ?? r.key, mediaKind: r.kind });
  }

  if (hasPermission(role, 'leads.read')) {
    const rows = await db
      .select({ id: s.leads.id, reference: s.leads.reference, name: s.leads.name, status: s.leads.status })
      .from(s.leads)
      .where(and(isNull(s.leads.deletedAt), isNull(s.leads.anonymizedAt), sql`(${s.leads.reference} ILIKE ${like} OR ${s.leads.name} ILIKE ${like} OR ${s.leads.company} ILIKE ${like})`))
      .orderBy(desc(s.leads.createdAt))
      .limit(PER_GROUP);
    for (const r of rows) hits.push({ kind: 'lead', id: r.id, title: r.name ? `${r.reference} · ${r.name}` : r.reference, status: r.status });
  }
  return hits;
}
