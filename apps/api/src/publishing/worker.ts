/**
 * Publishing worker (Phase G, docs/admin-publishing.md §5).
 *
 * One heavy job at a time, globally: a job runs only while its process holds the PostgreSQL
 * advisory lock BUILD_LOCK (session-level, on a dedicated connection). The queue is the `releases`
 * table itself (status `queued`, oldest first, claimed with FOR UPDATE SKIP LOCKED) — no second
 * queue system. No database transaction stays open during a build; every state change is its own
 * short statement.
 *
 * Crash safety:
 *  - the worker refreshes `heartbeat_at` while it builds; a release left in building / validating
 *    with an old heartbeat (lost worker) is marked failed (step `worker_lost`) by the next worker
 *    pass — it is never resumed or activated;
 *  - the build workspace is always removed; a half-stored artifact is removed before failing;
 *  - builds never activate anything: activation is an explicit, separate user action.
 *  - on start the worker reconciles the database with the `current` symlink (the file system is the
 *    truth about what is served, approved §3.2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { CONTENT_LOCALES, type ReleaseStatus } from '@soltex/core/domain';
import type { ContentStore } from '@soltex/core/content';
import * as s from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { generateNextVariants } from '../media/variants.ts';
import { readCurrent, readTree, releaseDir, removeDir, storeArtifact, type ArtifactTree } from './artifacts.ts';
import { BuildFailure, type Builder } from './builder.ts';
import { transition, withAdvisoryLock } from './releases.ts';

export const BUILD_LOCK = 724_001;
export const STALE_AFTER_MS = 2 * 60_000;

type ReleaseRow = typeof s.releases.$inferSelect;

/** Releases left in building / validating by a lost worker → failed. */
export async function recoverStale(deps: Deps, staleMs = STALE_AFTER_MS): Promise<number> {
  const db = requireDb(deps);
  const cutoff = new Date(deps.now().getTime() - staleMs);
  const stuck = await db
    .select()
    .from(s.releases)
    .where(and(inArray(s.releases.status, ['building', 'validating']), lt(sql`coalesce(${s.releases.heartbeatAt}, ${s.releases.createdAt})`, cutoff)));
  let n = 0;
  for (const r of stuck) {
    const ok = await db.transaction((tx) =>
      transition(tx, r, 'failed', null, 'worker_lost', { failure: { step: 'worker_lost', message: 'Сборка прервалась (процесс сборки остановлен). Повторите публикацию.' }, buildFinishedAt: deps.now() })
    );
    if (ok) {
      removeDir(path.join(deps.config.publishing.releasesDir, 'build', r.key));
      n++;
    }
  }
  return n;
}

/**
 * Make the database match the `current` symlink (startup reconciliation). Returns what changed.
 * Nothing changes when they agree or when no release was ever activated.
 */
export async function reconcileActive(deps: Deps): Promise<string | null> {
  const db = requireDb(deps);
  const key = readCurrent(deps.config.publishing.releasesDir);
  const [active] = await db.select().from(s.releases).where(eq(s.releases.status, 'active'));
  if (!key || active?.key === key) return null;
  const [served] = await db.select().from(s.releases).where(eq(s.releases.key, key));
  if (!served || !['ready', 'retired'].includes(served.status)) return null;
  await db.transaction(async (tx) => {
    if (active) await transition(tx, active, 'retired', null, 'reconciled', {}, { served: key });
    await transition(tx, served, 'active', null, 'reconciled', { activatedAt: deps.now() }, { reason: 'current symlink' });
  });
  return key;
}

export interface ValidationOutcome {
  errors: string[];
  warnings: string[];
  checks: Record<string, unknown>;
  pages: number;
}

const TEXT = /\.(html|js|css|json|xml|txt|webmanifest)$/;

