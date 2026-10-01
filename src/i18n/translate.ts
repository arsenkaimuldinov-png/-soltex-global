import React from 'react';
import type { UiDictionary, UiKey } from './bundles';
import { interpolate, interpolateNodes, CopyParams } from '../content/getters';

export type TranslateParams = CopyParams;

/**
 * Translate a UI string by its stable key. The build guarantees every key exists in every
 * language (scripts/content/check-ui-keys.ts); English is the fallback only while a language
 * bundle is still loading.
 */
export function translate(dict: UiDictionary, fallback: UiDictionary, key: UiKey, params?: TranslateParams): string {
  return interpolate(dict[key] ?? fallback[key] ?? key, params);
}

/** UI string with inline React elements in place of {placeholders}. */
export function translateRich(
  dict: UiDictionary,
  fallback: UiDictionary,
  key: UiKey,
  nodes: Record<string, React.ReactNode>
): React.ReactNode {
  return interpolateNodes(dict[key] ?? fallback[key] ?? key, nodes);
}

/**
 * Render "\n" inside a string or rich node list as <br />, matching headings that were
 * originally written as `LINE ONE<br />LINE TWO`. Each language chooses its own line breaks.
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
