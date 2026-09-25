import { DEFAULT_LOCALE, Locale } from './config';
import type { Dictionary } from './translate';

/**
 * Dictionaries are code-split: each language is downloaded only when it is used,
 * so English visitors never pay for the other five languages.
 */
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Dictionary }>> = {
  ru: () => import('./locales/ru.json'),
  zh: () => import('./locales/zh.json'),
  tr: () => import('./locales/tr.json'),
  ar: () => import('./locales/ar.json'),
  es: () => import('./locales/es.json'),
};

const cache: Partial<Record<Locale, Dictionary>> = { [DEFAULT_LOCALE]: {} };

export function getDictionary(locale: Locale): Dictionary | undefined {
  return cache[locale];
}

export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cached = cache[locale];
  if (cached) return cached;
  const mod = await loaders[locale as Exclude<Locale, 'en'>]();
  cache[locale] = mod.default;
  return mod.default;
}
