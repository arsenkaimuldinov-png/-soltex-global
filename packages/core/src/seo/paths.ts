/**
 * Syntax rules for site paths used as redirect sources and targets (approved §11.2–§11.3).
 * A path is internal only: it starts with one "/", has no host or scheme, no backslash, no
 * control characters (raw or percent-encoded), no encoded slashes and no ".." segments.
 * The same rules guard the redirect lookup endpoint (Phase I-2) and the SEO checker.
 */
export const PATH_MAX_LENGTH = 2048;

export type PathProblem = 'empty' | 'not_absolute' | 'protocol_relative' | 'backslash' | 'scheme' | 'control' | 'encoded' | 'dot_segment' | 'too_long';

export function pathProblem(path: string): PathProblem | null {
  if (!path) return 'empty';
  if (path.length > PATH_MAX_LENGTH) return 'too_long';
  if (/[\u0000-\u001f\u007f]/.test(path)) return 'control';
  if (path.includes('\\')) return 'backslash';
  if (!path.startsWith('/')) return /^[a-z][a-z0-9+.-]*:/i.test(path) ? 'scheme' : 'not_absolute';
  if (path.startsWith('//')) return 'protocol_relative';
  if (/%(?:[01][0-9a-f]|7f|2f|5c)/i.test(path)) return 'encoded';
  if (path.split(/[?#]/)[0]!.split('/').some((s) => s === '..' || s === '.')) return 'dot_segment';
  return null;
}
