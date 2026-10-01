/**
 * Locale primitives for the content layer.
 *
 * English is the source language. Every genuinely translatable content field is stored as a
 * `Localized` object with one string per public language. Structural values (IDs, slugs,
 * numbers, country codes, technical codes, URLs) are never localized.
 */
import { DEFAULT_LOCALE, LOCALE_CODES, Locale } from '../i18n/config';

export type { Locale };
export { DEFAULT_LOCALE, LOCALE_CODES };

/** One value per public language. `en` is the source of truth. */
export type Localized<T = string> = { [L in Locale]: T };

/** Languages that are translated from English (everything except the default). */
export type TranslatedLocale = Exclude<Locale, 'en'>;

export const TRANSLATED_LOCALES = LOCALE_CODES.filter((l): l is TranslatedLocale => l !== DEFAULT_LOCALE);

/** True when `value` is a `Localized` object: exactly the six locale keys, each a string. */
export function isLocalized(value: unknown): value is Localized {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === LOCALE_CODES.length &&
    LOCALE_CODES.every((l) => typeof (value as Record<string, unknown>)[l] === 'string')
  );
}
