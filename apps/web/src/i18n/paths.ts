import { DEFAULT_LOCALE, isLocale, Locale } from './config';

/**
 * URL scheme
 *   English (master):  /company, /projects/solbar-israel …   (unchanged, no prefix)
 *   Other languages:   /ru/company, /zh/projects/solbar-israel …
 *
 * Slugs are identical in every language, so switching language maps 1:1 to the same page.
 */

/** Split a pathname into its locale and the locale-less path ("/" for home). */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const segments = pathname.split('/');
  const first = segments[1];
  if (isLocale(first) && first !== DEFAULT_LOCALE) {
    const rest = '/' + segments.slice(2).join('/');
    return { locale: first, path: rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/' };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || '/' };
}

/** Build the public URL path of a locale-less path in a given locale. */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith('/')) return path; // hash links, mailto:, external…
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** Locale detected from the current browser URL (used before React mounts). */
export function localeFromLocation(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return splitLocalePath(window.location.pathname).locale;
}
