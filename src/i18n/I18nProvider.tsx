import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { withViewTransition } from '../motion/prefs';
import { DEFAULT_LOCALE, Locale, LocaleInfo, LOCALE_STORAGE_KEY, getLocaleInfo } from './config';
import { englishUi, getBundle, loadBundle, LocaleBundle, UiKey } from './bundles';
import { localizePath, splitLocalePath } from './paths';
import { TranslateParams, translate, translateRich } from './translate';
import type { ContentApi } from '../content/getters';

export interface I18nContextValue {
  locale: Locale;
  info: LocaleInfo;
  /** Current path without the locale prefix ("/", "/company", …). */
  path: string;
  /** UI string by stable key (navigation, buttons, labels, form texts, system messages). */
  t: (key: UiKey, params?: TranslateParams) => string;
  /** UI string with inline React elements: tr('form.thanks', { name: <b>…</b> }). */
  tr: (key: UiKey, nodes: Record<string, React.ReactNode>) => React.ReactNode;
  /** Content of the current language (pages, projects, technologies, …). */
  content: ContentApi;
  /** Prefix an internal locale-less path with the current locale. */
  lp: (path: string) => string;
  /** Switch language, staying on the same page. */
  switchLocale: (locale: Locale) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* storage unavailable (private mode) — URL still carries the language */
  }
}

/** Load the extra script fonts a locale needs (never for English). */
function ensureLocaleFonts(info: LocaleInfo) {
  if (!info.fallbackFonts || typeof document === 'undefined') return;
  const id = `i18n-fonts-${info.code}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${info.fallbackFonts}&display=swap`;
  document.head.appendChild(link);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, path } = splitLocalePath(location.pathname);
  const info = getLocaleInfo(locale);

  // Bundles are preloaded before the first render (main.tsx / prerender) and before switching.
  // If a locale is reached some other way (e.g. browser back button), load it on demand and
  // keep showing English until it arrives.
  const [bundle, setBundle] = useState<LocaleBundle>(() => getBundle(locale) ?? getBundle(DEFAULT_LOCALE)!);
  const [bundleLocale, setBundleLocale] = useState<Locale>(() => (getBundle(locale) ? locale : DEFAULT_LOCALE));

  useEffect(() => {
    let active = true;
    const cached = getBundle(locale);
    if (cached) {
      setBundle(cached);
      setBundleLocale(locale);
    } else {
      loadBundle(locale).then((b) => {
        if (!active) return;
        setBundle(b);
        setBundleLocale(locale);
      });
    }
    return () => {
      active = false;
    };
  }, [locale]);

  // <html lang/dir> + script fonts
  useEffect(() => {
    const html = document.documentElement;
    html.lang = info.htmlLang;
    html.dir = info.dir;
    ensureLocaleFonts(info);
  }, [info]);

  const active = bundleLocale === locale ? bundle : getBundle(DEFAULT_LOCALE)!;

  const t = useCallback(
    (key: UiKey, params?: TranslateParams) => translate(active.ui, englishUi, key, params),
    [active]
  );

  const tr = useCallback(
    (key: UiKey, nodes: Record<string, React.ReactNode>) => translateRich(active.ui, englishUi, key, nodes),
    [active]
  );

  const lp = useCallback((p: string) => localizePath(p, locale), [locale]);

  const switchLocale = useCallback(
    async (next: Locale) => {
      storeLocale(next);
      await loadBundle(next);
      const to = localizePath(path, next) + location.search + location.hash;
      withViewTransition(() => {
        flushSync(() => navigate(to));
      });
    },
    [navigate, path, location.search, location.hash]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, info, path, t, tr, content: active.content, lp, switchLocale }),
    [locale, info, path, t, tr, active, lp, switchLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
