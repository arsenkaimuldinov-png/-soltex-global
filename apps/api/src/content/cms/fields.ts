/**
 * Field kinds of the content editor and the language-safe write rules (docs/admin-content.md §4).
 *
 * The CMS edits the SOURCE language (en). Every entity keeps one translation row per content
 * language, and the export (content/export.ts) requires all rows to have the same shape: the same
 * null-ness and the same list lengths. So a source edit must keep the other languages' shape:
 *
 *  - plain text: only the source row changes; translations keep their text (Phase F marks them
 *    outdated through the approved source hash; the status itself is not touched here);
 *  - nullable text / list / object: set to null → null in every language; null → value: the
 *    other languages get a copy of the source value (they are then simply untranslated);
 *  - lists: every item of the new source list says where it came from (`from` = index in the
 *    current list, or null for a new item). Translations follow: an existing item keeps its
 *    translated text at its new position, a new item gets a copy of the source text, a removed
 *    item disappears in every language.
 */
import { z } from 'zod';

export type TrKind = 'text' | 'textNull' | 'list' | 'listNull' | 'labelValue' | 'titleDesc' | 'titleDescNull' | 'patentInfo';

/** Limits of edited texts (characters). */
export const LIMITS = { line: 300, text: 5000, item: 1000, items: 50 } as const;

// ---------------------------------------------------------------------------
// Input schemas (request bodies). `from` keeps list items linked to their translations.
// ---------------------------------------------------------------------------

const From = z.number().int().min(0).nullable().describe('Index of the item in the current list, or null for a new item');

export const TextItemInput = z.object({ value: z.string().trim().min(1).max(LIMITS.item), from: From }).strict();
export const LabelValueItemInput = z
  .object({ label: z.string().trim().min(1).max(LIMITS.line), value: z.string().trim().min(1).max(LIMITS.item), from: From })
  .strict();
export const TitleDescItemInput = z
  .object({ title: z.string().trim().min(1).max(LIMITS.line), description: z.string().trim().min(1).max(LIMITS.text), from: From })
  .strict();
export const PatentInfoInput = z
  .object({
    patentNumber: z.string().trim().min(1).max(LIMITS.line),
    location: z.string().trim().min(1).max(LIMITS.line),
    keyPoints: z.array(TextItemInput).max(LIMITS.items),
  })
  .strict();

export type TextItem = z.infer<typeof TextItemInput>;
export type LabelValueItem = z.infer<typeof LabelValueItemInput>;
export type TitleDescItem = z.infer<typeof TitleDescItemInput>;
export type PatentInfoValue = z.infer<typeof PatentInfoInput>;

/** Request schema of a translated field. `required` = non-null and non-empty on create. */
export function trInputSchema(kind: TrKind, max: number = LIMITS.text): z.ZodType {
  const text = z.string().trim().min(1).max(max);
  switch (kind) {
    case 'text':
      return text;
    case 'textNull':
      return z.string().trim().max(max).nullable().describe('Empty or null = not shown');
    case 'list':
      return z.array(TextItemInput).max(LIMITS.items);
    case 'listNull':
      return z.array(TextItemInput).max(LIMITS.items).nullable();
    case 'labelValue':
      return z.array(LabelValueItemInput).max(LIMITS.items);
    case 'titleDesc':
      return z.array(TitleDescItemInput).max(LIMITS.items);
    case 'titleDescNull':
      return z.array(TitleDescItemInput).max(LIMITS.items).nullable();
    case 'patentInfo':
      return PatentInfoInput.nullable();
  }
}

