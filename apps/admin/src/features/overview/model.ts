/**
 * «Обзор» and ⌘K search (Phase L, docs/admin-ui.md): every number of the dashboard is a link to the
 * list it counts, with that list's filter in the address; search results open the record. Pure
 * functions, unit-tested in node.
 */
import type { LeadStatus, TranslatedLocale } from '@soltex/core/domain';
import type { Dashboard, SearchResults } from '../../lib/api/schema.gen';
import { plural } from '../../lib/format';
import { LEAD_STATUS_LABELS } from '../leads/model';
import { LOCALE_INFO, TYPE_LABELS, type TranslatableType } from '../translations/model';

export type SearchHit = SearchResults['items'][number];

/** One line of a dashboard card: what is counted, how many, where the list is. */
export interface Metric {
  id: string;
  label: string;
  value: number;
  to: string;
  /** Needs someone's attention when not zero. */
  attention?: boolean;
}

const q = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;

export function leadMetrics(d: NonNullable<Dashboard['leads']>): Metric[] {
  const by = d.byStatus as Partial<Record<LeadStatus, number>>;
  const list: Metric[] = [
    { id: 'leads-new', label: 'Новые', value: by.new ?? 0, to: `/leads${q({ status: 'new' })}`, attention: true },
    { id: 'leads-progress', label: LEAD_STATUS_LABELS.in_progress, value: by.in_progress ?? 0, to: `/leads${q({ status: 'in_progress' })}` },
  ];
  if (d.notifyFailed) list.push({ id: 'leads-notify', label: 'Уведомление не отправлено', value: d.notifyFailed, to: '/leads', attention: true });
  return list;
}

export function seoMetrics(d: NonNullable<Dashboard['seo']>): Metric[] {
  return [
    { id: 'seo-blocking', label: 'Ошибки (блокируют публикацию)', value: d.blocking, to: `/seo${q({ severity: 'blocking' })}`, attention: true },
    { id: 'seo-warning', label: 'Предупреждения', value: d.warning, to: `/seo${q({ severity: 'warning' })}` },
  ];
}

/** Per language: missing and outdated translations, each linking to the filtered list. */
export function translationMetrics(d: NonNullable<Dashboard['translations']>): Array<{ locale: TranslatedLocale; name: string; completion: number; metrics: Metric[] }> {
  return d.locales.map((l) => ({
    locale: l.locale,
    name: LOCALE_INFO[l.locale].name,
    completion: l.completion,
    metrics: [
      { id: `tr-${l.locale}-missing`, label: 'Нет перевода', value: l.missing, to: `/translations/all${q({ locale: l.locale, state: 'missing' })}` },
      { id: `tr-${l.locale}-outdated`, label: 'Устарели', value: l.outdated, to: `/translations/all${q({ locale: l.locale, state: 'outdated' })}`, attention: true },
    ],
  }));
}

export function contentMetrics(d: NonNullable<Dashboard['content']>): Metric[] {
  return [
    { id: 'content-pending', label: 'Не опубликованы изменения', value: d.pending, to: '/publishing', attention: true },
    ...d.drafts.map((x) => ({ id: `drafts-${x.type}`, label: `Черновики: ${TYPE_LABELS[x.type as TranslatableType].toLowerCase()}`, value: x.count, to: `${contentListPath(x.type as TranslatableType)}${q({ status: 'draft' })}` })),
  ];
}

export function mediaMetrics(d: NonNullable<Dashboard['media']>): Metric[] {
  const list: Metric[] = [{ id: 'media-attention', label: 'Требуют внимания', value: d.attention, to: `/media${q({ attention: 'true' })}`, attention: true }];
  if (d.pendingCopies) list.push({ id: 'media-copies', label: 'Уменьшенные копии готовятся', value: d.pendingCopies, to: '/media' });
  return list;
}

export const contentListPath = (type: TranslatableType) => `/content/${type}`;

/** Where a search result opens. */
export function hitPath(h: SearchHit): string {
  if (h.kind === 'content') return `/content/${h.type}/${h.id}`;
  if (h.kind === 'media') return `/media/${h.id}`;
  return `/leads/${h.id}`;
}

const CONTENT_STATUS = { draft: 'черновик', published: 'опубликовано', archived: 'в архиве' } as const;

/** Second line of a search result: the type and state, and the translation that matched. */
export function hitHint(h: SearchHit): string {
  if (h.kind === 'content') return [TYPE_LABELS[h.type as TranslatableType], CONTENT_STATUS[h.status], h.match].filter(Boolean).join(' · ');
  if (h.kind === 'media') return h.mediaKind === 'video' ? 'Видео в медиатеке' : 'Изображение в медиатеке';
  return `Заявка · ${LEAD_STATUS_LABELS[h.status as LeadStatus].toLowerCase()}`;
}

export const HIT_GROUPS = { content: 'Материалы', media: 'Медиатека', lead: 'Заявки' } as const;

/** "2,4 ГБ" — binary units, one decimal under 10. */
export function formatBytes(n: number): string {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const text = i === 0 || v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace('.', ',');
  return `${text} ${units[i]}`;
}

/** "26 с", "3 мин 5 с". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds} с`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}

/** Free space below this share is shown as a warning. */
export const DISK_LOW_SHARE = 0.1;
export const diskLow = (d: { totalBytes: number; freeBytes: number }) => d.totalBytes > 0 && d.freeBytes / d.totalBytes < DISK_LOW_SHARE;

export const count = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;