/** Checks of a finished build before it may be stored as a release (blocking errors vs warnings). */
export function validateArtifact(deps: Deps, distDir: string, store: ContentStore, tree: ArtifactTree, previousPages: number | null): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const has = new Set(tree.files.map((f) => f.path));
  const locales = CONTENT_LOCALES.filter((l) => l !== 'en');
  for (const f of ['index.html', '404.html', 'sitemap.xml', ...locales.flatMap((l) => [`${l}.html`, `${l}/404.html`])]) if (!has.has(f)) errors.push(`missing_file:${f}`);
  // Every published routable record has its page in every language.
  for (const [coll, dir] of [['projects', 'projects'], ['technologies', 'technologies'], ['products', 'products']] as const) {
    for (const r of store[coll] as Array<{ slug: string; status: string }>) {
      if (r.status !== 'published') continue;
      for (const l of CONTENT_LOCALES) {
        const p = l === 'en' ? `${dir}/${r.slug}.html` : `${l}/${dir}/${r.slug}.html`;
        if (!has.has(p)) errors.push(`missing_page:${p}`);
      }
    }
  }
  // No secrets or server addresses in the public files.
  const secrets = [deps.config.databaseUrl, deps.config.hashSecret.length ? deps.config.hashSecret.toString('base64') : ''].filter((x) => x && x.length >= 12);
  const patterns = [/postgres(ql)?:\/\//i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /DATA_ENCRYPTION_KEYS|HASH_SECRET|DATABASE_URL/];
  for (const f of tree.files) {
    if (!TEXT.test(f.path)) continue;
    const text = fs.readFileSync(path.join(distDir, f.path), 'utf8');
    if (patterns.some((p) => p.test(text)) || secrets.some((x) => text.includes(x))) errors.push(`secret_like:${f.path}`);
  }
  const pages = tree.files.filter((f) => f.path.endsWith('.html')).length;
  if (pages === 0) errors.push('no_pages');
  if (previousPages && Math.abs(pages - previousPages) > Math.max(5, previousPages * 0.1)) warnings.push(`page_count:${previousPages}→${pages}`);
  return { errors, warnings, checks: { files: tree.files.length, bytes: tree.bytes, pages, previousPages }, pages };
}

export type JobResult = { outcome: 'busy' } | { outcome: 'idle' } | { outcome: 'done'; key: string; status: ReleaseStatus };

/** Claim the oldest queued release and build it. One call = at most one build. */
export async function runNextJob(deps: Deps, builder: Builder, opts: { staleMs?: number } = {}): Promise<JobResult> {
  const result = await withAdvisoryLock(deps, BUILD_LOCK, async (): Promise<JobResult> => {
    await recoverStale(deps, opts.staleMs);
    const db = requireDb(deps);
    const claimed = await db.transaction(async (tx) => {
      const { rows } = await tx.execute(sql`SELECT id FROM releases WHERE status = 'queued' ORDER BY created_at, key LIMIT 1 FOR UPDATE SKIP LOCKED`);
      const id = (rows[0] as { id: string } | undefined)?.id;
      if (!id) return null;
      const [r] = await tx.select().from(s.releases).where(eq(s.releases.id, id));
      const now = deps.now();
      const ok = await transition(tx, r!, 'building', null, 'build_started', { buildStartedAt: now, heartbeatAt: now, attempt: sql`${s.releases.attempt} + 1` as unknown as number });
      return ok ? r! : null;
    });
    if (!claimed) return { outcome: 'idle' };
    return { outcome: 'done', key: claimed.key, status: await build(deps, builder, claimed) };
  });
  return result ?? { outcome: 'busy' };
}

