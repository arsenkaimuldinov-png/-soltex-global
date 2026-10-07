/**
 * Locale primitives for the content layer.
 *
 * English is the source language. Every genuinely translatable content field is stored as a
 * `Localized` object with one string per public language. Structural values (IDs, slugs,
 * numbers, country codes, technical codes, URLs) are never localized.
 *
 * Since Phase B the content-language codes, `Localized` and `isLocalized` live in
 * @soltex/core (shared with the API); this module re-exports them for the site.
 */
import { DEFAULT_LOCALE, LOCALE_CODES, Locale } from '../i18n/config';
import { CONTENT_LOCALES, TRANSLATED_LOCALES, type Locale as CoreLocale, type TranslatedLocale } from '@soltex/core/domain';

export type { Locale, TranslatedLocale };
export { DEFAULT_LOCALE, LOCALE_CODES, TRANSLATED_LOCALES };
export { isLocalized, type Localized } from '@soltex/core/content';

// The site's languages (i18n/config) and the content languages (core) must be the same set.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameLocales: Same<Locale, CoreLocale> = true;
if (!sameLocales || LOCALE_CODES.join() !== CONTENT_LOCALES.join()) {
  throw new Error('i18n/config LOCALES and @soltex/core CONTENT_LOCALES differ');
}
