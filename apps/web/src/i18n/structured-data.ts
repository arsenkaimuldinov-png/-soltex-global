/**
 * JSON-LD structured data (Phase N-0, docs/seo.md §structured data).
 *
 * Only facts the content already states are emitted — nothing is inferred or added:
 *   - home:         Organization (name, legal name, URL, logo, e-mail, description) + WebSite;
 *   - detail pages: BreadcrumbList (home → index page → item) with the labels of the visible breadcrumb.
 * Written by scripts/prerender.ts into the static HTML; `<script type="application/ld+json">` is
 * data, not script, so the site CSP is unaffected.
 */
import type { ContentApi } from '../content/getters';
import { PAGE_PATHS, resolveRoute } from '../content/routes';
import type { Locale } from './config';
import { SITE_URL, getLocaleInfo } from './config';
import { absoluteUrl } from './seo';

type Json = Record<string, unknown>;

const PARENT = {
  technology: 'technologies',
  product: 'products',
  project: 'projects',
} as const;

const abs = (src: string) => (/^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`);

function organization(content: ContentApi, locale: Locale): Json {
  const s = content.settings;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: s.siteName,
    ...(s.headquarters?.name && s.headquarters.name !== s.siteName ? { legalName: s.headquarters.name } : {}),
    url: absoluteUrl('/', locale),
    ...(s.logo?.src ? { logo: abs(s.logo.src) } : {}),
    ...(s.primaryEmail ? { email: s.primaryEmail } : {}),
    ...(s.defaultSeo?.siteDescription ? { description: s.defaultSeo.siteDescription } : {}),
  };
}

function website(content: ContentApi, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: content.settings.siteName,
    url: absoluteUrl('/', locale),
    inLanguage: getLocaleInfo(locale).htmlLang,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

function breadcrumbs(items: Array<{ name: string; path: string }>, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path, locale) })),
  };
}

/** JSON-LD objects for a locale-less path in the content's language ([] when there is nothing to say). */
export function getStructuredData(path: string, content: ContentApi, locale: Locale, ui: Record<string, string>): Json[] {
  const route = resolveRoute(path, content);
  if (!route) return [];
  if (route.kind === 'page') return route.key === 'home' ? [organization(content, locale), website(content, locale)] : [];
  const parentKey = PARENT[route.kind];
  if (!content.hasPage('home') || !content.hasPage(parentKey)) return [];
  const homeTitle = ui['nav.home'];
  const parentTitle = ui[`breadcrumb.${parentKey}`];
  if (!homeTitle || !parentTitle) return [];
  return [
    breadcrumbs(
      [
        { name: homeTitle, path: PAGE_PATHS.home },
        { name: parentTitle, path: PAGE_PATHS[parentKey] },
        { name: route.item.title, path },
      ],
      locale
    ),
  ];
}

/** Serialize for an HTML <script> element: `<` is escaped so the data can never close the tag. */
export const jsonLdScript = (data: Json): string =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
