/**
 * Per-route SEO metadata (title, description, robots, canonical, hreflang).
 *
 * Framework-free: used by the React <SeoHead> component during client-side navigation and by
 * scripts/prerender.ts, which writes the same tags into every static HTML file.
 *
 * Templates are frontend-owned; the content supplies the values:
 *   - page / entity `seo.metaTitle` / `seo.metaDescription` override the templates;
 *   - default title       = "{H1} | Soltex Global";
 *   - default description = the header description / overview, shortened to whole sentences.
 * An entity whose translation is not approved for a language is served in English with the
 * canonical pointing to the English URL and is left out of that language's hreflang cluster.
 */
import { DEFAULT_LOCALE, LOCALES, Locale, SITE_URL, getLocaleInfo } from './config';
import { localizePath } from './paths';
import type { ContentApi } from '../content/getters';
import { resolveRoute } from '../content/routes';
import type { Seo } from '../content/types';

export interface RouteMeta {
  title: string;
  description: string;
  indexable: boolean;
  /** Locale whose URL is canonical for this page in the requested language. */
  canonicalLocale: Locale;
  /** Locales that have this page (for hreflang). */
  alternateLocales: Locale[];
  /** Absolute OG image URL, if any. */
  ogImage: string | null;
}

const BRAND = 'Soltex Global';

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

const withBrand = (title: string) => `${title} | ${BRAND}`;

const toAbsolute = (src: string) => (/^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`);

function build(
  seo: Seo | null,
  defaults: { title: string; description: string },
  meta: { contentLocale: Locale; availableLocales: Locale[] }
): RouteMeta {
  return {
    title: seo?.metaTitle ?? defaults.title,
    description: seo?.metaDescription ?? defaults.description,
    indexable: !(seo?.noindex ?? false),
    canonicalLocale: meta.contentLocale,
    alternateLocales: meta.availableLocales,
    ogImage: seo?.ogImage ? toAbsolute(seo.ogImage.src) : null,
  };
}

/** SEO metadata of a locale-less path in the content's language, or null for an unknown URL. */
export function getRouteMeta(path: string, content: ContentApi): RouteMeta | null {
  const route = resolveRoute(path, content);
  if (!route) return null;
  switch (route.kind) {
    case 'page': {
      const { page } = route;
      return build(
        page.seo,
        {
          title: withBrand(page.header?.title ?? BRAND),
          description: summarize(page.header?.description ?? ''),
        },
        page
      );
    }
    case 'technology':
      return build(route.item.seo, { title: withBrand(route.item.title), description: summarize(route.item.overview) }, route.item);
    case 'product':
      return build(route.item.seo, { title: withBrand(route.item.title), description: summarize(route.item.description) }, route.item);
    case 'project':
      return build(route.item.seo, { title: withBrand(route.item.title), description: summarize(route.item.overview) }, route.item);
  }
}

/** Metadata of the "page not found" response. */
export function getNotFoundMeta(title: string, content: ContentApi): RouteMeta {
  return {
    title: withBrand(title),
    description: content.settings.defaultSeo.siteDescription,
    indexable: false,
    canonicalLocale: DEFAULT_LOCALE,
    alternateLocales: [],
    ogImage: null,
  };
}

export const absoluteUrl = (path: string, locale: Locale) => `${SITE_URL}${localizePath(path, locale)}`;

export interface AlternateLink {
  hreflang: string;
  href: string;
}

/** hreflang alternates for a locale-less path, including x-default (English). */
export function getAlternates(path: string, locales: Locale[] = LOCALES.map((l) => l.code)): AlternateLink[] {
  if (!locales.includes(DEFAULT_LOCALE)) return [];
  return [
    ...LOCALES.filter((l) => locales.includes(l.code)).map((l) => ({ hreflang: l.htmlLang, href: absoluteUrl(path, l.code) })),
    { hreflang: 'x-default', href: absoluteUrl(path, DEFAULT_LOCALE) },
  ];
}

export const htmlLangOf = (locale: Locale) => getLocaleInfo(locale).htmlLang;
