/**
 * Route map. URL PATTERNS ARE FRONTEND-OWNED (they never come from the CMS); content only
 * supplies slugs and decides which pages/entities are published.
 *
 *   /                              home
 *   /company                       company
 *   /company/global-presence       globalPresence
 *   /technologies                  technologies
 *   /technologies/patents          patents
 *   /technologies/:slug            technology detail
 *   /epcm                          epcm
 *   /products                      products
 *   /products/:slug                product detail
 *   /projects                      projects
 *   /projects/:slug                project detail
 *   /contact                       contact
 *   /privacy, /terms               legal pages (routed only once their content is published)
 *
 * Every path exists in every language: English without prefix, others under /ru, /zh, …
 */
import type { ContentApi } from './getters';
import type { Page, PageRouteKey, Product, Project, Technology } from './types';

export const PAGE_PATHS: Record<PageRouteKey, string> = {
  home: '/',
  company: '/company',
  globalPresence: '/company/global-presence',
  technologies: '/technologies',
  patents: '/technologies/patents',
  epcm: '/epcm',
  products: '/products',
  projects: '/projects',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
};

/** Order of static pages in the sitemap (unchanged from the approved site). */
const STATIC_ORDER: PageRouteKey[] = [
  'home',
  'company',
  'globalPresence',
  'technologies',
  'patents',
  'epcm',
  'products',
  'projects',
  'contact',
  'privacy',
  'terms',
];

export const technologyPath = (slug: string) => `/technologies/${slug}`;
export const productPath = (slug: string) => `/products/${slug}`;
export const projectPath = (slug: string) => `/projects/${slug}`;

export type ResolvedRoute =
  | { kind: 'page'; key: PageRouteKey; page: Page }
  | { kind: 'technology'; item: Technology }
  | { kind: 'product'; item: Product }
  | { kind: 'project'; item: Project };

/** Every public locale-less path, in sitemap order. */
export function getPublicPaths(content: ContentApi): string[] {
  return [
    ...STATIC_ORDER.filter((k) => content.hasPage(k)).map((k) => PAGE_PATHS[k]),
    ...content.technologies.map((t) => technologyPath(t.slug)),
    ...content.products.map((p) => productPath(p.slug)),
    ...content.projects.map((p) => projectPath(p.slug)),
  ];
}

/** Resolve a locale-less path to the content it renders, or null (→ 404). */
export function resolveRoute(path: string, content: ContentApi): ResolvedRoute | null {
  for (const key of STATIC_ORDER) {
    if (PAGE_PATHS[key] === path && content.hasPage(key)) return { kind: 'page', key, page: content.page(key).page };
  }
  const [, section, slug, extra] = path.split('/');
  if (!slug || extra !== undefined) return null;
  if (section === 'technologies') {
    const item = content.technology(slug);
    return item ? { kind: 'technology', item } : null;
  }
  if (section === 'products') {
    const item = content.product(slug);
    return item ? { kind: 'product', item } : null;
  }
  if (section === 'projects') {
    const item = content.project(slug);
    return item ? { kind: 'project', item } : null;
  }
  return null;
}
