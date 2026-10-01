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
