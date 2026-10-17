/**
 * Responsive copies of images (Phase J-2, docs/admin-media.md §9; review §I).
 *
 * The publishing worker makes them in the background, one image at a time, when it has no release
 * to build: WebP at the standard widths below the original (480 / 960 / 1600 / 2400 px). They are
 * stored under MEDIA_DIR/variants/<id>/<tag>/<w>.webp (immutable; <tag> comes from the source path,
 * so a replaced file gets new copies) and served by nginx as /media/variants/….
 *
 * `media.variants` = MediaVariantsV1 `{ source, items }`; the copies are valid only while `source`
 * equals the row's `src`. The content export carries valid copies to the site build, which then
 * writes `srcset`; without them the site markup is exactly what it was before.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { MEDIA_MAX_PIXELS, variantWidths } from '@soltex/core/domain';
import type { MediaVariant } from '@soltex/core/content';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import { fileOf, storageOf } from './service.ts';

export interface MediaVariantsV1 {
  source: string;
  items: MediaVariant[];
  /** The source file could not be read (nothing to retry until the file changes). */
  missing?: boolean;
}

type Row = Pick<typeof s.media.$inferSelect, 'src' | 'variants'>;

/** The valid responsive copies of a row (empty when none or out of date). */
export function variantsOf(m: Row): MediaVariant[] {
  const v = m.variants as MediaVariantsV1 | null;
  return v && v.source === m.src ? v.items : [];
}

export type VariantState = 'ready' | 'pending' | 'none' | 'missing';

/** ready (copies made), pending (the worker will make them), none (not needed), missing (source file not found). */
export function variantState(m: Row & Pick<typeof s.media.$inferSelect, 'kind' | 'width'>): VariantState {
  if (m.kind !== 'image' || !variantWidths(m.width).length) return 'none';
  const v = m.variants as MediaVariantsV1 | null;
  if (!v || v.source !== m.src) return 'pending';
  return v.items.length ? 'ready' : 'missing';
}

const tagOf = (src: string) => crypto.createHash('sha256').update(src).digest('hex').slice(0, 12);

/**
 * Make the copies of the next image that needs them. Returns 'done' when one image was handled,
 * 'idle' when nothing is waiting. Safe with several workers (row lock, SKIP LOCKED).
 */
export async function generateNextVariants(deps: Deps): Promise<'done' | 'idle'> {
  const db = requireDb(deps);
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(
      sql`SELECT id FROM media WHERE kind = 'image' AND width IS NOT NULL AND (variants IS NULL OR variants->>'source' IS DISTINCT FROM src)
          ORDER BY created_at, key LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const id = (rows[0] as { id: string } | undefined)?.id;
    if (!id) return 'idle';
    const [m] = await tx.select().from(s.media).where(eq(s.media.id, id));
    const widths = variantWidths(m!.width);
    const source = fileOf(deps, m!);
    let value: MediaVariantsV1 = { source: m!.src, items: [] };
    if (widths.length && source && fs.existsSync(source)) {
      const storage = storageOf(deps);
      const tag = tagOf(m!.src);
      const items: MediaVariant[] = [];
      for (const w of widths) {
        const tmp = storage.tempPath('webp');
        try {
          const info = await sharp(source, { limitInputPixels: MEDIA_MAX_PIXELS }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(tmp);
          const rel = storage.commitVariant(tmp, m!.id, tag, w);
          items.push({ src: `/media/${rel}`, width: info.width, height: info.height });
        } catch (e) {
          fs.rmSync(tmp, { force: true });
          throw e;
        }
      }
      value = { source: m!.src, items };
    } else if (widths.length) value = { source: m!.src, items: [], missing: true };
    await tx
      .update(s.media)
      .set({ variants: value })
      .where(and(eq(s.media.id, id), eq(s.media.src, m!.src)));
    return 'done';
  });
}

/** Make every missing copy now (CLI and tests); returns how many images were handled. */
export async function generateAllVariants(deps: Deps, max = 10_000): Promise<number> {
  let n = 0;
  while (n < max && (await generateNextVariants(deps)) === 'done') n++;
  return n;
}
