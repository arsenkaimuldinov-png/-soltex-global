/**
 * Slug rules (review §J, approved §15/§18). One slug per entity, identical in every language
 * (localized slugs are DEFERRED). Route patterns are frontend-owned (apps/web/src/content/routes.ts):
 *   /technologies/:slug   /products/:slug   /projects/:slug
 * so slugs must be unique per type and must not collide with fixed paths under the same prefix.
 */

/** Routable entity types and their URL prefix. */
export const ROUTABLE_TYPES = ['technology', 'product', 'project'] as const;
export type RoutableType = (typeof ROUTABLE_TYPES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

/**
 * Fixed paths under each prefix that a slug must never take (they are routes of the site).
 * `/technologies/patents` is the patent registry page.
 */
export const RESERVED_SLUGS: Readonly<Record<RoutableType, readonly string[]>> = {
  technology: ['patents'],
  product: [],
  project: [],
};

export type SlugProblem = 'empty' | 'too_long' | 'format' | 'reserved';

/** Problem of `slug` for an entity of `type`, or null when it is valid (uniqueness is checked by the database). */
export function slugProblem(type: RoutableType, slug: string): SlugProblem | null {
  if (!slug) return 'empty';
  if (slug.length > SLUG_MAX_LENGTH) return 'too_long';
  if (!SLUG_PATTERN.test(slug)) return 'format';
  if (RESERVED_SLUGS[type].includes(slug)) return 'reserved';
  return null;
}

/**
 * A slug proposal from a (source-language) title: lowercase Latin letters, digits and hyphens.
 * Accented Latin letters lose their accents; other characters become separators.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}
