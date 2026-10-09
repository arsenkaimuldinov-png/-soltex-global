/**
 * Translation management in the admin (Phase F, docs/admin-translations.md): labels, languages,
 * field names and the pure form logic of the translation editor. No React here (unit-tested in node).
 *
 * The API decides everything (states, permissions, validation); this file only presents it and
 * repeats the field checks so a translator sees a mistake before saving.
 */
import { SEO_FIELDS, type EffectiveTranslationState, type Permission, type TranslatedLocale } from '@soltex/core/domain';
import { placeholdersOf } from '@soltex/core/content';
import { COLLECTION_UI, type CollectionName } from '../content/model';
import { LIST_FIELD_NAMES, LIST_NAMES, slotLabel } from '../content/page-labels';

export type TranslatableType = 'pages' | CollectionName;
export const TRANSLATABLE_TYPES: readonly TranslatableType[] = ['pages', 'projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos'];

export const TYPE_LABELS: Record<TranslatableType, string> = {
  pages: 'Страницы',
  projects: 'Проекты',
  technologies: 'Технологии',
  products: 'Продукты',
  'epcm-stages': 'EPC / EPCM',
  patents: 'Патенты',
  videos: 'Видео',
};

/** Language metadata of the editor: name, html `lang`, writing direction. */
export const LOCALE_INFO: Record<'en' | TranslatedLocale, { short: string; name: string; lang: string; dir: 'ltr' | 'rtl' }> = {
  en: { short: 'EN', name: 'Английский', lang: 'en', dir: 'ltr' },
  ru: { short: 'RU', name: 'Русский', lang: 'ru', dir: 'ltr' },
  zh: { short: 'ZH', name: 'Китайский', lang: 'zh', dir: 'ltr' },
  tr: { short: 'TR', name: 'Турецкий', lang: 'tr', dir: 'ltr' },
  ar: { short: 'AR', name: 'Арабский', lang: 'ar', dir: 'rtl' },
  es: { short: 'ES', name: 'Испанский', lang: 'es', dir: 'ltr' },
};

export const STATE_LABELS: Record<EffectiveTranslationState, string> = {
  missing: 'Нет перевода',
  in_progress: 'В работе',
  outdated: 'Устарел',
  approved: 'Утверждён',
};
export const STATE_TONES = { missing: 'neutral', in_progress: 'warn', outdated: 'danger', approved: 'ok' } as const;
export const STATE_HINTS: Record<EffectiveTranslationState, string> = {
  missing: 'Перевода ещё нет: в полях — копия английского текста. На сайте для этого языка показывается английская версия.',
  in_progress: 'Перевод сохранён, но не утверждён. На сайте для этого языка показывается английская версия, пока перевод не утвердят.',
  outdated: 'Английский текст изменился после утверждения перевода. Сверьте перевод с новым исходным текстом и утвердите заново.',
  approved: 'Перевод утверждён для текущей версии английского текста.',
};

/** Who reviews (approves / returns to work): the same permission the API checks. */
export const REVIEW_PERMISSION: Permission = 'content.publish';

/** Permission to change a translation field: SEO texts need seo.edit, other texts content.edit (as the API). */
export const translationFieldPermission = (name: string): Permission => ((SEO_FIELDS as readonly string[]).includes(name) ? 'seo.edit' : 'content.edit');

export const translationPath = (type: TranslatableType, id: string, locale: TranslatedLocale) => `/translations/${type}/${id}/${locale}`;
export const contentPath = (type: TranslatableType, id: string) => `/content/${type}/${id}`;

// ---------------------------------------------------------------------------
// Field labels
// ---------------------------------------------------------------------------

const PAGE_FIELD_LABELS: Record<string, string> = {
  'header.badgeLabel': 'Шапка · метка раздела',
  'header.title': 'Шапка · заголовок (H1)',
  'header.subtitle': 'Шапка · подзаголовок',
  'header.description': 'Шапка · описание',
  'header.meta': 'Шапка · факты',
  'header.actionLabel': 'Шапка · текст кнопки',
  body: 'Текст документа',
  seoMetaTitle: 'SEO-заголовок (title)',
  seoMetaDescription: 'Мета-описание (description)',
};

/** Russian label of a translation field (the same labels as the content editors). */
export function fieldLabel(type: TranslatableType, name: string): string {
  if (type !== 'pages') return COLLECTION_UI[type].fields.find((f) => f.name === name)?.label ?? name;
  if (PAGE_FIELD_LABELS[name]) return PAGE_FIELD_LABELS[name];
  if (name.startsWith('copy.')) return slotLabel(name.slice(5));
  if (name.startsWith('lists.')) return LIST_NAMES[name.slice(6)] ?? slotLabel(name.slice(6));
  return name;
}

