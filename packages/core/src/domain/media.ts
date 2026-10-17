/**
 * Media library rules (Phase J, review §I): which files may be uploaded, how their type is
 * recognised (by content, never by name or declared type) and the size limits. Shared by the API
 * (authoritative) and the admin (early feedback before a large upload starts).
 */

export type MediaKind = 'image' | 'video';

export interface MediaType {
  mime: string;
  ext: string;
  kind: MediaKind;
  label: string;
}

/** The allowlist (review §I). SVG is forbidden in v1 (script inside an image). PDF waits for a document entity. */
export const MEDIA_TYPES: readonly MediaType[] = [
  { mime: 'image/jpeg', ext: 'jpg', kind: 'image', label: 'JPEG' },
  { mime: 'image/png', ext: 'png', kind: 'image', label: 'PNG' },
  { mime: 'image/webp', ext: 'webp', kind: 'image', label: 'WebP' },
  { mime: 'image/avif', ext: 'avif', kind: 'image', label: 'AVIF' },
  { mime: 'video/mp4', ext: 'mp4', kind: 'video', label: 'MP4' },
];

export const MEDIA_MAX_BYTES: Readonly<Record<MediaKind, number>> = { image: 20 * 1024 * 1024, video: 200 * 1024 * 1024 };
/** Largest upload of any kind: the stream is cut here before the type is known for sure. */
export const MEDIA_UPLOAD_MAX_BYTES = Math.max(...Object.values(MEDIA_MAX_BYTES));
/** Images above this size get a warning (slow pages). */
export const MEDIA_LARGE_IMAGE_BYTES = 2 * 1024 * 1024;
/** Hero images narrower than this get a warning (blurry on large screens). */
export const MEDIA_HERO_MIN_WIDTH = 1600;
/** Decompression-bomb guard for images. */
export const MEDIA_MAX_PIXELS = 100_000_000;
/** Bytes `sniffMediaType` needs. */
export const MEDIA_SNIFF_BYTES = 32;

const at = (b: Uint8Array, offset: number, ascii: string) => {
  if (b.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) if (b[offset + i] !== ascii.charCodeAt(i)) return false;
  return true;
};

/** The type of a file from its first bytes ("magic numbers"), or null when it is not allowed. */
export function sniffMediaType(head: Uint8Array): MediaType | null {
  const t = (mime: string) => MEDIA_TYPES.find((x) => x.mime === mime)!;
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return t('image/jpeg');
  if (head.length >= 8 && head[0] === 0x89 && at(head, 1, 'PNG\r\n\x1a\n')) return t('image/png');
  if (at(head, 0, 'RIFF') && at(head, 8, 'WEBP')) return t('image/webp');
  if (at(head, 4, 'ftyp')) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (brand === 'avif' || brand === 'avis') return t('image/avif');
    if (['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'MSNV'].includes(brand)) return t('video/mp4');
  }
  return null;
}

/** File name as kept for people: no directories, no control characters, at most 200 characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(0, 200) || 'file';
}
