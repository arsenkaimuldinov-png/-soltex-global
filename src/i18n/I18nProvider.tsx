import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_LOCALE, Locale, LocaleInfo, LOCALE_STORAGE_KEY, getLocaleInfo } from './config';
import { getDictionary, loadDictionary } from './dictionaries';
import { localizePath, splitLocalePath } from './paths';
import { Dictionary, TranslateParams, translate, translateRich } from './translate';

export interface I18nContextValue {
  locale: Locale;
  info: LocaleInfo;
  /** Current path without the locale prefix ("/", "/company", …). */
  path: string;
  /** Translate an English master string (non-strings pass through unchanged). */
  t: <T>(input: T, params?: TranslateParams) => T extends string ? string : T;
  /** Translate a sentence with inline React elements: tr('Hi {name}.', { name: <b>…</b> }). */
  tr: (key: string, nodes: Record<string, React.ReactNode>) => React.ReactNode;
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

  // Dictionaries are preloaded before first render (main.tsx) and before switching.
  // If a locale is reached some other way (e.g. browser back button), load it on demand.
  const [dict, setDict] = useState<Dictionary>(() => getDictionary(locale) ?? {});
  const [dictLocale, setDictLocale] = useState<Locale>(() => (getDictionary(locale) ? locale : DEFAULT_LOCALE));

  useEffect(() => {
    let active = true;
    const cached = getDictionary(locale);
    if (cached) {
      setDict(cached);
      setDictLocale(locale);
    } else {
      loadDictionary(locale).then((d) => {
        if (!active) return;
        setDict(d);
        setDictLocale(locale);
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

  const effectiveLocale = dictLocale === locale ? locale : DEFAULT_LOCALE;

  const t = useCallback(
    <T,>(input: T, params?: TranslateParams) => translate(dict, effectiveLocale, input, params),
    [dict, effectiveLocale]
  ) as I18nContextValue['t'];

  const tr = useCallback(
    (key: string, nodes: Record<string, React.ReactNode>) => translateRich(dict, effectiveLocale, key, nodes),
    [dict, effectiveLocale]
  );

  const lp = useCallback((p: string) => localizePath(p, locale), [locale]);

  const switchLocale = useCallback(
    async (next: Locale) => {
      storeLocale(next);
      await loadDictionary(next);
      navigate(localizePath(path, next) + location.search + location.hash);
    },
    [navigate, path, location.search, location.hash]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, info, path, t, tr, lp, switchLocale }),
    [locale, info, path, t, tr, lp, switchLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
