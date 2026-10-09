/**
 * @soltex/core/seo: slug rules and SEO text guidance (Phase E). The SEO checker
 * (BLOCKING / WARNING / INFO), canonical/hreflang algorithm and redirect graph follow in Phase I
 * (docs/admin-architecture-approved.md §14, §15, §18).
 * Layer rule: may import only from ../domain and ../validation.
 */
export * from './slug.ts';
export * from './limits.ts';
