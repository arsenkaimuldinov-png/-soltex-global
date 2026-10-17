/**
 * Media library in the admin (Phase J-1, docs/admin-media.md): Russian wording, sizes, usages and
 * the early check before an upload starts. Pure functions (unit-tested in node). The API decides
 * for real (type from the bytes, limits, duplicates).
 */
import { MEDIA_MAX_BYTES, MEDIA_TYPES, type MediaKind } from '@soltex/core/domain';
import { pageName } from '../publishing/model';
import { TYPE_LABELS } from '../translations/model';

export const MEDIA_LIST_KEY = ['media', 'list'] as const;
export const mediaDetailKey = (id: string) => ['media', 'detail', id] as const;

/** Preview of an image served by the API (same origin; cached per version). */
export const previewSrc = (m: { id: string; version: number }, width: 480 | 1200 = 480) => `/api/v1/media/${m.id}/preview?w=${width}&v=${m.version}`;

/** `accept` of the file input: what the API allows (the API still checks the bytes). */
export const ACCEPT = MEDIA_TYPES.map((t) => `${t.mime},.${t.ext}`).join(',') + ',.jpeg';
export const ACCEPT_LABEL = MEDIA_TYPES.map((t) => t.label).join(', ');

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0).replace('.', ',')} КБ`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

const EXT_KIND: Record<string, MediaKind> = Object.fromEntries([...MEDIA_TYPES.map((t) => [t.ext, t.kind]), ['jpeg', 'image']]);

/** Problem with a file before it is sent (by name and size only), or null. */
export function precheckFile(file: { name: string; size: number }): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'svg') return 'SVG не загружается: такие файлы могут содержать скрипты. Сохраните изображение в PNG или WebP.';
  const kind = EXT_KIND[ext];
  if (!kind) return `Этот тип файла не поддерживается. Можно: ${ACCEPT_LABEL}.`;
  if (file.size === 0) return 'Файл пустой.';
  if (file.size > MEDIA_MAX_BYTES[kind]) return `Файл больше ${MEDIA_MAX_BYTES[kind] / 1024 / 1024} МБ.`;
  return null;
}

export const MEDIA_ERRORS: Record<string, string> = {
  media_type_rejected: `Этот тип файла не поддерживается. Можно: ${ACCEPT_LABEL}.`,
  media_invalid: 'Файл повреждён или не открывается как изображение.',
  media_duplicate: 'Такой файл уже есть в медиатеке.',
  payload_too_large: 'Файл слишком большой: изображения до 20 МБ, видео до 200 МБ.',
  kind_mismatch: 'Замена должна быть того же вида: изображение — изображением, видео — видео.',
  unchanged: 'Это тот же самый файл.',
};

export const WARNING_LABELS: Record<string, string> = {
  large_file: 'Больше 2 МБ — страница будет грузиться медленнее',
  hero_too_narrow: 'Уже 1600 px для первого экрана — на больших экранах будет нечётким',
};

export const KIND_LABELS: Record<MediaKind, string> = { image: 'Изображение', video: 'Видео' };
export const SOURCE_LABELS: Record<string, string> = { legacy: 'Перенесён с сайта', upload: 'Загружен в медиатеку' };

const FIELD_LABELS: Record<string, string> = {
  image: 'основное изображение',
  gallery: 'галерея',
  ogImage: 'изображение для соцсетей',
  poster: 'обложка',
  video: 'файл видео',
  logo: 'логотип',
  logoReversed: 'логотип на тёмном фоне',
  heroImage: 'первый экран',
  footerBackground: 'фон подвала',
};

export interface UsageView {
  type: string;
  id: string | null;
  key: string;
  title: string;
  status: string | null;
  field: string;
}

/** «Проект «SOLBAR ISRAEL» · основное изображение», and the editor link (null for settings). */
export function describeUsage(u: UsageView): { section: string; title: string; field: string; to: string | null } {
  const section = u.type === 'settings' ? 'Настройки' : u.type === 'pages' ? 'Страница' : (TYPE_LABELS as Record<string, string>)[u.type] ?? u.type;
  const title = u.type === 'pages' ? pageName(u.key.replace(/^page-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())) : u.title;
  const field = FIELD_LABELS[u.field] ?? (u.field.endsWith('Image') ? 'изображение блока' : 'список');
  return { section, title, field, to: u.id ? `/content/${u.type}/${u.id}` : null };
}

/** State of the responsive copies (Phase J-2) in words. */
export function variantsLabel(v: { state: 'ready' | 'pending' | 'none' | 'missing'; widths: number[] }): string {
  if (v.state === 'ready') return `готовы: ${v.widths.join(', ')} px (WebP)`;
  if (v.state === 'missing') return 'не сделаны: исходный файл не найден на сервере';
  if (v.state === 'pending') return 'готовятся — появятся на сайте со следующим релизом';
  return 'не нужны — изображение уже небольшое';
}
