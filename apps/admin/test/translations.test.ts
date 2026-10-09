/** Translation editor without a browser: languages (RTL), labels, form, validation, permissions. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canReviewTranslations,
  deniedTranslationFields,
  hasPermission,
  ROLES,
  TRANSLATED_LOCALES,
  TRANSLATION_REVIEW_PERMISSION,
  EFFECTIVE_TRANSLATION_STATES,
} from '@soltex/core/domain';
import { COLLECTION_UI, COLLECTIONS } from '../src/features/content/model.ts';
import {
  changedTranslationFields,
  emptyLike,
  fieldLabel,
  LOCALE_INFO,
  REVIEW_PERMISSION,
  sameAsSource,
  setPart,
  STATE_LABELS,
  STATE_HINTS,
  toTranslationForm,
  TRANSLATABLE_TYPES,
  TRANSLATION_ERROR_LABELS,
  translationFieldPermission,
  translationPath,
  TYPE_LABELS,
  validateTranslationField,
  type TranslationFieldView,
} from '../src/features/translations/model.ts';

const text = (over: Partial<TranslationFieldView> = {}): TranslationFieldView => ({
  name: 'title',
  kind: 'text',
  group: 'content',
  multiline: false,
  max: 300,
  placeholders: [],
  source: 'Solbar Ningbo',
  target: 'Солбар Нинбо',
  ...over,
});

test('languages: five translated languages; Arabic is right-to-left, the others left-to-right; English is the source', () => {
  assert.deepEqual(Object.keys(LOCALE_INFO).filter((l) => l !== 'en'), [...TRANSLATED_LOCALES]);
  assert.equal(LOCALE_INFO.ar.dir, 'rtl');
  assert.equal(LOCALE_INFO.ar.lang, 'ar');
  for (const l of ['en', 'ru', 'zh', 'tr', 'es'] as const) assert.equal(LOCALE_INFO[l].dir, 'ltr', l);
  assert.equal(translationPath('projects', 'abc', 'ar'), '/translations/projects/abc/ar');
});

test('every state, type and error code has a Russian label; outdated is distinct from approved', () => {
  for (const s of EFFECTIVE_TRANSLATION_STATES) {
    assert.ok(STATE_LABELS[s], s);
    assert.ok(STATE_HINTS[s], s);
  }
  assert.notEqual(STATE_LABELS.outdated, STATE_LABELS.approved);
  for (const t of TRANSLATABLE_TYPES) assert.ok(TYPE_LABELS[t], t);
  for (const code of ['required', 'too_long', 'placeholders', 'structure_is_fixed', 'not_translatable', 'not_allowed', 'invalid']) assert.ok(TRANSLATION_ERROR_LABELS[code], code);
});

test('field labels: collection fields use the content editor labels; page fields are named in Russian', () => {
  for (const c of COLLECTIONS)
    for (const f of COLLECTION_UI[c].fields) assert.equal(fieldLabel(c, f.name), f.label);
  assert.equal(fieldLabel('pages', 'header.title'), 'Шапка · заголовок (H1)');
  assert.equal(fieldLabel('pages', 'lists.timeline'), 'История компании');
  assert.equal(fieldLabel('pages', 'copy.heroHeadlineLine1'), 'Первый экран · заголовок · строка 1');
  assert.equal(fieldLabel('pages', 'seoMetaTitle'), 'SEO-заголовок (title)');
});

test('form: values follow the source structure; only changed fields are sent', () => {
  const fields: TranslationFieldView[] = [
    text(),
    { ...text(), name: 'scope', kind: 'list', source: ['A', 'B'], target: null },
    { ...text(), name: 'specs', kind: 'pairs', source: [{ label: 'L', value: 'V' }], target: [{ label: 'Л', value: 'З' }] },
    { ...text(), name: 'lists.x', kind: 'records', source: [{ title: 'T', description: 'D' }], target: [{ title: 'Т', description: 'О' }] },
  ];
  const form = toTranslationForm(fields);
  assert.deepEqual(form.scope, ['', ''], 'a missing value gets the structure of the source');
  assert.deepEqual(emptyLike('patentInfo', { patentNumber: 'N', location: 'L', keyPoints: ['a', 'b'] }), { patentNumber: '', location: '', keyPoints: ['', ''] });
  assert.deepEqual(changedTranslationFields(form, form), []);
  const next = { ...form, specs: setPart('pairs', form.specs!, '0.value', 'Новое') };
  assert.deepEqual(changedTranslationFields(form, next), ['specs']);
  assert.deepEqual(next.specs, [{ label: 'Л', value: 'Новое' }]);
  assert.deepEqual(fields[2]!.target, [{ label: 'Л', value: 'З' }], 'the loaded value is not mutated');
  assert.deepEqual(setPart('records', form['lists.x']!, '0.description', 'Новое описание'), [{ title: 'Т', description: 'Новое описание' }]);
  assert.deepEqual(setPart('patentInfo', { patentNumber: 'N', location: 'L', keyPoints: ['a', 'b'] }, 'keyPoints.1', 'б'), { patentNumber: 'N', location: 'L', keyPoints: ['a', 'б'] });
  assert.equal(setPart('text', 'old', '', 'new'), 'new');
});

test('validation: every text filled in, within the limit, placeholders of the source kept', () => {
  assert.equal(validateTranslationField(text(), 'Перевод'), null);
  assert.equal(validateTranslationField(text(), '   '), 'required');
  assert.equal(validateTranslationField(text({ max: 5 }), 'слишком длинно'), 'too_long');
  const tpl = text({ source: 'Inquire about {title}', placeholders: ['title'] });
  assert.equal(validateTranslationField(tpl, 'Запрос о {title}'), null);
  assert.equal(validateTranslationField(tpl, 'Запрос'), 'placeholders');
  assert.equal(validateTranslationField(tpl, 'Запрос о {название}'), 'placeholders');
  const list = { ...text(), kind: 'list' as const, source: ['a', 'b'] };
  assert.equal(validateTranslationField(list, ['а', '']), 'required');
  assert.equal(validateTranslationField(list, ['а', 'б']), null);
  assert.ok(sameAsSource(list, ['a', 'b']));
  assert.ok(!sameAsSource(list, ['а', 'b']));
});

test('permissions: the editor shows what the API enforces (fields, review)', () => {
  assert.equal(REVIEW_PERMISSION, TRANSLATION_REVIEW_PERMISSION);
  for (const role of ROLES) {
    assert.equal(hasPermission(role, REVIEW_PERMISSION), canReviewTranslations(role), role);
    for (const field of ['title', 'overview', 'copy.heroTitle', 'lists.timeline', 'seoMetaTitle', 'seoMetaDescription'])
      assert.equal(hasPermission(role, translationFieldPermission(field)), deniedTranslationFields(role, [field]).length === 0, `${role} ${field}`);
  }
  assert.deepEqual(ROLES.filter(canReviewTranslations), ['owner', 'admin', 'content_manager']);
});
