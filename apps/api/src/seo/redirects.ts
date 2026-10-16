/**
 * Redirects (Phase I-2, docs/admin-seo.md §8; approved §11, review §O).
 *
 * The `redirects` table is the source of truth. Rules are part of the working copy: they reach the
 * site with the next release (the release snapshot carries them) and are served by the lookup
 * endpoint from the ACTIVE release, so a redirect never points to a page that is not live yet.
 *
 * Every save goes through one path (`saveRule`):
 *   1. paths normalized and checked (syntax of §11.2, no query, no language prefix on rules for
 *      all languages, no static-asset source);
 *   2. chains collapsed: the rule points to the final page, rules pointing to its source are
 *      rewritten (or removed when they would point to themselves);
 *   3. the SEO checker runs on the next release with the change applied; a BLOCKING issue of any
 *      touched rule (target missing, shadows a live page, duplicate, loop) rolls everything back.
 */
import crypto from 'node:crypto';
import { and, asc, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  buildRedirectIndex,
  checkSeo,
  collapseRedirects,
  formatSeoIssue,
  normalizeRedirectPath,
  redirectLocation,
  redirectPathProblem,
  resolveRedirect,
  pathProblem,
  type ConcreteRedirect,
  type RedirectRule,
  type SeoIssue,
} from '@soltex/core/seo';
import type { ContentStore } from '@soltex/core/content';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import type { Queryable } from '../db/client.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem, type FieldError } from '../http/problem.ts';
import { exportStore } from '../content/export.ts';
import { snapshotStore } from '../publishing/releases.ts';
import type { UserRow } from '../auth/sessions.ts';

type RedirectRow = typeof s.redirects.$inferSelect;
export type RedirectSource = RedirectRow['source'];

export interface RedirectInput {
  from: string;
  to: string;
  statusCode: 301 | 302;
  allLocales: boolean;
}

export interface RedirectView {
  id: string;
  key: string;
  from: string;
  to: string;
  statusCode: 301 | 302;
  allLocales: boolean;
  source: RedirectSource;
  hits: number;
  lastHitAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
  issues: SeoIssue[];
}

// ---------------------------------------------------------------------------
// Checks against the next release
// ---------------------------------------------------------------------------

/** SEO issues of redirect rules in the next release (records marked published + all rules). */
export async function redirectIssues(db: Queryable, store?: ContentStore): Promise<SeoIssue[]> {
  const next = snapshotStore(store ?? (await exportStore(db)), 'release');
  return checkSeo(next).issues.filter((i) => i.type === 'redirects');
}

function refuseBlocking(issues: SeoIssue[], keys: ReadonlySet<string>) {
  const blocking = issues.filter((i) => i.severity === 'blocking' && keys.has(i.key));
  if (!blocking.length) return;
  throw new Problem('redirect_rejected', blocking.slice(0, 3).map(formatSeoIssue).join('; '), {
    errors: blocking.map((i) => ({ field: i.field ?? 'to', message: i.code })),
  });
}

const newKey = () => `redirect-${crypto.randomBytes(5).toString('hex')}`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function userNames(db: Queryable, ids: Array<string | null>) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, { id: string; name: string }>();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

function toView(r: RedirectRow, users: Map<string, { id: string; name: string }>, issues: SeoIssue[]): RedirectView {
  return {
    id: r.id,
    key: r.key,
    from: r.fromPath,
    to: r.toPath,
    statusCode: r.statusCode as 301 | 302,
    allLocales: r.allLocales,
    source: r.source,
    hits: r.hits,
    lastHitAt: r.lastHitAt ? r.lastHitAt.toISOString() : null,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy ? users.get(r.updatedBy) ?? null : null,
    issues: issues.filter((i) => i.key === r.key),
  };
}

export interface RedirectListQuery {
  q?: string;
  source?: RedirectSource;
  limit: number;
  offset: number;
}

export async function listRedirects(deps: Deps, q: RedirectListQuery) {
  const db = requireDb(deps);
  const where = and(
    q.q ? or(ilike(s.redirects.fromPath, `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), ilike(s.redirects.toPath, `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)) : undefined,
    q.source ? eq(s.redirects.source, q.source) : undefined
  );
  const [{ total }] = (await db.select({ total: count() }).from(s.redirects).where(where)) as [{ total: number }];
  const rows = await db.select().from(s.redirects).where(where).orderBy(sql`${s.redirects.fromPath} COLLATE "C"`, asc(s.redirects.id)).limit(q.limit).offset(q.offset);
  const issues = await redirectIssues(db);
  const users = await userNames(db, rows.map((r) => r.updatedBy));
  const summary = { blocking: 0, warning: 0 };
  for (const i of issues) if (i.severity !== 'info') summary[i.severity]++;
  return { items: rows.map((r) => toView(r, users, issues)), total: Number(total), issues: summary };
}

