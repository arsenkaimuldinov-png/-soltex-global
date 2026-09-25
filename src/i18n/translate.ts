import React from 'react';
import { DEFAULT_LOCALE, Locale } from './config';

/** A translation dictionary: exact English master string → translated string. */
export type Dictionary = Record<string, string>;

export type TranslateParams = Record<string, string | number>;

declare global {
  interface Window {
    /** QA hook: when present, every missing translation lookup is recorded here. */
    __I18N_MISSING__?: Record<string, number>;
  }
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/**
 * Translate an English master string.
 *
 * - English: returns the input unchanged (the master copy is never altered).
 * - Other locales: returns the dictionary entry, falling back to English if missing.
 * - Non-string input (numbers, undefined, React nodes) is returned untouched, so data
 *   fields can be passed through safely without type checks at every call site.
 */
export function translate<T>(
  dict: Dictionary,
  locale: Locale,
  input: T,
  params?: TranslateParams
): T extends string ? string : T {
  if (typeof input !== 'string') return input as never;
  let out: string = input;
  if (locale !== DEFAULT_LOCALE) {
    const hit = dict[input];
    if (hit !== undefined) {
      out = hit;
    } else if (typeof window !== 'undefined' && window.__I18N_MISSING__ && /[A-Za-z]/.test(input)) {
      const k = `${locale}::${input}`;
      window.__I18N_MISSING__[k] = (window.__I18N_MISSING__[k] || 0) + 1;
    }
  }
  return interpolate(out, params) as never;
}

/**
 * Translate a sentence that contains inline React elements, e.g.
 *   "Thank you, {name}. We will call you at {phone}."
 * Placeholders are replaced with the given nodes, so word order can change per language
 * while the English output stays byte-identical to the original JSX.
 */
export function translateRich(
  dict: Dictionary,
  locale: Locale,
  key: string,
  nodes: Record<string, React.ReactNode>
): React.ReactNode {
  const template = translate(dict, locale, key);
  const parts = template.split(/\{(\w+)\}/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? React.createElement(React.Fragment, { key: i }, nodes[part] ?? `{${part}}`)
      : part
  );
}

/**
 * Render "\n" inside a (translated) string or rich node list as <br />, matching headings
 * that were originally written as `LINE ONE<br />LINE TWO` in JSX. Each language can choose
 * its own line breaks in its dictionary entry.
 */
export function withLineBreaks(node: React.ReactNode): React.ReactNode {
  const split = (text: string, keyBase: string | number): React.ReactNode[] =>
    text.split('\n').flatMap((line, i) =>
      i === 0 ? [line] : [React.createElement('br', { key: `${keyBase}-br-${i}` }), line]
    ).filter((part) => part !== '');
  if (typeof node === 'string') return split(node, 's');
  if (Array.isArray(node)) {
    return node.flatMap((part, idx) => (typeof part === 'string' ? split(part, idx) : [part]));
  }
  return node;
}