export const itemFieldLabel = (field: string) => LIST_FIELD_NAMES[field] ?? slotLabel(field);

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export type FieldKind = 'text' | 'list' | 'pairs' | 'titleDesc' | 'patentInfo' | 'records';
export type Value =
  | string
  | string[]
  | Array<{ label: string; value: string }>
  | Array<{ title: string; description: string }>
  | { patentNumber: string; location: string; keyPoints: string[] }
  | Array<Record<string, string>>;

export interface TranslationFieldView {
  name: string;
  kind: FieldKind;
  group: 'content' | 'seo';
  multiline: boolean;
  max: number;
  placeholders: string[];
  source: Value;
  target: Value | null;
}

export type TranslationForm = Record<string, Value>;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Empty value with the structure of the source (when a translation row has no value). */
export function emptyLike(kind: FieldKind, source: Value): Value {
  switch (kind) {
    case 'text':
      return '';
    case 'list':
      return (source as string[]).map(() => '');
    case 'pairs':
      return (source as Array<{ label: string; value: string }>).map(() => ({ label: '', value: '' }));
    case 'titleDesc':
      return (source as Array<{ title: string; description: string }>).map(() => ({ title: '', description: '' }));
    case 'patentInfo':
      return { patentNumber: '', location: '', keyPoints: (source as { keyPoints: string[] }).keyPoints.map(() => '') };
    case 'records':
      return (source as Array<Record<string, string>>).map((r) => Object.fromEntries(Object.keys(r).map((k) => [k, ''])));
  }
}

export function toTranslationForm(fields: readonly TranslationFieldView[]): TranslationForm {
  return Object.fromEntries(fields.map((f) => [f.name, clone(f.target ?? emptyLike(f.kind, f.source))]));
}

/** Names of the fields whose value differs from the loaded one, in field order. */
export function changedTranslationFields(initial: TranslationForm, values: TranslationForm): string[] {
  return Object.keys(values).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(initial[k]));
}

/** Every text of a value, in order. */
export function textsOf(kind: FieldKind, value: Value): string[] {
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

const placeholderSet = (texts: string[]) => [...new Set(texts.flatMap(placeholdersOf))].sort().join();

/**
 * Client-side check of one field (the API checks again): every text filled in, within the limit,
 * and the `{placeholders}` of the source kept. Returns an API error code or null.
 */
export function validateTranslationField(field: TranslationFieldView, value: Value): 'required' | 'too_long' | 'placeholders' | null {
  const texts = textsOf(field.kind, value);
  if (texts.some((t) => !t.trim())) return 'required';
  if (field.kind === 'text' && (value as string).trim().length > field.max) return 'too_long';
  if (placeholderSet(texts) !== placeholderSet(textsOf(field.kind, field.source))) return 'placeholders';
  return null;
}

export const TRANSLATION_ERROR_LABELS: Record<string, string> = {
  required: 'Заполните все тексты поля.',
  too_long: 'Текст длиннее допустимого.',
  placeholders: 'Сохраните подстановки в фигурных скобках, как в английском тексте, например {title}: их заполняет сайт.',
  structure_is_fixed: 'Количество элементов задано исходным текстом.',
  not_translatable: 'Это поле не переводится.',
  not_allowed: 'У вашей роли нет права менять это поле.',
  invalid: 'Проверьте значение.',
};

/** Same text as the source in every part (hint for reviewers: maybe not translated yet). */
export const sameAsSource = (field: TranslationFieldView, value: Value) => JSON.stringify(textsOf(field.kind, value)) === JSON.stringify(textsOf(field.kind, field.source));

/** Set one text part of a value (immutably). */
export function setPart(kind: FieldKind, value: Value, path: string, text: string): Value {
  if (kind === 'text') return text;
  const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown> | unknown[];
  const keys = path.split('.');
  let node: Record<string, unknown> | unknown[] = copy;
  for (const [i, k] of keys.entries()) {
    const key = /^\d+$/.test(k) ? Number(k) : k;
    if (i === keys.length - 1) (node as Record<string | number, unknown>)[key] = text;
    else node = (node as Record<string | number, unknown>)[key] as Record<string, unknown>;
  }
  return copy as Value;
}

/** Completion bar tone. */
export const completionTone = (pct: number) => (pct >= 100 ? 'ok' : pct >= 80 ? 'warn' : 'danger');
