/**
 * Effective SEO texts and public paths of the site (Phase I, approved §14–§15).
 *
 * The site (apps/web/src/i18n/seo.ts, routes.ts) renders exactly these rules; the admin snippet,
 * the API SEO report and the build's parity check use this module, so what the editor sees is
 * what search engines get. `scripts/validate-site.ts` compares every generated <title> and
 * meta description with `seoDefaults`/overrides computed here and fails the build on any drift.
 *
 *   title       = SEO override, else "{H1} | Soltex Global"
 *   description = SEO override, else the page/entity description shortened to whole sentences
 */
import type { Locale } from '../domain/locales.ts';

export const SEO_BRAND = 'Soltex Global';
export const DEFAULT_SITE_URL = 'https://soltexglobal.co';

/** Hard limit (BLOCKING above it) and recommended ranges (WARNING outside them), approved §14. */
export const SEO_TITLE_HARD_MAX = 120;

/**
 * Shorten a (translated) description to whole sentences, ~160 characters.
 * Never cuts a sentence in half, so no wording is altered — only trailing sentences are omitted.
 */
export function summarize(text: string, max = 160): string {
  const sentences = text.match(/[^.!?。！？؟]+[.!?。！？؟]*\s*/g) ?? [text];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).trim().length > max) break;
    out += s;
  }
  return out.trim();
}

export const withBrand = (title: string) => `${title} | ${SEO_BRAND}`;

/** Default title and description of a page or entity from its heading and descriptive text. */
export function seoDefaults(heading: string | null | undefined, text: string | null | undefined): { title: string; description: string } {
  return { title: withBrand(heading ?? SEO_BRAND), description: summarize(text ?? '') };
}

// ---------------------------------------------------------------------------
// Public paths (frontend-owned patterns, mirrored from apps/web/src/content/routes.ts)
// ---------------------------------------------------------------------------

/** Routable fixed pages in sitemap order, with their locale-less paths. */
export const PAGE_ROUTES = [
  ['home', '/'],
  ['company', '/company'],
  ['globalPresence', '/company/global-presence'],
  ['technologies', '/technologies'],
  ['patents', '/technologies/patents'],
  ['epcm', '/epcm'],
  ['products', '/products'],
  ['projects', '/projects'],
  ['contact', '/contact'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
] as const;

export type PageRouteKey = (typeof PAGE_ROUTES)[number][0];

export const PAGE_ROUTE_PATHS: Readonly<Record<PageRouteKey, string>> = Object.fromEntries(PAGE_ROUTES) as Record<PageRouteKey, string>;

/** Pages linked from the main navigation of every page (header). */
export const NAVIGATION_PAGES: readonly PageRouteKey[] = ['company', 'technologies', 'epcm', 'products', 'projects', 'contact'];

/** URL prefix of the routable collections. */
export const DETAIL_PATH_PREFIX = {
  technologies: '/technologies/',
  products: '/products/',
  projects: '/projects/',
} as const;

export type RoutableCollection = keyof typeof DETAIL_PATH_PREFIX;

/** Public path of a locale-less path in a language (English has no prefix). */
export function localizedPath(path: string, locale: Locale): string {
  if (locale === 'en') return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