/** Response schema of a translated field (stored source-language value). */
export function trOutputSchema(kind: TrKind): z.ZodType {
  switch (kind) {
    case 'text':
      return z.string();
    case 'textNull':
      return z.string().nullable();
    case 'list':
      return z.array(z.string());
    case 'listNull':
      return z.array(z.string()).nullable();
    case 'labelValue':
      return z.array(z.object({ label: z.string(), value: z.string() }));
    case 'titleDesc':
      return z.array(z.object({ title: z.string(), description: z.string() }));
    case 'titleDescNull':
      return z.array(z.object({ title: z.string(), description: z.string() })).nullable();
    case 'patentInfo':
      return z.object({ patentNumber: z.string(), location: z.string(), keyPoints: z.array(z.string()) }).nullable();
  }
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

type ListInput = Array<{ from: number | null } & Record<string, unknown>>;

/** Stored source-language value of an input (what the source row gets). */
export function sourceValue(kind: TrKind, input: unknown): unknown {
  if (input === null) return null;
  switch (kind) {
    case 'text':
      return input;
    case 'textNull':
      return (input as string) === '' ? null : input;
    case 'list':
    case 'listNull':
      return (input as TextItem[]).map((i) => i.value);
    case 'labelValue':
      return (input as LabelValueItem[]).map((i) => ({ label: i.label, value: i.value }));
    case 'titleDesc':
    case 'titleDescNull':
      return (input as TitleDescItem[]).map((i) => ({ title: i.title, description: i.description }));
    case 'patentInfo': {
      const p = input as PatentInfoValue;
      return { patentNumber: p.patentNumber, location: p.location, keyPoints: p.keyPoints.map((k) => k.value) };
    }
  }
}

export class ListOriginError extends Error {}

/** Check that `from` indexes point into the current list and are not repeated. */
function checkOrigins(items: ListInput, currentLength: number, field: string) {
  const seen = new Set<number>();
  for (const it of items) {
    if (it.from === null) continue;
    if (it.from >= currentLength || seen.has(it.from)) throw new ListOriginError(field);
    seen.add(it.from);
  }
}

function followList(items: ListInput, current: unknown[] | null, copy: (it: ListInput[number]) => unknown): unknown[] {
  return items.map((it) => (it.from !== null && current ? current[it.from] : copy(it)));
}

/**
 * Value of a translated field for a NON-source language after a source edit.
 * `currentSource` / `current` are the stored values before the edit.
 */
export function translationValue(kind: TrKind, input: unknown, currentSource: unknown, current: unknown, field: string): unknown {
  const src = sourceValue(kind, input);
  if (src === null) return null;
  switch (kind) {
    case 'text':
      return current ?? src;
    case 'textNull':
      return current === null || current === undefined ? src : current;
    case 'list':
    case 'listNull':
    case 'labelValue':
    case 'titleDesc':
    case 'titleDescNull': {
      const items = input as ListInput;
      if (currentSource === null || current === null || current === undefined) return src;
      checkOrigins(items, (currentSource as unknown[]).length, field);
      const copyOf = (i: number) => (src as unknown[])[i];
      return items.map((it, i) => (it.from !== null ? (current as unknown[])[it.from] : copyOf(i)));
    }
    case 'patentInfo': {
      const p = input as PatentInfoValue;
      const s = src as { patentNumber: string; location: string; keyPoints: string[] };
      if (currentSource === null || current === null || current === undefined) return s;
      const cur = current as { patentNumber: string; location: string; keyPoints: string[] };
      const curSrc = currentSource as { keyPoints: string[] };
      checkOrigins(p.keyPoints, curSrc.keyPoints.length, `${field}.keyPoints`);
      return {
        patentNumber: cur.patentNumber,
        location: cur.location,
        keyPoints: followList(p.keyPoints, cur.keyPoints, (it) => (it as TextItem).value),
      };
    }
  }
}

/** Validate list origins against the current source value (before any write). */
export function validateOrigins(kind: TrKind, input: unknown, currentSource: unknown, field: string) {
  if (input === null || currentSource === null || currentSource === undefined) return;
  if (kind === 'patentInfo') {
    checkOrigins((input as PatentInfoValue).keyPoints, (currentSource as { keyPoints: string[] }).keyPoints.length, `${field}.keyPoints`);
  } else if (kind !== 'text' && kind !== 'textNull') {
    checkOrigins(input as ListInput, (currentSource as unknown[]).length, field);
  }
}

/** Does the input change the stored source value (text, order or list structure)? */
export function changes(kind: TrKind, input: unknown, currentSource: unknown): boolean {
  const next = sourceValue(kind, input);
  if (JSON.stringify(next) !== JSON.stringify(currentSource ?? null)) return true;
  // Same texts, but items moved or replaced by new ones: the translations would move too.
  const identity = (items: ListInput) => items.every((it, i) => it.from === i);
  if (input === null) return false;
  if (kind === 'patentInfo') return !identity((input as PatentInfoValue).keyPoints);
  if (kind === 'text' || kind === 'textNull') return false;
  return !identity(input as ListInput);
}
