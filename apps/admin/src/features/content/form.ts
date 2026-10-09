/**
 * Form values of the content editors ↔ API (docs/admin-content.md §5). Pure functions, unit-tested.
 *
 * Lists are edited as items that remember their position in the stored list (`from`); new items
 * have `from: null`. The API uses it to keep translations attached when items move, and copies the
 * source text into the other languages for new items.
 */
import type { FieldDef, FieldKind } from './model';

export interface TextItem {
  value: string;
  from: number | null;
}
export interface LabelValueItem {
  label: string;
  value: string;
  from: number | null;
}
export interface TitleDescItem {
  title: string;
  description: string;
  from: number | null;
}
export interface PatentInfoForm {
  patentNumber: string;
  location: string;
  keyPoints: TextItem[];
}

export type FormValues = Record<string, unknown>;

const isNullable = (k: FieldKind) => k === 'listNull' || k === 'titleDescNull' || k === 'patentInfo';

/** Stored value → form value of one field. */
export function toFormValue(kind: FieldKind, value: unknown): unknown {
  switch (kind) {
    case 'lineNull':
    case 'textNull':
    case 'codeNull':
    case 'mediaNull':
    case 'enumNull':
      return (value as string | null) ?? '';
    case 'list':
    case 'listNull':
      return value === null ? null : (value as string[]).map((v, i): TextItem => ({ value: v, from: i }));
    case 'labelValue':
      return (value as Array<{ label: string; value: string }>).map((v, i): LabelValueItem => ({ ...v, from: i }));
    case 'titleDesc':
    case 'titleDescNull':
      return value === null ? null : (value as Array<{ title: string; description: string }>).map((v, i): TitleDescItem => ({ ...v, from: i }));
    case 'patentInfo': {
      const p = value as { patentNumber: string; location: string; keyPoints: string[] } | null;
      return p ? { patentNumber: p.patentNumber, location: p.location, keyPoints: p.keyPoints.map((v, i) => ({ value: v, from: i })) } : null;
    }
    case 'mediaList':
    case 'refList':
    case 'placements':
      return [...((value as string[]) ?? [])];
    default:
      return value;
  }
}

export function toForm(fields: readonly FieldDef[], record: Record<string, unknown>): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, toFormValue(f.kind, f.name === 'position' ? record.position : record[f.name])]));
}

/** Form value → request value of one field. */
export function toApiValue(kind: FieldKind, value: unknown): unknown {
  switch (kind) {
    case 'lineNull':
    case 'textNull':
    case 'codeNull':
    case 'mediaNull':
    case 'enumNull': {
      const v = typeof value === 'string' ? value.trim() : value;
      return v === '' ? null : v;
    }
    case 'line':
    case 'text':
    case 'code':
    case 'slug':
      return typeof value === 'string' ? value.trim() : value;
    case 'position':
      return Number(value);
    default:
      return value;
  }
}

/** Value comparison that ignores nothing: the API decides what really changed, we only avoid sending untouched fields. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The PATCH body: fields whose form value differs from the stored one. */
export function buildPatch(fields: readonly FieldDef[], initial: FormValues, current: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (same(initial[f.name], current[f.name])) continue;
    out[f.name] = toApiValue(f.kind, current[f.name]);
  }
  return out;
}

/** Client-side checks with the same rules as the API (the API checks again). */
export function validateField(f: FieldDef, value: unknown): string | null {
  const max = f.max;
  switch (f.kind) {
    case 'line':
    case 'text':
    case 'code':
      if (typeof value !== 'string' || !value.trim()) return f.kind === 'code' ? null : 'Заполните поле.';
      if (max && value.trim().length > max) return `Не больше ${max} символов.`;
      return null;
    case 'lineNull':
    case 'textNull':
    case 'codeNull':
      if (max && typeof value === 'string' && value.trim().length > max) return `Не больше ${max} символов.`;
      return null;
    case 'slug':
      if (typeof value !== 'string' || !value) return 'Укажите адрес.';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return 'Только латинские строчные буквы, цифры и одиночные дефисы.';
      if (value.length > 80) return 'Не больше 80 символов.';
      return null;
    case 'list':
    case 'listNull':
      if (value && (value as TextItem[]).some((i) => !i.value.trim())) return 'Заполните или удалите пустые пункты.';
      return null;
    case 'labelValue':
      if ((value as LabelValueItem[]).some((i) => !i.label.trim() || !i.value.trim())) return 'Заполните или удалите пустые строки.';
      return null;
    case 'titleDesc':
    case 'titleDescNull':
      if (value && (value as TitleDescItem[]).some((i) => !i.title.trim() || !i.description.trim())) return 'Заполните или удалите пустые элементы.';
      return null;
    case 'patentInfo': {
      const p = value as PatentInfoForm | null;
      if (p && (!p.patentNumber.trim() || !p.location.trim() || p.keyPoints.some((k) => !k.value.trim()))) return 'Заполните номер, место и пункты патента или уберите блок.';
      return null;
    }
    case 'media':
    case 'ref':
      return value ? null : 'Выберите значение.';
    case 'placements':
      return (value as string[]).length ? null : 'Выберите хотя бы одно место.';
    case 'position':
      return Number.isInteger(Number(value)) && Number(value) >= 0 ? null : 'Целое число от 0.';
    default:
      return null;
  }
}

export function validateAll(fields: readonly FieldDef[], values: FormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const e = validateField(f, values[f.name]);
    if (e) out[f.name] = e;
  }
  return out;
}

/** Move an item of a list (keeps `from`, so translations move with it). */
export function move<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= items.length) return [...items];
  const out = [...items];
  [out[index], out[to]] = [out[to]!, out[index]!];
  return out;
}

export { isNullable };
