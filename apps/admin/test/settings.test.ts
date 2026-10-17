/**
 * Настройки сайта (Phase N-0): form ↔ API body, translations to re-check, API field errors.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Settings } from '../src/lib/api/schema.gen';
import { errorsByPath, isDirty, toBody, toForm, translationsToCheck } from '../src/features/settings/model';

const L = ['en', 'ru', 'zh', 'tr', 'ar', 'es'] as const;
const per = <T>(f: (l: string) => T) => Object.fromEntries(L.map((l) => [l, f(l)])) as Record<string, T>;
const view: Settings = {
  version: 3,
  siteName: 'Soltex Global',
  primaryEmail: 'info@soltexglobal.co',
  hqEmail: 'info@soltexglobal.co',
  texts: per((l) => ({ footerTagline: `tag ${l}`, footerLocation: `loc ${l}`, copyright: `© ${l}`, hqName: 'FZC', hqAddressLine1: 'a1', hqAddressLine2: `a2 ${l}`, hqShortAddress: 's', hqJurisdiction: `j ${l}`, hqHours: `h ${l}`, defaultSiteTitle: `t ${l}`, defaultSiteDescription: `d ${l}` })),
  metrics: [{ id: 'm1', key: 'metric-experience', position: 1, value: '25+', texts: per((l) => ({ label: `years ${l}`, highlight: null })) }],
  offices: [{ id: 'o1', key: 'office-01', position: 1, phone: null, email: 'a@b.co', whatsapp: '+1', texts: per((l) => ({ region: `r ${l}`, title: 'LTD', country: `c ${l}`, address: null, representative: null })) }],
  updatedAt: '2026-10-18T00:00:00Z',
  updatedBy: null,
};

test('form round trip: nulls become "" in the form and null again in the body; an untouched form is not dirty', () => {
  const f = toForm(view);
  assert.equal(f.offices[0]!.phone, '');
  assert.equal(f.metrics[0]!.texts.ru.highlight, '');
  const body = toBody(f);
  assert.equal(body.offices[0]!.phone, null);
  assert.equal(body.offices[0]!.texts.ru.address, null);
  assert.equal(body.metrics[0]!.texts.en.highlight, null);
  assert.deepEqual(Object.keys(body.texts), [...L]);
  assert.equal(isDirty(f, toForm(view)), false);
  const g = toForm(view);
  g.offices[0]!.phone = '  +7 701 000 00 00 ';
  assert.equal(isDirty(f, g), true);
  assert.equal(toBody(g).offices[0]!.phone, '+7 701 000 00 00');
});

test('translations to check: English changed, the language not', () => {
  const a = toForm(view);
  const b = toForm(view);
  b.texts.en.hqHours = 'Sun–Thu';
  b.texts.ru.hqHours = 'Вс–Чт';
  b.offices[0]!.texts.en.country = 'Bulgaria, Sofia';
  const c = translationsToCheck(a, b);
  assert.deepEqual(c.ru, ['offices.0.texts.country']);
  assert.deepEqual(c.zh, ['texts.hqHours', 'offices.0.texts.country']);
  assert.deepEqual(c.en, []);
  assert.deepEqual(translationsToCheck(a, a).ar, []);
});

test('API field errors → form paths, with the language of translated texts', () => {
  const e = errorsByPath([
    { field: 'offices.0.email', message: 'Invalid email' },
    { field: 'texts.zh.copyright', message: 'Too small' },
    { field: '/offices/0/texts/ar/country', message: 'Too small' },
    { field: 'offices', message: 'records_mismatch' },
  ]);
  assert.deepEqual(Object.keys(e.fields).sort(), ['offices', 'offices.0.email', 'offices.0.texts.country@ar', 'texts.copyright@zh']);
  assert.deepEqual([...e.locales].sort(), ['ar', 'zh']);
  assert.match(e.fields.offices!, /обновите/);
});
