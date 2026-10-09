/**
 * Form values of the page editor ↔ API. Pure functions (unit-tested): what changed, what to send,
 * what is invalid. The slot set comes from the page registry; nothing here can add a slot.
 */
import { placeholdersMatch, type PageDef } from '@soltex/core/content';
import type { PageRecord } from '../../lib/api/schema.gen';
import { toApiValue, toFormValue, validateField, type LabelValueItem, type TextItem } from './form';

export interface HeaderForm {
  badgeNumber: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  description: string;
  actionLabel: string;
  meta: LabelValueItem[];
}

export interface PageForm {
  header: HeaderForm | null;
  copy: Record<string, string>;
  lists: Record<string, Array<Record<string, string>>>;
  media: Record<string, string>;
  body: TextItem[] | null;
  seoMetaTitle: string;
  seoMetaDescription: string;
  ogImage: string;
  noindex: boolean;
}

type Fields = PageRecord['fields'];

export function toPageForm(f: Fields): PageForm {
  return {
    header: f.header
      ? {
          badgeNumber: f.header.badgeNumber,
          badgeLabel: f.header.badgeLabel,
          title: f.header.title,
          subtitle: f.header.subtitle ?? '',
          description: f.header.description ?? '',
          actionLabel: f.header.actionLabel ?? '',
          meta: toFormValue('labelValue', f.header.meta) as LabelValueItem[],
        }
      : null,
    copy: { ...f.copy },
    lists: JSON.parse(JSON.stringify(f.lists)) as PageForm['lists'],
    media: { ...f.media },
    body: toFormValue('listNull', f.body) as TextItem[] | null,
    seoMetaTitle: f.seoMetaTitle ?? '',
    seoMetaDescription: f.seoMetaDescription ?? '',
    ogImage: f.ogImage ?? '',
    noindex: f.noindex,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** PATCH body of a page: only changed parts; returns also the changed field names (for permissions). */
export function buildPagePatch(initial: PageForm, current: PageForm): { patch: Record<string, unknown>; changed: string[] } {
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];
  if (initial.header && current.header) {
    const h: Record<string, unknown> = {};
    for (const k of ['badgeNumber', 'badgeLabel', 'title', 'subtitle', 'description', 'actionLabel', 'meta'] as const) {
      if (same(initial.header[k], current.header[k])) continue;
      h[k] = k === 'meta' ? current.header.meta : k === 'subtitle' || k === 'description' || k === 'actionLabel' ? toApiValue('lineNull', current.header[k]) : current.header[k].trim();
      changed.push(`header.${k}`);
    }
    if (Object.keys(h).length) patch.header = h;
  }
  const copy: Record<string, string> = {};
  for (const [slot, text] of Object.entries(current.copy))
    if (text !== initial.copy[slot]) {
      copy[slot] = text;
      changed.push(`copy.${slot}`);
    }
  if (Object.keys(copy).length) patch.copy = copy;
  const lists: Record<string, unknown> = {};
  for (const [k, items] of Object.entries(current.lists))
    if (!same(items, initial.lists[k])) {
      lists[k] = items.map((it) => Object.fromEntries(Object.entries(it).map(([f, v]) => [f, v.trim()])));
      changed.push(`lists.${k}`);
    }
  if (Object.keys(lists).length) patch.lists = lists;
  const media: Record<string, string> = {};
  for (const [slot, id] of Object.entries(current.media))
    if (id !== initial.media[slot]) {
      media[slot] = id;
      changed.push(`media.${slot}`);
    }
  if (Object.keys(media).length) patch.media = media;
  if (!same(initial.body, current.body)) {
    patch.body = current.body;
    changed.push('body');
  }
  for (const k of ['seoMetaTitle', 'seoMetaDescription', 'ogImage'] as const)
    if (initial[k] !== current[k]) {
      patch[k] = toApiValue('lineNull', current[k]);
      changed.push(k);
    }
  if (initial.noindex !== current.noindex) {
    patch.noindex = current.noindex;
    changed.push('noindex');
  }
  return { patch, changed };
}

/** Client-side checks (the API repeats them). Keys: header.title, copy.<slot>, lists.<key>, body. */
export function validatePage(def: PageDef, f: PageForm): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.header) {
    if (!f.header.badgeLabel.trim()) out['header.badgeLabel'] = 'Заполните поле.';
    if (!f.header.title.trim()) out['header.title'] = 'Заполните поле.';
    const meta = validateField({ name: 'meta', label: '', kind: 'labelValue', section: 'content' }, f.header.meta);
    if (meta) out['header.meta'] = meta;
  }
  for (const slot of def.slots) {
    const text = f.copy[slot.key] ?? '';
    if (!text.trim()) out[`copy.${slot.key}`] = 'Заполните поле.';
    else if (!placeholdersMatch(slot, text)) out[`copy.${slot.key}`] = `Сохраните подстановки ${slot.placeholders.map((p) => `{${p}}`).join(', ') || '(их не должно быть)'}: их заполняет сайт.`;
  }
  for (const [k, items] of Object.entries(f.lists)) if (items.some((it) => Object.values(it).some((v) => !v.trim()))) out[`lists.${k}`] = 'Заполните все тексты элементов.';
  const body = validateField({ name: 'body', label: '', kind: 'listNull', section: 'content' }, f.body);
  if (body) out.body = body;
  return out;
}
