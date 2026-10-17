/**
 * Настройки сайта (Phase N-0): form model of GET/PUT /api/v1/settings. Pure functions, unit-tested
 * (test/settings.test.ts); the page only renders them.
 */
import type { Settings } from '../../lib/api/schema.gen';

export const LOCALES = ['en', 'ru', 'zh', 'tr', 'ar', 'es'] as const;
export type Loc = (typeof LOCALES)[number];
export const TRANSLATED: Loc[] = ['ru', 'zh', 'tr', 'ar', 'es'];
export const LOCALE_TABS: Record<Loc, string> = { en: 'Английский', ru: 'Русский', zh: 'Китайский', tr: 'Турецкий', ar: 'Арабский', es: 'Испанский' };

export type SettingsForm = {
  primaryEmail: string;
  hqEmail: string;
  texts: Record<Loc, Settings['texts'][string]>;
  metrics: Array<{ id: string; key: string; value: string; texts: Record<Loc, { label: string; highlight: string }> }>;
  offices: Array<{ id: string; key: string; phone: string; email: string; whatsapp: string; texts: Record<Loc, { region: string; title: string; country: string; address: string; representative: string }> }>;
};

const byLoc = <T, U>(r: Record<string, T>, f: (t: T) => U) => Object.fromEntries(LOCALES.map((l) => [l, f(r[l]!)])) as Record<Loc, U>;
const s = (v: string | null | undefined) => v ?? '';
const n = (v: string) => (v.trim() ? v.trim() : null);

export function toForm(v: Settings): SettingsForm {
  return {
    primaryEmail: v.primaryEmail,
    hqEmail: v.hqEmail,
    texts: byLoc(v.texts, (t) => ({ ...t })),
    metrics: v.metrics.map((m) => ({ id: m.id, key: m.key, value: s(m.value), texts: byLoc(m.texts, (t) => ({ label: t.label, highlight: s(t.highlight) })) })),
    offices: v.offices.map((o) => ({
      id: o.id,
      key: o.key,
      phone: s(o.phone),
      email: o.email,
      whatsapp: s(o.whatsapp),
      texts: byLoc(o.texts, (t) => ({ region: t.region, title: t.title, country: t.country, address: s(t.address), representative: s(t.representative) })),
    })),
  };
}

/** Request body of PUT /api/v1/settings ("" → null in optional fields). */
export function toBody(f: SettingsForm) {
  return {
    primaryEmail: f.primaryEmail.trim(),
    hqEmail: f.hqEmail.trim(),
    texts: byLoc(f.texts, (t) => ({ ...t })),
    metrics: f.metrics.map((m) => ({ id: m.id, value: n(m.value), texts: byLoc(m.texts, (t) => ({ label: t.label, highlight: n(t.highlight) })) })),
    offices: f.offices.map((o) => ({
      id: o.id,
      phone: n(o.phone),
      email: o.email.trim(),
      whatsapp: n(o.whatsapp),
      texts: byLoc(o.texts, (t) => ({ region: t.region, title: t.title, country: t.country, address: n(t.address), representative: n(t.representative) })),
    })),
  };
}

export const isDirty = (a: SettingsForm, b: SettingsForm) => JSON.stringify(a) !== JSON.stringify(b);

/** Paths of every translated text, e.g. "texts.hqHours", "offices.0.texts.address". */
function textPaths(f: SettingsForm): Array<{ path: string; get: (x: SettingsForm, l: Loc) => string }> {
  const out: Array<{ path: string; get: (x: SettingsForm, l: Loc) => string }> = [];
  for (const k of Object.keys(f.texts.en) as Array<keyof SettingsForm['texts'][Loc]>) out.push({ path: `texts.${k}`, get: (x, l) => x.texts[l][k] });
  f.metrics.forEach((m, i) => {
    for (const k of Object.keys(m.texts.en) as Array<'label' | 'highlight'>) out.push({ path: `metrics.${i}.texts.${k}`, get: (x, l) => x.metrics[i]!.texts[l][k] });
  });
  f.offices.forEach((o, i) => {
    for (const k of Object.keys(o.texts.en) as Array<keyof SettingsForm['offices'][number]['texts'][Loc]>) out.push({ path: `offices.${i}.texts.${k}`, get: (x, l) => x.offices[i]!.texts[l][k] });
  });
  return out;
}

/**
 * Texts whose English was changed in this edit while the given language was not touched — the
 * editor is reminded to check them (the API keeps approved translations approved).
 */
export function translationsToCheck(initial: SettingsForm, current: SettingsForm): Record<Loc, string[]> {
  const out = Object.fromEntries(LOCALES.map((l) => [l, [] as string[]])) as Record<Loc, string[]>;
  for (const p of textPaths(current)) {
    if (p.get(initial, 'en') === p.get(current, 'en')) continue;
    for (const l of TRANSLATED) if (p.get(initial, l) === p.get(current, l)) out[l].push(p.path);
  }
  return out;
}

/**
 * API field errors → form paths. The API reports zod paths in either form
 * ("offices.0.texts.ru.email" or "/offices/0/texts/ru/email"); the form keys errors by
 * `<path without the language>` plus the language, so a tab can show that it holds an error.
 */
export function errorsByPath(fieldErrors: Array<{ field: string; message: string }>): { fields: Record<string, string>; locales: Set<Loc> } {
  const fields: Record<string, string> = {};
  const locales = new Set<Loc>();
  for (const e of fieldErrors) {
    const parts = e.field.replace(/^body[./]?/, '').replace(/^\//, '').split(/[./]/).filter(Boolean);
    const li = parts.findIndex((p) => (LOCALES as readonly string[]).includes(p));
    let key = parts.join('.');
    if (li >= 0 && parts[li - 1] === 'texts') {
      locales.add(parts[li] as Loc);
      key = [...parts.slice(0, li), ...parts.slice(li + 1)].join('.') + `@${parts[li]}`;
    }
    fields[key] = e.message === 'records_mismatch' ? 'Список изменился: обновите страницу.' : 'Проверьте значение поля.';
  }
  return { fields, locales };
}
