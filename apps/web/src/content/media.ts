/**
 * Media abstraction.
 *
 * Content references media by ID (`{ mediaId }`); the media library (`seed/media.json` today,
 * a custom-admin media table later) maps the ID to a file. Components only ever receive a
 * resolved `MediaAsset` with a final `src` URL, so they do not care whether a file lives in
 * /public, on object storage or behind a CDN.
 *
 * MEDIA_BASE_URL (build-time environment variable, optional) is prefixed to site-relative
 * media paths. Empty by default: files are served from the site itself, exactly as today.
 */

function readMediaBase(): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? process.env.MEDIA_BASE_URL : undefined;
  return (fromProcess ?? '').replace(/\/+$/, '');
}

/** Resolve a stored media path/URL to the URL used in the HTML. */
export function resolveMediaUrl(src: string): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src; // already absolute
  const base = readMediaBase();
  return base ? `${base}${src.startsWith('/') ? '' : '/'}${src}` : src;
}

/**
 * `srcset` for an image with responsive copies (Phase J-2): every copy plus the original at its
 * own width, smallest first. Null without copies (or without a known width).
 */
export function buildSrcSet(rec: { src: string; width: number | null; variants?: ReadonlyArray<{ src: string; width: number }> }): string | null {
  if (!rec.variants?.length || !rec.width) return null;
  const items = [...rec.variants].filter((v) => v.width < rec.width!).sort((a, b) => a.width - b.width);
  if (!items.length) return null;
  return [...items.map((v) => `${resolveMediaUrl(v.src)} ${v.width}w`), `${resolveMediaUrl(rec.src)} ${rec.width}w`].join(', ');
}

/**
 * Extra <img> attributes for a responsive image: `srcSet` + `sizes` when copies exist, nothing
 * otherwise, so a site without copies renders byte-for-byte what it did before.
 * `sizes` describes how wide the image is drawn; overestimating only costs bytes, never sharpness.
 */
export function responsive(asset: { srcSet?: string } | null | undefined, sizes: string): { srcSet?: string; sizes?: string } {
  return asset?.srcSet ? { srcSet: asset.srcSet, sizes } : {};
}
