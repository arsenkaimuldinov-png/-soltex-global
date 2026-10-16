/**
 * Publishing in the admin (Phase G, docs/admin-publishing.md): Russian labels, the wording of
 * validation results and revision changes. Pure functions (unit-tested in node). The API decides
 * everything; this file only presents it.
 */
import type { Permission, ReleaseStatus, RevisionKind } from '@soltex/core/domain';
import { COLLECTION_UI } from '../content/model';
import { LIST_NAMES, PAGE_NAMES, slotLabel } from '../content/page-labels';
import { LOCALE_INFO, TYPE_LABELS, type TranslatableType } from '../translations/model';

export { TYPE_LABELS };

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  queued: 'В очереди',
  building: 'Сборка',
  validating: 'Проверка',
  ready: 'Готов к публикации',
  active: 'На сайте',
  retired: 'Был на сайте',
  failed: 'Ошибка',
  superseded: 'Заменён',
};
export const RELEASE_STATUS_TONES = {
  queued: 'neutral',
  building: 'info',
  validating: 'info',
  ready: 'warn',
  active: 'ok',
  retired: 'neutral',
  failed: 'danger',
  superseded: 'neutral',
} as const;
export const IN_PROGRESS: readonly ReleaseStatus[] = ['queued', 'building', 'validating'];

/** Steps of a build as shown in the progress line. */
export const BUILD_STEPS: Array<{ status: ReleaseStatus; label: string }> = [
  { status: 'queued', label: 'Снимок содержимого' },
  { status: 'building', label: 'Сборка сайта' },
  { status: 'validating', label: 'Проверка' },
  { status: 'ready', label: 'Готов' },
];

export function stepIndex(status: ReleaseStatus): number {
  const i = BUILD_STEPS.findIndex((s) => s.status === status);
  return i >= 0 ? i : status === 'active' || status === 'retired' ? BUILD_STEPS.length : -1;
}

export const REVISION_KIND_LABELS: Record<RevisionKind, string> = {
  baseline: 'Исходная версия',
  import: 'Импорт',
  create: 'Создано',
  update: 'Изменено',
  archive: 'Перенесено в архив',
  unarchive: 'Возвращено из архива',
  publish: 'Отмечено к публикации',
  unpublish: 'Снято с публикации',
  translation: 'Изменён перевод',
  approve: 'Перевод утверждён',
  reopen: 'Перевод возвращён в работу',
  restore: 'Восстановлено',
};

export const RELEASE_EVENT_LABELS: Record<string, string> = {
  created: 'Создан',
  build_started: 'Сборка начата',
  build_finished: 'Сборка завершена, проверка',
  build_succeeded: 'Проверка пройдена',
  build_failed: 'Сборка не удалась',
  worker_lost: 'Сборка прервалась',
  activated: 'Опубликован',
  replaced: 'Заменён новым релизом',
  rollback: 'Возвращён на сайт (откат)',
  rolled_back_from: 'Снят с сайта при откате',
  superseded: 'Заменён более новым',
  retried: 'Запущена повторная сборка',
  activation_failed: 'Публикация не удалась, сайт не изменился',
  reconciled: 'Сверен с сервером',
};

/** Permissions of the publishing actions (the API checks the same ones). */
export const PUBLISHING_PERMISSIONS = {
  history: 'content.read',
  restore: 'content.edit',
  publishRecord: 'content.publish',
  createRelease: 'content.publish',
  activate: 'content.publish',
  rollback: 'system.rollback',
  retry: 'system.deploy',
  technical: 'system.read',
} as const satisfies Record<string, Permission>;
export const PREVIEW_PERMISSIONS: readonly Permission[] = ['content.edit', 'seo.edit', 'content.publish'];

// ---------------------------------------------------------------------------
// Validation results in words
// ---------------------------------------------------------------------------

const locale = (code: string) => LOCALE_INFO[code as keyof typeof LOCALE_INFO]?.short ?? code.toUpperCase();

export function describeValidation(code: string): string {
  const [kind, ...rest] = code.split(':');
  const arg = rest.join(':');
  switch (kind) {
    case 'translation_outdated': {
      const [l, n] = arg.split(':');
      return `${locale(l!)}: переводов устарело — ${n}. На сайте останется ранее утверждённый текст.`;
    }
    case 'translation_fallback': {
      const [l, n] = arg.split(':');
      return `${locale(l!)}: материалов без утверждённого перевода — ${n}. Для них сайт покажет английский текст.`;
    }
    case 'missing_file':
      return `В сборке нет обязательного файла ${arg}.`;
    case 'missing_page':
      return `В сборке нет страницы ${arg} опубликованного материала.`;
    case 'secret_like':
      return `В файле ${arg} найдено то, что похоже на секрет или адрес сервера. Публикация запрещена.`;
    case 'no_pages':
      return 'В сборке нет ни одной страницы.';
    case 'page_count': {
      const [a, b] = arg.split('→');
      return `Число страниц изменилось: было ${a}, стало ${b}.`;
    }
    case 'seo_warnings':
      return `Замечаний SEO: ${arg}. Они не блокируют публикацию; список — «SEO → Проверка SEO».`;
    case 'content':
      return `Сборка: ${arg}`;
    default:
      return code;
  }
}

