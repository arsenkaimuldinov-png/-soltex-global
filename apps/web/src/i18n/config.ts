/**
 * Locale configuration — single source of truth for every language the site supports.
 *
 * English is the MASTER language: its copy lives in the components and data files and is
 * never translated or rewritten here. Every other locale is a dictionary keyed by the exact
 * English string (see ./locales/*.json).
 */

export type Locale = 'en' | 'ru' | 'zh' | 'tr' | 'ar' | 'es';

export interface LocaleInfo {
  code: Locale;
  /** Label shown in the language switcher. */
  label: string;
  /** Value for <html lang> and hreflang. */
  htmlLang: string;
  /** OpenGraph locale. */
  ogLocale: string;
  dir: 'ltr' | 'rtl';
  /**
   * Extra Google Fonts families needed because the brand fonts (Plus Jakarta Sans,
   * JetBrains Mono) have no glyphs for this script. Loaded only for this locale.
   */
  fallbackFonts?: string;
}

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'EN', htmlLang: 'en', ogLocale: 'en_US', dir: 'ltr' },
  {
    code: 'ru',
    label: 'RU',
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    dir: 'ltr',
    fallbackFonts: 'family=Manrope:wght@300;400;500;600;700;800',
  },
  {
    code: 'zh',
    label: '中文',
    htmlLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    dir: 'ltr',
    fallbackFonts: 'family=Noto+Sans+SC:wght@300;400;500;700;800&family=Noto+Serif+SC:wght@400;600;700',
  },
  { code: 'tr', label: 'TR', htmlLang: 'tr', ogLocale: 'tr_TR', dir: 'ltr' },
  {
    code: 'ar',
    label: 'العربية',
    htmlLang: 'ar',
    ogLocale: 'ar_AR',
    dir: 'rtl',
    fallbackFonts: 'family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700',
  },
  { code: 'es', label: 'ES', htmlLang: 'es', ogLocale: 'es_ES', dir: 'ltr' },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export const getLocaleInfo = (code: Locale): LocaleInfo =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];

export const isLocale = (value: string | undefined): value is Locale =>
  !!value && (LOCALE_CODES as string[]).includes(value);

/**
 * Canonical production origin used for canonical/hreflang/sitemap URLs.
 * Override at build time with VITE_SITE_URL if the site is deployed to another domain.
 */
export const SITE_URL: string = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SITE_URL ||
  (typeof process !== 'undefined' ? process.env?.VITE_SITE_URL : undefined) ||
  'https://soltexglobal.co'
).replace(/\/+$/, '');

/** localStorage key for the visitor's explicit language choice. */
export const LOCALE_STORAGE_KEY = 'soltex.locale';
