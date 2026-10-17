/**
 * Media storage (Phase J, review §I: a `StorageDriver` interface, local disk now, S3-compatible
 * later). Files are immutable: an upload or a replacement is a new UUID path; nothing is ever
 * overwritten. Unreferenced files are removed only by a later garbage collection that respects the
 * backup retention (approved §12.2), never by the admin.
 *
 * Layout under MEDIA_DIR:
 *   originals/<yyyy>/<uuid>.<ext>   uploaded files (EXIF/GPS removed), public as /media/originals/…
 *   variants/<id>/<tag>/<w>.webp    responsive copies (Phase J-2), public as /media/variants/…;
 *                                   <tag> is derived from the source path, so a replaced file gets new copies
 *   previews/<id>-v<version>-<w>.webp  admin previews (cache; safe to delete)
 *   tmp/                            uploads in progress
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface MediaStorage {
  /** A new temporary file path for an upload in progress. */
  tempPath(ext?: string): string;
  /** Move a finished temporary file to its permanent, read-only place; returns the relative path. */
  commit(tempFile: string, ext: string, now: Date): string;
  /** Absolute path of a stored file (relative paths only; never leaves the storage root). */
  resolve(relative: string): string;
  previewPath(id: string, version: number, width: number): string;
  /** Store a finished temporary file as a responsive copy; returns the relative path. */
  commitVariant(tempFile: string, id: string, tag: string, width: number): string;
}

export function localMediaStorage(root: string): MediaStorage {
  const inside = (p: string) => {
    const abs = path.resolve(root, p);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('media path outside the storage root');
    return abs;
  };
  return {
    tempPath(ext = 'tmp') {
      const dir = path.join(root, 'tmp');
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, `${crypto.randomUUID()}.${ext}`);
    },
    commit(tempFile, ext, now) {
      const rel = `originals/${now.getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
      const abs = inside(rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.renameSync(tempFile, abs);
      fs.chmodSync(abs, 0o444);
      return rel;
    },
    resolve: inside,
    commitVariant(tempFile, id, tag, width) {
      if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{12}$/.test(tag)) throw new Error('invalid variant path');
      const rel = `variants/${id}/${tag}/${width}.webp`;
      const abs = inside(rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.renameSync(tempFile, abs);
      fs.chmodSync(abs, 0o444);
      return rel;
    },
    previewPath(id, version, width) {
      const dir = path.join(root, 'previews');
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, `${id}-v${version}-${width}.webp`);
    },
  };
}