export const FAILURE_STEP_LABELS: Record<string, string> = {
  content: 'Проверка содержимого',
  build: 'Сборка сайта',
  prerender: 'Генерация страниц',
  site: 'Проверка готового сайта',
  artifact: 'Проверка файлов релиза',
  store: 'Сохранение файлов релиза',
  timeout: 'Время сборки',
  workspace: 'Подготовка сборки',
  worker_lost: 'Процесс сборки',
};

// ---------------------------------------------------------------------------
// Revision values and differences in words
// ---------------------------------------------------------------------------

const STORE_FIELD_LABELS: Record<string, string> = {
  title: 'Название',
  slug: 'Адрес страницы',
  order: 'Порядок',
  status: 'Статус',
  seo: 'SEO',
  'seo.metaTitle': 'SEO-заголовок',
  'seo.metaDescription': 'Мета-описание',
  'seo.ogImage': 'Изображение для соцсетей',
  'seo.noindex': 'Не индексировать',
  image: 'Изображение',
  imagePosition: 'Кадрирование изображения',
  gallery: 'Галерея',
  relatedTechnologyId: 'Технология',
  relatedProjectId: 'Проект',
  relatedProjectIds: 'Проекты с этой технологией',
  translationStatus: 'Статус перевода',
  header: 'Шапка',
  'header.badgeNumber': 'Шапка · номер раздела',
  'header.badgeLabel': 'Шапка · метка раздела',
  'header.title': 'Шапка · заголовок (H1)',
  'header.subtitle': 'Шапка · подзаголовок',
  'header.description': 'Шапка · описание',
  'header.meta': 'Шапка · факты',
  'header.actionLabel': 'Шапка · текст кнопки',
  copy: 'Тексты страницы',
  lists: 'Списки',
  media: 'Изображения',
  body: 'Текст документа',
  key: 'Ключ страницы',
  kind: 'Тип',
  video: 'Видеофайл',
  poster: 'Обложка',
  number: 'Номер',
  patentNo: 'Номер патента',
  legalStatus: 'Правовой статус',
  registryNumber: 'Номер в реестре',
  placements: 'Где показывать',
};

/** Russian label of a revision value path, e.g. "scope.2" → «Объём работ · пункт 3». */
export function pathLabel(type: TranslatableType, path: string): string {
  const parts = path.split('.');
  const top = parts[0]!;
  if (type === 'pages') {
    if (top === 'copy' && parts[1]) return `Тексты · ${slotLabel(parts[1])}`;
    if (top === 'lists' && parts[1]) return `${LIST_NAMES[parts[1]] ?? slotLabel(parts[1])}${parts[2] ? ` · элемент ${Number(parts[2]) + 1}` : ''}${parts[3] ? ` · ${slotLabel(parts.slice(3).join(''))}` : ''}`;
    if (top === 'media' && parts[1]) return `Изображения · ${slotLabel(parts[1])}`;
  }
  const two = parts.slice(0, 2).join('.');
  if (STORE_FIELD_LABELS[two] && parts.length <= 2) return STORE_FIELD_LABELS[two]!;
  const base = (type !== 'pages' ? COLLECTION_UI[type].fields.find((f) => f.name === top)?.label : undefined) ?? STORE_FIELD_LABELS[top] ?? top;
  const rest = parts.slice(1);
  if (!rest.length) return base;
  const index = rest.find((p) => /^\d+$/.test(p));
  const sub = rest.filter((p) => !/^\d+$/.test(p) && p !== 'mediaId');
  return [base, index !== undefined ? `пункт ${Number(index) + 1}` : null, ...sub.map((p) => STORE_FIELD_LABELS[`${top}.${p}`]?.split(' · ').pop() ?? p)].filter(Boolean).join(' · ');
}

export const pageName = (key: string) => PAGE_NAMES[key as keyof typeof PAGE_NAMES] ?? key;

/** Display of a stored leaf value. */
export function showValue(v: string | number | boolean | null): string {
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  return String(v);
}

export const editorPath = (type: TranslatableType, id: string) => `/content/${type}/${id}`;
export const historyPath = (type: TranslatableType, id: string) => `/publishing/revisions/${type}/${id}`;
