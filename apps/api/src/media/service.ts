/**
 * Media library (Phase J-1, docs/admin-media.md; review §I).
 *
 *  - Upload: the request body is streamed to a temporary file with a hard size limit; the type is
 *    taken from the first bytes (allowlist of @soltex/core/domain, SVG refused); images pass through
 *    sharp (auto-rotate, EXIF/GPS removed, pixel limit); the file gets a UUID name; the name the user
 *    had is kept only in the database; sha256 of the uploaded bytes refuses exact duplicates.
 *  - Usages are computed from the working copy (every reference in every record, any status), so
 *    «Используется» and the delete guard always agree with what a release would contain.
 *  - Replace keeps the id (and every reference) and moves the pointer to a new immutable file.
 *  - Delete is refused while the file is used; the stored file itself is left for the garbage
 *    collection (approved §12.2).
 *  - Files imported as is (/images, /videos) keep their URLs; previews read them from the active
 *    release (MEDIA_LEGACY_DIR).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { and, asc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import sharp from 'sharp';
import {
  cleanFileName,
  MEDIA_HERO_MIN_WIDTH,
  MEDIA_LARGE_IMAGE_BYTES,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_PIXELS,
  MEDIA_SNIFF_BYTES,
  MEDIA_UPLOAD_MAX_BYTES,
  sniffMediaType,
  SOURCE_LOCALE,
  type MediaType,
} from '@soltex/core/domain';
import { slugify } from '@soltex/core/seo';
import type { ContentStore } from '@soltex/core/content';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import type { Queryable } from '../db/client.ts';
import type { UserRow } from '../auth/sessions.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import { exportStore } from '../content/export.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES } from '../content/review-tables.ts';
import { recordRefs } from '../seo/report.ts';
import { localMediaStorage, type MediaStorage } from './storage.ts';
import { variantsOf, variantState, type VariantState } from './variants.ts';

type MediaRow = typeof s.media.$inferSelect;

export const storageOf = (deps: Deps): MediaStorage => localMediaStorage(deps.config.media.dir);

// ---------------------------------------------------------------------------
// Usages
// ---------------------------------------------------------------------------

export interface MediaUsage {
  /** Admin section: projects, technologies, …, pages, or settings. */
  type: string;
  /** Record id in the admin (uuid), null for global settings. */
  id: string | null;
  key: string;
  title: string;
  status: string | null;
  /** Field or slot holding the reference (image, gallery, ogImage, heroImage, a list key, …). */
  field: string;
}

/** Every `{ mediaId }` below `value`, with the path that leads to it. */
function refs(value: unknown, at: string[], out: Array<{ mediaId: string; path: string[] }>) {
  if (Array.isArray(value)) value.forEach((v, i) => refs(v, [...at, String(i)], out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.mediaId === 'string') out.push({ mediaId: o.mediaId, path: at });
    for (const [k, v] of Object.entries(o)) if (k !== 'mediaId') refs(v, [...at, k], out);
  }
}

function fieldOf(p: string[]): string {
  if ((p[0] === 'media' || p[0] === 'lists') && p[1]) return p[1];
  if (p[0] === 'seo') return 'ogImage';
  return p[0] ?? '';
}