async function build(deps: Deps, builder: Builder, r: ReleaseRow): Promise<ReleaseStatus> {
  const db = requireDb(deps);
  const root = deps.config.publishing.releasesDir;
  const heartbeat = () => {
    void db.update(s.releases).set({ heartbeatAt: deps.now() }).where(eq(s.releases.id, r.id)).catch(() => {});
  };
  const base = (r.validation ?? { errors: [], warnings: [], checks: {} }) as { errors: string[]; warnings: string[]; checks: Record<string, unknown> };
  const failWith = async (from: ReleaseStatus, step: string, message: string, errors: string[], warnings: string[] = []) => {
    removeDir(releaseDir(root, r.key));
    await db.transaction((tx) =>
      transition(tx, { ...r, status: from }, 'failed', null, 'build_failed', {
        failure: { step, message },
        validation: { errors: errors.slice(0, 200), warnings: [...base.warnings, ...warnings].slice(0, 200), checks: base.checks },
        buildFinishedAt: deps.now(),
        heartbeatAt: deps.now(),
      }, { step })
    );
    await recordAudit(deps, null, { action: r.kind === 'release' ? 'release.build' : 'preview.build', result: 'failure', resourceType: 'release', resourceId: r.id, summary: { status: 'failed', reason: step } });
    return 'failed' as const;
  };
  try {
    const [snap] = await db.select().from(s.contentSnapshots).where(eq(s.contentSnapshots.id, r.snapshotId));
    const store = snap!.store as ContentStore;
    let built;
    try {
      built = await builder.build({ root, key: r.key, store, heartbeat });
    } catch (e) {
      if (e instanceof BuildFailure) return await failWith('building', e.issue.step, e.issue.message, e.issue.errors);
      return await failWith('building', 'build', 'Ошибка сборки сайта', []);
    }
    await db.transaction((tx) => transition(tx, { ...r, status: 'building' }, 'validating', null, 'build_finished', { heartbeatAt: deps.now() }));
    const tree = readTree(built.distDir);
    const [prev] = await db
      .select({ pages: s.releases.artifactPages })
      .from(s.releases)
      .where(and(eq(s.releases.kind, 'release'), eq(s.releases.status, 'active')));
    const v = validateArtifact(deps, built.distDir, store, tree, prev?.pages ?? null);
    const warnings = [...base.warnings, ...built.warnings.map((w) => `content:${w}`).slice(0, 100), ...v.warnings];
    if (v.errors.length) return await failWith('validating', 'artifact', 'Проверка готового сайта не пройдена', v.errors, [...built.warnings.map((w) => `content:${w}`), ...v.warnings]);
    const manifest = {
      release_id: r.key,
      kind: r.kind,
      content_snapshot_id: r.snapshotId,
      content_snapshot_sha256: snap!.sha256,
      entity_revisions: snap!.entityRevisions,
      build_started_at: r.buildStartedAt?.toISOString() ?? null,
      build_finished_at: deps.now().toISOString(),
      validation_result: { status: 'passed', blocking: 0, warnings: warnings.length, pages: v.pages },
      node_version: process.version,
      triggered_by: r.createdBy ? `user:${r.createdBy}` : 'system',
    };
    let stored: ArtifactTree;
    try {
      stored = storeArtifact(root, r.key, built.distDir, manifest, tree);
    } catch {
      return await failWith('validating', 'store', 'Не удалось сохранить файлы релиза', []);
    }
    await db.transaction((tx) =>
      transition(tx, { ...r, status: 'validating' }, 'ready', null, 'build_succeeded', {
        validation: { errors: [], warnings, checks: v.checks },
        artifactSha256: stored.checksum,
        artifactBytes: stored.bytes,
        artifactFiles: stored.files.length,
        artifactPages: v.pages,
        buildFinishedAt: deps.now(),
        heartbeatAt: deps.now(),
      })
    );
    await recordAudit(deps, null, { action: r.kind === 'release' ? 'release.build' : 'preview.build', result: 'success', resourceType: 'release', resourceId: r.id, summary: { status: 'ready', count: v.pages } });
    return 'ready';
  } finally {
    builder.cleanup(root, r.key);
  }
}

/** Long-running loop (`npm run worker -w @soltex/api`). */
export async function workerLoop(deps: Deps, builder: Builder, signal: AbortSignal, intervalMs = 2000) {
  await recoverStale(deps).catch(() => 0);
  await reconcileActive(deps).catch(() => null);
  while (!signal.aborted) {
    let r: JobResult = { outcome: 'idle' };
    try {
      r = await runNextJob(deps, builder);
    } catch (e) {
      console.error('worker: job error', (e as Error).message);
    }
    // Phase J-2: with no release to build, make the responsive copies of one waiting image.
    let media: 'done' | 'idle' = 'idle';
    if (r.outcome === 'idle')
      try {
        media = await generateNextVariants(deps);
      } catch (e) {
        console.error('worker: image variants error', (e as Error).message);
      }
    if (r.outcome !== 'done' && media !== 'done') await new Promise((res) => setTimeout(res, intervalMs));
  }
}

