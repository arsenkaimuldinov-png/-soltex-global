import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canReviewTranslations,
  deniedTranslationFields,
  effectiveTranslationState,
  EFFECTIVE_TRANSLATION_STATES,
  isEffectiveTranslationState,
  nextTranslationState,
  ROLES,
  translationCompletion,
} from '../src/domain/index.ts';

test('effective state: missing, in progress, outdated, approved — deterministic from stored state and revisions', () => {
  assert.equal(effectiveTranslationState(null, null, 1), 'missing');
  assert.equal(effectiveTranslationState('missing', null, 1), 'missing');
  assert.equal(effectiveTranslationState('in_progress', null, 3), 'in_progress');
  assert.equal(effectiveTranslationState('in_progress', 1, 3), 'in_progress', 'an old approval does not make work in progress outdated');
  assert.equal(effectiveTranslationState('approved', 3, 3), 'approved');
  assert.equal(effectiveTranslationState('approved', 2, 3), 'outdated', 'the source changed after the approval');
  assert.equal(effectiveTranslationState('approved', null, 1), 'outdated', 'an approval of unknown source text is not trusted');
  for (const s of EFFECTIVE_TRANSLATION_STATES) assert.ok(isEffectiveTranslationState(s));
  assert.ok(!isEffectiveTranslationState('draft'));
});

test('completion: approved / total, rounded down; 0 for nothing to translate', () => {
  assert.equal(translationCompletion(48, 50), 96);
  assert.equal(translationCompletion(249, 250), 99, '99.6 % is not 100 %');
  assert.equal(translationCompletion(50, 50), 100);
  assert.equal(translationCompletion(0, 0), 0);
});

test('workflow: save → in progress; approve only in progress or outdated; reopen only approved or outdated', () => {
  for (const s of EFFECTIVE_TRANSLATION_STATES) assert.equal(nextTranslationState('save', s), 'in_progress');
  assert.equal(nextTranslationState('approve', 'in_progress'), 'approved');
  assert.equal(nextTranslationState('approve', 'outdated'), 'approved');
  assert.equal(nextTranslationState('approve', 'missing'), null, 'an untranslated copy is never approved');
  assert.equal(nextTranslationState('approve', 'approved'), null);
  assert.equal(nextTranslationState('reopen', 'approved'), 'in_progress');
  assert.equal(nextTranslationState('reopen', 'outdated'), 'in_progress');
  assert.equal(nextTranslationState('reopen', 'missing'), null);
  assert.equal(nextTranslationState('reopen', 'in_progress'), null);
});

test('permissions: reviewers hold content.publish; SEO texts need seo.edit, other texts content.edit', () => {
  assert.deepEqual(ROLES.filter(canReviewTranslations), ['owner', 'admin', 'content_manager']);
  assert.deepEqual(deniedTranslationFields('seo_specialist', ['title', 'seoMetaTitle']), ['title']);
  assert.deepEqual(deniedTranslationFields('editor', ['title', 'seoMetaTitle']), ['seoMetaTitle']);
  assert.deepEqual(deniedTranslationFields('marketer', ['title', 'seoMetaTitle']), ['title', 'seoMetaTitle']);
  assert.deepEqual(deniedTranslationFields('content_manager', ['title', 'seoMetaTitle']), []);
});