export async function getRedirect(deps: Deps, id: string): Promise<RedirectView> {
  const db = requireDb(deps);
  const [row] = await db.select().from(s.redirects).where(eq(s.redirects.id, id));
  if (!row) throw new Problem('not_found');
  return toView(row, await userNames(db, [row.updatedBy]), await redirectIssues(db));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function normalizeInput(input: RedirectInput): RedirectInput {
  const from = normalizeRedirectPath(input.from);
  const to = normalizeRedirectPath(input.to);
  const errors: FieldError[] = [];
  const fp = redirectPathProblem(from, 'from', input.allLocales);
  const tp = redirectPathProblem(to, 'to', input.allLocales);
  if (fp) errors.push({ field: 'from', message: fp });
  if (tp) errors.push({ field: 'to', message: tp });
  if (!fp && !tp && from === to) errors.push({ field: 'to', message: 'self' });
  if (errors.length) throw new Problem('validation_failed', undefined, { errors });
  return { ...input, from, to };
}

interface SaveResult {
  row: RedirectRow;
  rewritten: number;
  removed: number;
}

/**
 * Insert (`existing` null) or update one rule, collapse chains around it and check the result.
 * Runs inside the caller's transaction; the caller audits.
 */
async function saveRule(
  tx: Queryable,
  deps: Deps,
  actor: UserRow,
  existing: RedirectRow | null,
  input: RedirectInput,
  source: RedirectSource
): Promise<SaveResult> {
  const now = deps.now();
  const rows = await tx.select().from(s.redirects).for('update');
  const dup = rows.find((r) => r.fromPath === input.from && r.id !== existing?.id);
  if (dup) throw new Problem('redirect_exists', `${input.from} → ${dup.toPath}`, { errors: [{ field: 'from', message: 'exists' }] });

  const rules: RedirectRule[] = rows.map((r) => ({ id: r.id, from: r.fromPath, to: r.toPath, allLocales: r.allLocales, statusCode: r.statusCode as 301 | 302 }));
  const collapsed = collapseRedirects(rules, { id: existing?.id, from: input.from, to: input.to, allLocales: input.allLocales });
  const touched = new Set<string>();

  let rewritten = 0;
  let removed = 0;
  for (const rw of collapsed.rewrites) {
    const r = rows.find((x) => x.id === rw.id)!;
    if (rw.to === null) {
      await tx.delete(s.redirects).where(eq(s.redirects.id, r.id));
      removed++;
    } else {
      await tx
        .update(s.redirects)
        .set({ toPath: rw.to, version: sql`${s.redirects.version} + 1`, updatedAt: now, updatedBy: actor.id })
        .where(eq(s.redirects.id, r.id));
      touched.add(r.key);
      rewritten++;
    }
  }

  const values = { fromPath: input.from, toPath: collapsed.to, statusCode: input.statusCode, allLocales: input.allLocales, updatedAt: now, updatedBy: actor.id };
  const [row] = existing
    ? await tx
        .update(s.redirects)
        .set({ ...values, version: sql`${s.redirects.version} + 1` })
        .where(eq(s.redirects.id, existing.id))
        .returning()
    : await tx
        .insert(s.redirects)
        .values({ ...values, key: newKey(), source, createdAt: now, createdBy: actor.id })
        .returning();
  touched.add(row!.key);

  refuseBlocking(await redirectIssues(tx), touched);
  return { row: row!, rewritten, removed };
}

export async function createRedirect(deps: Deps, actor: UserRow, input: RedirectInput, client: ClientInfo): Promise<RedirectView> {
  const db = requireDb(deps);
  const clean = normalizeInput(input);
  const id = await db.transaction(async (tx) => {
    const res = await saveRule(tx, deps, actor, null, clean, 'manual');
    await recordAudit(
      deps,
      client,
      { action: 'redirect.create', result: 'success', actorId: actor.id, resourceType: 'redirect', resourceId: res.row.id, summary: { from: res.row.fromPath, to: res.row.toPath, count: res.rewritten + res.removed } },
      tx
    );
    return res.row.id;
  });
  return getRedirect(deps, id);
}

export async function updateRedirect(deps: Deps, actor: UserRow, id: string, expectedVersion: number, input: RedirectInput, client: ClientInfo): Promise<RedirectView> {
  const db = requireDb(deps);
  const clean = normalizeInput(input);
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.redirects).where(eq(s.redirects.id, id)).for('update');
    if (!existing) throw new Problem('not_found');
    if (existing.version !== expectedVersion) throw new Problem('edit_conflict');
    const res = await saveRule(tx, deps, actor, existing, clean, existing.source);
    await recordAudit(
      deps,
      client,
      { action: 'redirect.update', result: 'success', actorId: actor.id, resourceType: 'redirect', resourceId: id, summary: { from: res.row.fromPath, to: res.row.toPath, count: res.rewritten + res.removed } },
      tx
    );
  });
  return getRedirect(deps, id);
}

