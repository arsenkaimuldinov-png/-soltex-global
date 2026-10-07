/**
 * Helpers for `Localized` values: recognising them, projecting a value to one language and
 * merging per-language projections back into `Localized` values.
 *
 * The database stores one translation row per language. Export rebuilds the stored
 * (multilingual) shape from those rows with `mergeLocales`, which keeps the key order of the
 * source-language projection, so an exported record is byte-identical to the seed it came from.
 */
import { CONTENT_LOCALES, SOURCE_LOCALE, type Locale } from '../domain/locales.ts';
import type { Localized, MediaRef } from './store.ts';

/** True when `value` is a `Localized` object: exactly the content-locale keys, each a string. */
export function isLocalized(value: unknown): value is Localized {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === CONTENT_LOCALES.length &&
    CONTENT_LOCALES.every((l) => typeof (value as Record<string, unknown>)[l] === 'string')
  );
}

/** True when `value` is exactly `{ mediaId: string }`. */
export function isMediaRef(value: unknown): value is MediaRef {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>).mediaId === 'string'
  );
}

/** Replace every `Localized` inside `value` with its string for `locale`. Other values are kept. */
export function projectLocale(value: unknown, locale: Locale): unknown {
  if (isLocalized(value)) return value[locale];
  if (Array.isArray(value)) return value.map((v) => projectLocale(v, locale));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, projectLocale(v, locale)]));
  }
  return value;
}

export class LocaleShapeError extends Error {}

/**
 * Inverse of `projectLocale` for values whose every string leaf is translatable text
 * (e.g. `string[]`, `{ title, description }[]`): combine one projection per language into a
 * value with `Localized` leaves. All projections must have the same shape; `null` stays `null`.
 * Key order follows the source-language projection.
 */
export function mergeLocales(byLocale: Record<Locale, unknown>, path = '$'): unknown {
  const src = byLocale[SOURCE_LOCALE];
  if (typeof src === 'string') {
    const out = {} as Localized;
    for (const l of CONTENT_LOCALES) {
      const v = byLocale[l];
      if (typeof v !== 'string') throw new LocaleShapeError(`${path}: "${l}" is not a string`);
      out[l] = v;
    }
    return out;
  }
  if (src === null || src === undefined) {
    for (const l of CONTENT_LOCALES)
      if (byLocale[l] !== src) throw new LocaleShapeError(`${path}: "${l}" is not ${String(src)}`);
    return src;
  }
  if (Array.isArray(src)) {
    for (const l of CONTENT_LOCALES) {
      const v = byLocale[l];
      if (!Array.isArray(v) || v.length !== src.length)
        throw new LocaleShapeError(`${path}: "${l}" has a different list length`);
    }
    return src.map((_, i) => mergeLocales(pick(byLocale, (v) => (v as unknown[])[i]), `${path}[${i}]`));
  }
  if (typeof src === 'object') {
    const keys = Object.keys(src);
    for (const l of CONTENT_LOCALES) {
      const v = byLocale[l];
      if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length)
        throw new LocaleShapeError(`${path}: "${l}" has a different shape`);
    }
    return Object.fromEntries(
      keys.map((k) => [k, mergeLocales(pick(byLocale, (v) => (v as Record<string, unknown>)[k]), `${path}.${k}`)])
    );
  }
  throw new LocaleShapeError(`${path}: unsupported value of type ${typeof src}`);
}

function pick(byLocale: Record<Locale, unknown>, f: (v: unknown) => unknown): Record<Locale, unknown> {
  return Object.fromEntries(CONTENT_LOCALES.map((l) => [l, f(byLocale[l])])) as Record<Locale, unknown>;
}

// ---------------------------------------------------------------------------
// Mixed values: structure + translatable text (page list items)
// ---------------------------------------------------------------------------

/** Placeholder left in a structure where a `Localized` value was. */
export interface TextSlot {
  $t: string;
}

const isTextSlot = (v: unknown): v is TextSlot =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof (v as TextSlot).$t === 'string';

/**
 * Split a value that mixes structural data and translatable text into
 *  - `structure`: the value with every `Localized` replaced by `{ $t: <path> }`;
 *  - `texts`: per language, a flat map `path → string`.
 * `joinText` is the exact inverse (key order and array order are preserved).
 */
export function splitText(value: unknown): { structure: unknown; texts: Record<Locale, Record<string, string>> } {
  const texts = Object.fromEntries(CONTENT_LOCALES.map((l) => [l, {}])) as Record<Locale, Record<string, string>>;
  const walk = (v: unknown, path: string): unknown => {
    if (isLocalized(v)) {
      for (const l of CONTENT_LOCALES) texts[l][path] = v[l];
      return { $t: path } satisfies TextSlot;
    }
    if (isTextSlot(v)) throw new LocaleShapeError(`${path}: value looks like a text slot`);
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}.${i}`));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, `${path}.${k}`)]));
    return v;
  };
  return { structure: walk(value, '$'), texts };
}

export function joinText(structure: unknown, texts: Record<Locale, Record<string, string>>): unknown {
  const walk = (v: unknown): unknown => {
    if (isTextSlot(v)) {
      const out = {} as Localized;
      for (const l of CONTENT_LOCALES) {
        const s = texts[l]?.[v.$t];
        if (typeof s !== 'string') throw new LocaleShapeError(`${v.$t}: missing text for "${l}"`);
        out[l] = s;
      }
      return out;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(structure);
}
