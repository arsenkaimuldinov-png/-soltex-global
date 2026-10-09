/**
 * Translation status model (Phase F, docs/admin-translations.md). Pure functions, shared by the
 * API (which enforces them) and the admin (which only displays them).
 *
 * Stored state (`translation_state` enum, unchanged since Phase B): missing · in_progress · approved.
 * Effective state adds `outdated`, which is never stored: an approved translation whose approval
 * refers to an older revision of the source-language text. So a source edit never rewrites
 * translation rows to mark them; the state is derived the same way everywhere (SQL and here).
 *
 *   missing      no translation supplied yet (the row holds an untranslated copy of the source)
 *   in_progress  translated text exists, not approved
 *   outdated     approved, but the source text changed after the approval
 *   approved     approved for the current source text — the only state that counts as complete
 */
import { hasPermission, deniedContentFields, type Permission, type Role } from './permissions.ts';

export const STORED_TRANSLATION_STATES = ['missing', 'in_progress', 'approved'] as const;
export type StoredTranslationState = (typeof STORED_TRANSLATION_STATES)[number];

export const EFFECTIVE_TRANSLATION_STATES = ['missing', 'in_progress', 'outdated', 'approved'] as const;
export type EffectiveTranslationState = (typeof EFFECTIVE_TRANSLATION_STATES)[number];

export const isEffectiveTranslationState = (v: unknown): v is EffectiveTranslationState =>
  typeof v === 'string' && (EFFECTIVE_TRANSLATION_STATES as readonly string[]).includes(v);

/**
 * Effective state of one (entity, language).
 * @param stored               tr_status of the row (null is treated as missing)
 * @param approvedRevision     source revision the approval reviewed (null = unknown → outdated)
 * @param sourceRevision       current source revision of the entity
 */
export function effectiveTranslationState(
  stored: StoredTranslationState | null,
  approvedRevision: number | null,
  sourceRevision: number
): EffectiveTranslationState {
  if (stored === 'approved') return approvedRevision !== null && approvedRevision >= sourceRevision ? 'approved' : 'outdated';
  return stored ?? 'missing';
}

/** Completion of a language: approved-for-current-source / all items, rounded DOWN (99.6 % is not 100 %). */
export function translationCompletion(approved: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((Math.min(approved, total) * 100) / total);
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export type TranslationAction = 'save' | 'approve' | 'reopen';

/** Permission that reviews (approves / reopens) a translation: approval decides what the site may serve. */
export const TRANSLATION_REVIEW_PERMISSION: Permission = 'content.publish';

export const canReviewTranslations = (role: Role): boolean => hasPermission(role, TRANSLATION_REVIEW_PERMISSION);

/** Translation fields `role` may NOT change (SEO texts need seo.edit, other texts content.edit). */
export const deniedTranslationFields = (role: Role, fields: readonly string[]): string[] => deniedContentFields(role, fields);

/**
 * Stored state after an action, or null when the action is not allowed in the current state.
 *  - save:    any → in_progress (an edited text needs review again; approval is never automatic)
 *  - approve: in_progress | outdated → approved (missing: nothing was translated; approved: already done)
 *  - reopen:  approved | outdated → in_progress
 */
export function nextTranslationState(action: TranslationAction, current: EffectiveTranslationState): StoredTranslationState | null {
  switch (action) {
    case 'save':
      return 'in_progress';
    case 'approve':
      return current === 'in_progress' || current === 'outdated' ? 'approved' : null;
    case 'reopen':
      return current === 'approved' || current === 'outdated' ? 'in_progress' : null;
  }
}
