/**
 * The translatable content of one entity as a list of typed fields (Phase F,
 * docs/admin-translations.md §5). One description for the translation editor of all seven types:
 * the source-language value and the target-language value of every field that has source text.
 *
 * Field kinds (value shapes are the stored shapes of the Phase B tables):
 *   text        string
 *   list        string[]                                  (same number of items as the source)
 *   pairs       { label, value }[]                        (specs, header meta)
 *   titleDesc   { title, description }[]
 *   patentInfo  { patentNumber, location, keyPoints: string[] }
 *   records     Record<textField, string>[]               (page list items)
 *
 * A translation always has the structure of the source: the same fields (a field without source
 * text is not translated), the same list lengths, the same item fields. Only texts change, so the
 * export keeps all languages in one shape (admin-content.md §4).
 */
import { SEO_FIELDS } from '@soltex/core/domain';
import { placeholdersOf } from '@soltex/core/content';
import { LIMITS, type TrKind } from '../cms/fields.ts';

export type FieldKind = 'text' | 'list' | 'pairs' | 'titleDesc' | 'patentInfo' | 'records';

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  group: 'content' | 'seo';
  /** Edited as a paragraph (text fields). */
  multiline: boolean;
  /** Character limit of one text. */
  max: number;
  /** Text fields of one item (records). */
  itemFields?: string[];
}

export type TranslationValue =
  | string
  | string[]
  | Array<{ label: string; value: string }>
  | Array<{ title: string; description: string }>
  | { patentNumber: string; location: string; keyPoints: string[] }
  | Array<Record<string, string>>;

export interface DocumentField extends FieldSpec {
  /** `{name}` placeholders of the source text that the translation must keep (text fields). */
  placeholders: string[];
  source: TranslationValue;
  target: TranslationValue | null;
}

export const kindOfTr = (k: TrKind): FieldKind =>
  k === 'text' || k === 'textNull' ? 'text' : k === 'list' || k === 'listNull' ? 'list' : k === 'labelValue' ? 'pairs' : k === 'patentInfo' ? 'patentInfo' : 'titleDesc';

export const groupOf = (name: string): 'content' | 'seo' => (SEO_FIELDS.includes(name) ? 'seo' : 'content');

/** Is there source text to translate? (null, '' and empty lists are not translated) */
export function hasSourceText(kind: FieldKind, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (kind === 'text') return typeof value === 'string' && value.trim() !== '';
  if (kind === 'patentInfo') return true;
  return Array.isArray(value) && value.length > 0;
}

/** Every text inside a value, in order (for placeholders and "same as source" hints). */
export function textsOf(kind: FieldKind, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  switch (kind) {
    case 'text':
      return [value as string];
    case 'list':
      return value as string[];
    case 'pairs':
      return (value as Array<{ label: string; value: string }>).flatMap((p) => [p.label, p.value]);
    case 'titleDesc':
      return (value as Array<{ title: string; description: string }>).flatMap((p) => [p.title, p.description]);
    case 'patentInfo': {
      const p = value as { patentNumber: string; location: string; keyPoints: string[] };
      return [p.patentNumber, p.location, ...p.keyPoints];
    }
    case 'records':
      return (value as Array<Record<string, string>>).flatMap((r) => Object.values(r));
  }
}

export function placeholdersOfValue(kind: FieldKind, value: unknown): string[] {
  return [...new Set(textsOf(kind, value).flatMap(placeholdersOf))].sort();
}

// ---------------------------------------------------------------------------
// Validation of a submitted translation value against the source value
// ---------------------------------------------------------------------------

export type ValueError = 'required' | 'too_long' | 'structure_is_fixed' | 'placeholders' | 'invalid';

class Invalid extends Error {
  constructor(readonly code: ValueError) {
    super(code);
  }
}

/** A trimmed, non-empty text of at most `max` characters. */
function text(raw: unknown, max: number): string {
  if (typeof raw !== 'string') throw new Invalid('invalid');
  const t = raw.trim();
  if (!t) throw new Invalid('required');
  if (t.length > max) throw new Invalid('too_long');
  return t;
}

function sameLength(value: unknown, source: unknown): unknown[] {
  if (!Array.isArray(value) || !Array.isArray(source) || value.length !== source.length) throw new Invalid('structure_is_fixed');
  return value;
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Invalid('structure_is_fixed');
  if (Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Invalid('structure_is_fixed');
  return value as Record<string, unknown>;
}

/**
 * Normalised (trimmed) value, or an error code. The structure must equal the source structure
 * (same items, same item fields); placeholders must equal the source placeholders.
 */
export function validateValue(spec: FieldSpec, source: unknown, value: unknown): { value: unknown } | { error: ValueError } {
  try {
    let out: unknown;
    switch (spec.kind) {
      case 'text':
        out = text(value, spec.max);
        break;
      case 'list':
        out = sameLength(value, source).map((v) => text(v, LIMITS.item));
        break;
      case 'pairs':
        out = sameLength(value, source).map((v) => {
          const o = object(v, ['label', 'value']);
          return { label: text(o.label, LIMITS.line), value: text(o.value, LIMITS.item) };
        });
        break;
      case 'titleDesc':
        out = sameLength(value, source).map((v) => {
          const o = object(v, ['title', 'description']);
          return { title: text(o.title, LIMITS.line), description: text(o.description, LIMITS.text) };
        });
        break;
      case 'patentInfo': {
        const o = object(value, ['patentNumber', 'location', 'keyPoints']);
        out = {
          patentNumber: text(o.patentNumber, LIMITS.line),
          location: text(o.location, LIMITS.line),
          keyPoints: sameLength(o.keyPoints, (source as { keyPoints: string[] }).keyPoints).map((k) => text(k, LIMITS.item)),
        };
        break;
      }
      case 'records': {
        const src = source as Array<Record<string, string>>;
        out = sameLength(value, source).map((v, i) => {
          const keys = Object.keys(src[i]!);
          const o = object(v, keys);
          return Object.fromEntries(keys.map((k) => [k, text(o[k], LIMITS.text)]));
        });
        break;
      }
    }
    if (placeholdersOfValue(spec.kind, out).join() !== placeholdersOfValue(spec.kind, source).join()) return { error: 'placeholders' };
    return { value: out };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.code };
    throw e;
  }
}
