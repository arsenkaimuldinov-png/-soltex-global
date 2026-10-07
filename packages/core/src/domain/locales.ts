/**
 * Content languages. English is the source language of all current content; every other
 * language is a translation of it. UI metadata of a language (label, html lang, fonts, RTL)
 * belongs to the applications (apps/web/src/i18n/config.ts); the codes live here.
 */
export const CONTENT_LOCALES = ['en', 'ru', 'zh', 'tr', 'ar', 'es'] as const;

export type Locale = (typeof CONTENT_LOCALES)[number];

/** The language every translation is made from. */
export const SOURCE_LOCALE = 'en' satisfies Locale;

/** Languages translated from the source language, in display order. */
export type TranslatedLocale = Exclude<Locale, typeof SOURCE_LOCALE>;

export const TRANSLATED_LOCALES = CONTENT_LOCALES.filter(
  (l): l is TranslatedLocale => l !== SOURCE_LOCALE
) as readonly TranslatedLocale[];

export const isContentLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (CONTENT_LOCALES as readonly string[]).includes(value);
