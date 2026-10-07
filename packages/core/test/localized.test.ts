import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_LOCALES, type Locale } from '../src/domain/locales.ts';
import { LocaleShapeError, isLocalized, isMediaRef, joinText, mergeLocales, projectLocale, splitText } from '../src/content/localized.ts';

const L = (base: string) => Object.fromEntries(CONTENT_LOCALES.map((l) => [l, `${base}-${l}`])) as Record<Locale, string>;
const byLocale = (f: (l: Locale) => unknown) => Object.fromEntries(CONTENT_LOCALES.map((l) => [l, f(l)])) as Record<Locale, unknown>;

test('isLocalized / isMediaRef', () => {
  assert.equal(isLocalized(L('a')), true);
  assert.equal(isLocalized({ en: 'a' }), false);
  assert.equal(isLocalized({ ...L('a'), en: 1 }), false);
  assert.equal(isMediaRef({ mediaId: 'x' }), true);
  assert.equal(isMediaRef({ mediaId: 'x', y: 1 }), false);
});

test('projectLocale keeps structure and key order', () => {
  const v = { a: L('t'), n: 3, list: [L('x'), { m: { mediaId: 'm1' } }] };
  const ru = projectLocale(v, 'ru');
  assert.deepEqual(ru, { a: 't-ru', n: 3, list: ['x-ru', { m: { mediaId: 'm1' } }] });
  assert.deepEqual(Object.keys(ru as object), ['a', 'n', 'list']);
});

test('mergeLocales is the inverse of projectLocale for text-only values', () => {
  const v = [{ title: L('a'), description: L('b') }, { title: L('c'), description: L('d') }];
  const merged = mergeLocales(byLocale((l) => projectLocale(v, l)));
  assert.equal(JSON.stringify(merged), JSON.stringify(v));
  assert.equal(mergeLocales(byLocale(() => null)), null);
  assert.deepEqual(mergeLocales(byLocale(() => [])), []);
});

test('mergeLocales rejects languages with a different shape', () => {
  assert.throws(() => mergeLocales(byLocale((l) => (l === 'ar' ? ['x'] : ['x', 'y']))), LocaleShapeError);
  assert.throws(() => mergeLocales(byLocale((l) => (l === 'zh' ? null : 'x'))), LocaleShapeError);
  assert.throws(() => mergeLocales(byLocale((l) => (l === 'tr' ? { a: 'x', b: 'y' } : { a: 'x' }))), LocaleShapeError);
});

test('splitText / joinText round-trip mixed structures exactly', () => {
  const item = { id: 'pectin', number: '01', title: L('t'), image: { mediaId: 'm' }, href: '/x', features: [L('f1'), L('f2')], flag: true, none: null };
  const { structure, texts } = splitText(item);
  assert.deepEqual(structure, { id: 'pectin', number: '01', title: { $t: '$.title' }, image: { mediaId: 'm' }, href: '/x', features: [{ $t: '$.features.0' }, { $t: '$.features.1' }], flag: true, none: null });
  assert.equal(texts.es['$.features.1'], 'f2-es');
  assert.equal(JSON.stringify(joinText(structure, texts)), JSON.stringify(item));
});

test('joinText fails loudly on a missing translation', () => {
  const { structure, texts } = splitText({ t: L('x') });
  delete texts.ar['$.t'];
  assert.throws(() => joinText(structure, texts), LocaleShapeError);
});