/** media key → usages, from one export of the working copy. */
export async function usagesByKey(db: Queryable, store?: ContentStore): Promise<Map<string, MediaUsage[]>> {
  const st = store ?? (await exportStore(db));
  const titles = await recordRefs(db, st);
  const out = new Map<string, MediaUsage[]>();
  const add = (mediaKey: string, u: MediaUsage) => {
    const list = out.get(mediaKey) ?? [];
    if (!list.some((x) => x.type === u.type && x.key === u.key && x.field === u.field)) list.push(u);
    out.set(mediaKey, list);
  };
  for (const type of TRANSLATABLE_TYPES) {
    const list = st[REVIEW_TABLES[type].storeKey as keyof ContentStore] as unknown as Array<{ id: string; status?: string }>;
    for (const rec of list) {
      const found: Array<{ mediaId: string; path: string[] }> = [];
      refs(rec, [], found);
      const ref = titles.get(`${type}/${rec.id}`);
      for (const f of found) add(f.mediaId, { type, id: ref?.id ?? null, key: rec.id, title: ref?.title ?? rec.id, status: ref?.status ?? rec.status ?? null, field: fieldOf(f.path) });
    }
  }
  const found: Array<{ mediaId: string; path: string[] }> = [];
  refs(st.settings, [], found);
  for (const f of found) add(f.mediaId, { type: 'settings', id: null, key: 'settings', title: 'Общие настройки', status: null, field: fieldOf(f.path) });
  return out;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type MediaWarning = 'large_file' | 'hero_too_narrow';

export interface MediaView {
  id: string;
  key: string;
  kind: 'image' | 'video';
  src: string;
  source: 'legacy' | 'upload';
  fileName: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
  usageCount: number;
  warnings: MediaWarning[];
  /** Responsive copies for the site (Phase J-2). */
  variants: { state: VariantState; widths: number[] };
}

const MIME_BY_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4' };

/** Absolute path of the file behind a media row (upload: MEDIA_DIR; legacy: the active release), or null. */
export function fileOf(deps: Deps, m: Pick<MediaRow, 'source' | 'storagePath' | 'src'>): string | null {
  if (m.source === 'upload' && m.storagePath) return storageOf(deps).resolve(m.storagePath);
  if (!m.src.startsWith('/') || m.src.includes('..')) return null;
  const root = deps.config.media.legacyDir;
  let rel = m.src;
  try {
    rel = decodeURI(m.src);
  } catch {
    return null;
  }
  const abs = path.resolve(root, `.${rel}`);
  return abs.startsWith(root + path.sep) ? abs : null;
}

function legacySize(deps: Deps, m: MediaRow): number | null {
  const f = fileOf(deps, m);
  try {
    return f ? fs.statSync(f).size : null;
  } catch {
    return null;
  }
}

async function userNames(db: Queryable, ids: Array<string | null>) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, { id: string; name: string }>();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

function toView(deps: Deps, m: MediaRow, alt: string | null, usages: MediaUsage[], users: Map<string, { id: string; name: string }>): MediaView {
  const bytes = m.bytes ?? legacySize(deps, m);
  const warnings: MediaWarning[] = [];
  // A large original is a problem only while the site has no smaller copies to serve.
  if (m.kind === 'image' && bytes !== null && bytes > MEDIA_LARGE_IMAGE_BYTES && variantState(m) !== 'ready') warnings.push('large_file');
  if (m.kind === 'image' && m.width !== null && m.width < MEDIA_HERO_MIN_WIDTH && usages.some((u) => /hero/i.test(u.field))) warnings.push('hero_too_narrow');
  return {
    id: m.id,
    key: m.key,
    kind: m.kind,
    src: m.src,
    source: m.source,
    fileName: m.originalName ?? decodeURIComponent(m.src.split('/').pop() ?? m.src),
    mime: m.mime ?? MIME_BY_EXT[path.extname(m.src).toLowerCase()] ?? null,
    bytes,
    width: m.width,
    height: m.height,
    alt,
    version: m.version,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    updatedBy: m.updatedBy ? users.get(m.updatedBy) ?? null : null,
    usageCount: usages.length,
    warnings,
    variants: { state: variantState(m), widths: variantsOf(m).map((v) => v.width) },
  };
}

async function rowsWithAlt(db: Queryable, where?: ReturnType<typeof and>) {
  return db
    .select({ m: s.media, alt: s.mediaTranslations.alt })
    .from(s.media)
    .leftJoin(s.mediaTranslations, and(eq(s.mediaTranslations.mediaId, s.media.id), eq(s.mediaTranslations.locale, SOURCE_LOCALE)))
    .where(where)
    .orderBy(sql`${s.media.createdAt} DESC`, asc(s.media.key));
}

export interface MediaListQuery {
  q?: string;
  kind?: 'image' | 'video';
  usage?: 'used' | 'unused';
}

export async function listMedia(deps: Deps, q: MediaListQuery): Promise<{ items: MediaView[]; total: number }> {
  const db = requireDb(deps);
  const like = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await rowsWithAlt(
    db,
    and(q.kind ? eq(s.media.kind, q.kind) : undefined, like ? or(ilike(s.media.key, like), ilike(s.media.src, like), ilike(s.media.originalName, like)) : undefined)
  );
  const usages = await usagesByKey(db);
  const users = await userNames(db, rows.map((r) => r.m.updatedBy));
  const items = rows
    .map((r) => toView(deps, r.m, r.alt ?? null, usages.get(r.m.key) ?? [], users))
    .filter((v) => !q.usage || (q.usage === 'used' ? v.usageCount > 0 : v.usageCount === 0));
  return { items, total: items.length };
}

export async function getMedia(deps: Deps, id: string): Promise<MediaView & { usages: MediaUsage[]; publicUrl: string }> {
  const db = requireDb(deps);
  const [row] = await rowsWithAlt(db, and(eq(s.media.id, id)));
  if (!row) throw new Problem('not_found');
  const usages = (await usagesByKey(db)).get(row.m.key) ?? [];
  const view = toView(deps, row.m, row.alt ?? null, usages, await userNames(db, [row.m.updatedBy]));
  return { ...view, usages, publicUrl: deps.config.publicSiteUrl + encodeURI(row.m.src) };
}

// ---------------------------------------------------------------------------
// Receiving a file
// ---------------------------------------------------------------------------

interface Received {
  file: string;
  type: MediaType;
  bytes: number;
  sha256: string;
}

/** Stream the body to a temporary file: type from the first bytes, size limit per kind, sha256. */
export async function receive(storage: MediaStorage, body: Readable): Promise<Received> {
  const tmp = storage.tempPath();
  const out = fs.createWriteStream(tmp, { mode: 0o600 });
  const hash = crypto.createHash('sha256');
  let head = Buffer.alloc(0);
  let type: MediaType | null = null;
  let bytes = 0;
  let limit = MEDIA_UPLOAD_MAX_BYTES;
  const abort = async (p: Problem): Promise<never> => {
    body.destroy();
    await new Promise<void>((resolve) => {
      out.once('close', () => resolve());
      out.destroy();
    });
    fs.rmSync(tmp, { force: true });
    throw p;
  };
  try {
    for await (const chunk of body) {
      const b = chunk as Buffer;
      bytes += b.length;
      if (!type) {
        head = Buffer.concat([head, b]).subarray(0, MEDIA_SNIFF_BYTES);
        if (head.length >= MEDIA_SNIFF_BYTES) {
          type = sniffMediaType(head);
          if (!type) await abort(new Problem('media_type_rejected'));
          limit = MEDIA_MAX_BYTES[type!.kind];
        }
      }
      if (bytes > limit) await abort(new Problem('payload_too_large', `Максимальный размер: ${Math.round(limit / 1024 / 1024)} МБ.`));
      hash.update(b);
      if (!out.write(b)) await new Promise<void>((r) => out.once('drain', () => r()));
    }
  } catch (e) {
    if (e instanceof Problem) throw e;
    await abort(new Problem('bad_request', 'Загрузка прервана.'));
  }
  await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  if (!type) type = sniffMediaType(head);
  if (!type || bytes === 0) {
    fs.rmSync(tmp, { force: true });
    throw new Problem(bytes === 0 ? 'bad_request' : 'media_type_rejected', bytes === 0 ? 'Файл пустой.' : undefined);
  }
  return { file: tmp, type, bytes, sha256: hash.digest('hex') };
}

interface Processed {
  file: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

/** Images: decode within the pixel limit, apply the EXIF orientation, drop all metadata, re-encode. */
async function processImage(storage: MediaStorage, r: Received): Promise<Processed> {
  if (r.type.kind !== 'image') return { file: r.file, bytes: r.bytes, width: null, height: null };
  const outFile = storage.tempPath(r.type.ext);
  try {
    let img = sharp(r.file, { limitInputPixels: MEDIA_MAX_PIXELS, failOn: 'error' }).rotate();
    img =
      r.type.ext === 'jpg'
        ? img.jpeg({ quality: 90, mozjpeg: true })
        : r.type.ext === 'png'
          ? img.png({ compressionLevel: 9 })
          : r.type.ext === 'webp'
            ? img.webp({ quality: 90 })
            : img.avif({ quality: 70 });
    const info = await img.toFile(outFile);
    fs.rmSync(r.file, { force: true });
    return { file: outFile, bytes: info.size, width: info.width, height: info.height };
  } catch {
    fs.rmSync(r.file, { force: true });
    fs.rmSync(outFile, { force: true });
    throw new Problem('media_invalid');
  }
}

async function refuseDuplicate(db: Queryable, sha256: string, exceptId: string | null) {
  const [dup] = await db
    .select({ id: s.media.id })
    .from(s.media)
    .where(and(eq(s.media.sha256, sha256), exceptId ? ne(s.media.id, exceptId) : undefined))
    .limit(1);
  if (dup) throw new Problem('media_duplicate', undefined, { errors: [{ field: 'file', message: dup.id }] });
}

function keyFor(name: string): string {
  const base = slugify(name.replace(/\.[a-z0-9]{2,5}$/i, '')).slice(0, 48).replace(/-+$/, '') || 'file';
  return `media-${base}-${crypto.randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Upload, replace, delete
// ---------------------------------------------------------------------------

export async function uploadMedia(deps: Deps, actor: UserRow, body: Readable, name: string, client: ClientInfo) {
  const db = requireDb(deps);
  const storage = storageOf(deps);
  const received = await receive(storage, body);
  try {
    await refuseDuplicate(db, received.sha256, null);
  } catch (e) {
    fs.rmSync(received.file, { force: true });
    throw e;
  }
  const done = await processImage(storage, received);
  const now = deps.now();
  const rel = storage.commit(done.file, received.type.ext, now);
  const fileName = cleanFileName(name);
  const id = await db.transaction(async (tx) => {
    await refuseDuplicate(tx, received.sha256, null);
    const [row] = await tx
      .insert(s.media)
      .values({
        key: keyFor(fileName),
        kind: received.type.kind,
        src: `/media/${rel}`,
        width: done.width,
        height: done.height,
        source: 'upload',
        storagePath: rel,
        originalName: fileName,
        mime: received.type.mime,
        bytes: done.bytes,
        sha256: received.sha256,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: s.media.id });
    await recordAudit(deps, client, { action: 'media.upload', result: 'success', actorId: actor.id, resourceType: 'media', resourceId: row!.id, summary: { kind: received.type.kind, size: done.bytes } }, tx);
    return row!.id;
  });
  return getMedia(deps, id);
}

export async function replaceMedia(deps: Deps, actor: UserRow, id: string, expectedVersion: number, body: Readable, name: string, client: ClientInfo) {
  const db = requireDb(deps);
  const [current] = await db.select().from(s.media).where(eq(s.media.id, id));
  if (!current) {
    body.resume();
    throw new Problem('not_found');
  }
  if (current.version !== expectedVersion) {
    body.resume();
    throw new Problem('edit_conflict');
  }
  const storage = storageOf(deps);
  const received = await receive(storage, body);
  try {
    if (received.type.kind !== current.kind) throw new Problem('validation_failed', undefined, { errors: [{ field: 'file', message: 'kind_mismatch' }] });
    if (current.sha256 === received.sha256) throw new Problem('validation_failed', undefined, { errors: [{ field: 'file', message: 'unchanged' }] });
    await refuseDuplicate(db, received.sha256, id);
  } catch (e) {
    fs.rmSync(received.file, { force: true });
    throw e;
  }
  const done = await processImage(storage, received);
  const now = deps.now();
  const rel = storage.commit(done.file, received.type.ext, now);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(s.media)
      .set({
        src: `/media/${rel}`,
        width: done.width,
        height: done.height,
        source: 'upload',
        storagePath: rel,
        originalName: cleanFileName(name),
        mime: received.type.mime,
        bytes: done.bytes,
        sha256: received.sha256,
        version: sql`${s.media.version} + 1`,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(and(eq(s.media.id, id), eq(s.media.version, expectedVersion)))
      .returning({ id: s.media.id });
    if (!updated.length) throw new Problem('edit_conflict');
    await recordAudit(deps, client, { action: 'media.replace', result: 'success', actorId: actor.id, resourceType: 'media', resourceId: id, summary: { kind: received.type.kind, size: done.bytes } }, tx);
  });
  return getMedia(deps, id);
}

export async function deleteMedia(deps: Deps, actor: UserRow, id: string, expectedVersion: number, client: ClientInfo) {
  const db = requireDb(deps);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.media).where(eq(s.media.id, id)).for('update');
    if (!row) throw new Problem('not_found');
    if (row.version !== expectedVersion) throw new Problem('edit_conflict');
    const usages = (await usagesByKey(tx)).get(row.key) ?? [];
    if (usages.length)
      throw new Problem('media_in_use', `Используется: ${usages.slice(0, 3).map((u) => u.title).join(', ')}${usages.length > 3 ? ' …' : ''}`, {
        errors: usages.slice(0, 50).map((u) => ({ field: `${u.type}/${u.key}`, message: u.field })),
      });
    await tx.delete(s.media).where(eq(s.media.id, id));
    await recordAudit(deps, client, { action: 'media.delete', result: 'success', actorId: actor.id, resourceType: 'media', resourceId: id, summary: { kind: row.kind } }, tx);
  });
}

// ---------------------------------------------------------------------------
// Admin previews
// ---------------------------------------------------------------------------

export const PREVIEW_WIDTHS = [480, 1200] as const;

/** A WebP preview of an image (cached per version and width), or null when there is none. */
export async function previewOf(deps: Deps, id: string, width: (typeof PREVIEW_WIDTHS)[number]): Promise<string | null> {
  const db = requireDb(deps);
  const [m] = await db.select().from(s.media).where(eq(s.media.id, id));
  if (!m) throw new Problem('not_found');
  if (m.kind !== 'image') return null;
  const storage = storageOf(deps);
  const out = storage.previewPath(m.id, m.version, width);
  if (fs.existsSync(out)) return out;
  const src = fileOf(deps, m);
  if (!src || !fs.existsSync(src)) return null;
  const tmp = `${out}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await sharp(src, { limitInputPixels: MEDIA_MAX_PIXELS }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(tmp);
    fs.renameSync(tmp, out);
    return out;
  } catch {
    fs.rmSync(tmp, { force: true });
    return null;
  }
}

/** File size per media key (uploads from the database, legacy files from the site), for the SEO image checks. */
export async function mediaSizes(deps: Deps, db: Queryable): Promise<(key: string) => number | null> {
  const rows = await db.select().from(s.media).where(eq(s.media.kind, 'image'));
  const sizes = new Map(rows.map((m) => [m.key, m.bytes ?? legacySize(deps, m)]));
  return (key) => sizes.get(key) ?? null;
}