export async function deleteRedirect(deps: Deps, actor: UserRow, id: string, expectedVersion: number, client: ClientInfo): Promise<void> {
  const db = requireDb(deps);
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.redirects).where(eq(s.redirects.id, id)).for('update');
    if (!existing) throw new Problem('not_found');
    if (existing.version !== expectedVersion) throw new Problem('edit_conflict');
    await tx.delete(s.redirects).where(eq(s.redirects.id, id));
    await recordAudit(
      deps,
      client,
      { action: 'redirect.delete', result: 'success', actorId: actor.id, resourceType: 'redirect', resourceId: id, summary: { from: existing.fromPath, to: existing.toPath } },
      tx
    );
  });
}

/**
 * Slug change of a live record (called by the CMS service inside its transaction):
 *  - a rule FROM the new address is removed (the page now lives there; it would shadow it);
 *  - with `redirect`, `oldPath → newPath` (301, all languages, source slug_change) is created or
 *    updated, and rules that pointed to the old address are rewritten to the new one;
 *  - the touched rules must pass the checks (the record's new address is checked as live).
 */
export async function slugChangeRedirects(
  tx: Queryable,
  deps: Deps,
  actor: UserRow,
  oldPath: string,
  newPath: string,
  redirect: boolean
): Promise<{ created: RedirectRow | null; rewritten: number; removed: number }> {
  let removed = 0;
  const shadowing = await tx.delete(s.redirects).where(eq(s.redirects.fromPath, newPath)).returning({ id: s.redirects.id });
  removed += shadowing.length;
  if (!redirect) return { created: null, rewritten: 0, removed };
  const [existing] = await tx.select().from(s.redirects).where(eq(s.redirects.fromPath, oldPath)).for('update');
  const res = await saveRule(tx, deps, actor, existing ?? null, { from: oldPath, to: newPath, statusCode: 301, allLocales: true }, 'slug_change');
  return { created: res.row, rewritten: res.rewritten, removed: removed + res.removed };
}

// ---------------------------------------------------------------------------
// Lookup behind nginx (approved §11.1–§11.2)
// ---------------------------------------------------------------------------

interface LookupTable {
  releaseId: string;
  index: Map<string, ConcreteRedirect>;
  live: Set<string>;
}

let cached: LookupTable | null = null;

/** Rules and live pages of the active release; rebuilt only when the active release changes. */
async function lookupTable(db: Queryable): Promise<LookupTable | null> {
  const { rows } = await db.execute(sql`SELECT r.id, r.snapshot_id FROM releases r WHERE r.status = 'active' AND r.kind = 'release' LIMIT 1`);
  const active = rows[0] as { id: string; snapshot_id: string } | undefined;
  if (!active) return null;
  if (cached?.releaseId === active.id) return cached;
  const [snap] = await db.select({ store: s.contentSnapshots.store }).from(s.contentSnapshots).where(eq(s.contentSnapshots.id, active.snapshot_id));
  const store = snap!.store as ContentStore;
  const live = new Set<string>();
  for (const m of checkSeo(store).pages) live.add(m.locale === 'en' ? m.path : m.path === '/' ? `/${m.locale}` : `/${m.locale}${m.path}`);
  cached = { releaseId: active.id, index: buildRedirectIndex(store.redirects), live };
  return cached;
}

/** Test hook: forget the cached table. */
export const resetLookupCache = () => {
  cached = null;
};

/**
 * Resolve one request path. `rawPath` is nginx's normalized `$uri` (decoded; non-ASCII arrives as
 * latin1-decoded UTF-8 bytes). Returns null (→ 404) for anything invalid or unknown.
 *  - exact match on the rules of the active release (chains followed, loops ignored);
 *  - trailing slash: "/x/" → the rule for "/x", or 301 to "/x" when that is a live page.
 */
export async function lookupRedirect(deps: Deps, rawPath: string): Promise<{ statusCode: 301 | 302; location: string; key: string | null } | null> {
  const path = Buffer.from(rawPath, 'latin1').toString('utf8');
  if (path.includes('�') || pathProblem(path) || /[?#]/.test(path)) return null;
  const table = await lookupTable(requireDb(deps));
  if (!table) return null;
  const site = deps.config.publicSiteUrl;
  const hit = resolveRedirect(table.index, path);
  if (hit) return { statusCode: hit.statusCode, location: redirectLocation(hit.to, site), key: hit.id };
  if (path.length > 1 && path.endsWith('/')) {
    const bare = path.replace(/\/+$/, '') || '/';
    const viaRule = resolveRedirect(table.index, bare);
    if (viaRule) return { statusCode: viaRule.statusCode, location: redirectLocation(viaRule.to, site), key: viaRule.id };
    if (table.live.has(bare)) return { statusCode: 301, location: redirectLocation(bare, site), key: null };
  }
  return null;
}

/** Hit counter: asynchronous, never delays or fails the redirect. */
export function countHit(deps: Deps, key: string, onError: (e: unknown) => void) {
  const db = requireDb(deps);
  db.update(s.redirects)
    .set({ hits: sql`${s.redirects.hits} + 1`, lastHitAt: deps.now() })
    .where(eq(s.redirects.key, key))
    .then(
      () => undefined,
      (e: unknown) => onError(e)
    );
}
