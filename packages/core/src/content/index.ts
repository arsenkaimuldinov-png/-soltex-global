/**
 * @soltex/core/content: content store format, JSONB schemas, Localized helpers.
 * Page slot registry (code-owned page structure, Phase E). normalize follows when the site build moves onto the core.
 * Layer rule: may import only from ../domain and ../validation.
 */
export * from './store.ts';
export * from './localized.ts';
export * from './jsonb.ts';
export * from './page-registry.ts';
