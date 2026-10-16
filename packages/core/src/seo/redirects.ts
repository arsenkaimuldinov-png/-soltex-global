/**
 * Redirect rules (Phase I-2; approved §11, review §O; docs/admin-seo.md §8).
 *
 * Stored form: `from` / `to` are site paths without a trailing slash and in decoded form
 * ("/projects/старый", not "%D1%81…"). With `allLocales` the rule is LOCALE-LESS and applies to
 * every language prefix (/old → /new, /ru/old → /ru/new, …). Without it the rule is ONE concrete
 * path pair, which may carry a language prefix itself ("/ru/old" → "/ru/new").
 *
 * The same functions are used by the SEO checker (build, publishing), the redirects API (on save)
 * and the lookup endpoint behind nginx, so all three agree on what a rule means.
 */
import { CONTENT_LOCALES, type Locale } from '../domain/index.ts';
import { DEFAULT_SITE_URL, localizedPath } from './meta.ts';
import { pathProblem, type PathProblem } from './paths.ts';

export type RedirectPathProblem = PathProblem | 'query' | 'trailing_slash' | 'locale_prefix' | 'reserved';

export interface RedirectRule {
  id: string;
  from: string;
  to: string;
  statusCode?: 301 | 302;
  /** Default false (one concrete pair), as in the site validator. */
  allLocales?: boolean;
}

/** Static asset prefixes nginx serves itself; a redirect from there could never fire. */
export const REDIRECT_RESERVED_PREFIXES = ['/assets/', '/images/', '/videos/', '/icons/'] as const;

const PREFIXED = new RegExp(`^/(${CONTENT_LOCALES.filter((l) => l !== 'en').join('|')})(?=/|$)(.*)$`);
const SITE_HOSTS = new Set(['soltexglobal.co', 'www.soltexglobal.co']);

/** "/ru/projects/x" → { locale: 'ru', path: '/projects/x' }; "/ru" → { 'ru', '/' }; "/x" → { 'en', '/x' }. */
export function splitLocale(path: string): { locale: Locale; path: string } {
  const m = PREFIXED.exec(path);
  return m ? { locale: m[1] as Locale, path: m[2] || '/' } : { locale: 'en', path };
}

/**
 * Bring an editor's input into the stored form: trims, accepts a pasted address of this site
 * (https://soltexglobal.co/old → /old), decodes percent-escapes (reserved characters such as %2F
 * stay encoded and are then refused by the path rules) and drops trailing slashes.
 * Anything else is returned as typed so that `redirectPathProblem` can explain it.
 */
export function normalizeRedirectPath(input: string): string {
  let p = input.trim();
  const abs = /^https?:\/\/([^/?#]+)(.*)$/i.exec(p);
  if (abs && SITE_HOSTS.has(abs[1]!.toLowerCase())) p = abs[2] || '/';
  try {
    p = decodeURI(p);
  } catch {
    /* malformed escapes: keep as typed */
  }
  return p.length > 1 ? p.replace(/(.)\/+$/, '$1') : p;
}

/** Why a stored path cannot be used as a redirect source (`from`) or target (`to`); null when fine. */
export function redirectPathProblem(path: string, role: 'from' | 'to', allLocales: boolean): RedirectPathProblem | null {
  const p = pathProblem(path);
  if (p) return p;
  if (/[?#]/.test(path)) return 'query';
  if (path.length > 1 && path.endsWith('/')) return 'trailing_slash';
  if (allLocales && splitLocale(path).locale !== 'en') return 'locale_prefix';
  if (role === 'from' && (path === '/' || REDIRECT_RESERVED_PREFIXES.some((x) => path.startsWith(x)))) return 'reserved';
  return null;
}

/** The concrete public path pairs of a rule. */
export function expandRedirect(r: Pick<RedirectRule, 'from' | 'to' | 'allLocales'>): Array<{ from: string; to: string }> {
  return r.allLocales ? CONTENT_LOCALES.map((l) => ({ from: localizedPath(r.from, l), to: localizedPath(r.to, l) })) : [{ from: r.from, to: r.to }];
}

export interface ConcreteRedirect {
  id: string;
  to: string;
  statusCode: 301 | 302;
}

/** Concrete source path → rule. The first rule wins on a duplicate (the checker reports it). */
export function buildRedirectIndex(rules: ReadonlyArray<RedirectRule>): Map<string, ConcreteRedirect> {
  const index = new Map<string, ConcreteRedirect>();
  for (const r of rules) {
    if (redirectPathProblem(r.from, 'from', !!r.allLocales) || redirectPathProblem(r.to, 'to', !!r.allLocales) || r.from === r.to) continue;
    for (const c of expandRedirect(r)) if (!index.has(c.from)) index.set(c.from, { id: r.id, to: c.to, statusCode: r.statusCode ?? 301 });
  }
  return index;
}

export const REDIRECT_MAX_HOPS = 10;

/**
 * Where a request for `path` ends up: follows chains (they are collapsed on save, but an older
 * release may still contain one) and gives up on a loop. `statusCode` is 301 only when every hop is
 * permanent. `id` is the rule that matched `path` (for its hit counter).
 */
export function resolveRedirect(index: ReadonlyMap<string, ConcreteRedirect>, path: string): { id: string; to: string; statusCode: 301 | 302 } | null {
  const first = index.get(path);
  if (!first) return null;
  let to = first.to;
  let statusCode = first.statusCode;
  const seen = new Set([path]);
  for (let hop = 1; index.has(to); hop++) {
    if (seen.has(to) || hop >= REDIRECT_MAX_HOPS) return null;
    seen.add(to);
    const next = index.get(to)!;
    if (next.statusCode === 302) statusCode = 302;
    to = next.to;
  }
  return { id: first.id, to, statusCode };
}

/** Absolute `Location` for a target path: always this site's origin + the path, percent-encoded. */
export function redirectLocation(to: string, siteUrl: string = DEFAULT_SITE_URL): string {
  return siteUrl.replace(/\/+$/, '') + encodeURI(to);
}

export interface RedirectRewrite {
  id: string;
  /** New target, or null when the rule would now point to itself and is removed. */
  to: string | null;
}

/**
 * Collapse rules around a new or changed rule `from → to` (review §O: no chains):
 *  - `to` is first followed through the existing rules, so the new rule points to the final page;
 *  - existing rules that pointed to `from` are rewritten to that final target, or removed when they
 *    would now point to themselves (going back to an earlier address reverses the old rule).
 * Because rules pointing to `from` are not followed, the result can never lead back to `from`.
 * Only rules in the same space are combined (both locale-less, or both the same concrete path);
 * anything left over is reported by the checker as a chain.
 */
export function collapseRedirects(
  rules: ReadonlyArray<RedirectRule>,
  change: { id?: string; from: string; to: string; allLocales: boolean }
): { to: string; rewrites: RedirectRewrite[] } {
  const others = rules.filter((r) => r.id !== change.id && !!r.allLocales === change.allLocales);
  // Rules pointing to `from` are about to be rewritten, so they are not followed.
  const byFrom = new Map(others.filter((r) => r.to !== change.from).map((r) => [r.from, r]));
  let to = change.to;
  const seen = new Set([change.from]);
  while (byFrom.has(to) && !seen.has(to)) {
    seen.add(to);
    to = byFrom.get(to)!.to;
  }
  const rewrites: RedirectRewrite[] = [];
  for (const r of others) if (r.to === change.from) rewrites.push({ id: r.id, to: r.from === to ? null : to });
  return { to, rewrites };
}
