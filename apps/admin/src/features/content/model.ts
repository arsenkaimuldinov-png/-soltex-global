/**
 * Editors of the six content collections (docs/admin-content.md §5). One typed description per
 * collection: which fields exist, in which section, with which Russian label, help text and limit.
 * Field names are the API field names (generated types in lib/api/schema.gen.ts); the editor is
 * built from this description, so it can only show fields the content model has.
 *
 * This is configuration of fixed, typed forms, not a page builder: nobody can add a field or a
 * block from the admin.
 */
import type { Permission } from '@soltex/core/domain';
import { SEO_FIELDS } from '@soltex/core/domain';

export type CollectionName = 'projects' | 'technologies' | 'products' | 'epcm-stages' | 'patents' | 'videos';
export const COLLECTIONS: readonly CollectionName[] = ['projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos'];

export type FieldKind =
  | 'line' // required single-line text
  | 'text' // required paragraph
  | 'lineNull' // optional single line (empty = not shown)
  | 'textNull' // optional paragraph
  | 'code' // short structural string (category number, patent number)
  | 'codeNull'
  | 'list' // list of texts
  | 'listNull' // optional list of texts
  | 'labelValue' // list of label + value
  | 'titleDesc' // list of title + description
  | 'titleDescNull'
  | 'patentInfo'
  | 'media'
  | 'mediaNull'
  | 'mediaList'
  | 'ref'
  | 'refList'
  | 'enumNull'
  | 'placements'
  | 'bool'
  | 'slug'
  | 'position';

export type SectionId = 'main' | 'content' | 'home' | 'registry' | 'relations' | 'seo';

export const SECTION_LABELS: Record<SectionId, { title: string; description?: string }> = {
  main: { title: 'Основное' },
  content: { title: 'Содержание' },
  home: { title: 'Карточка на главной', description: 'Поля карточки в блоке «Технологии и интеллектуальная собственность» главной страницы.' },
  registry: { title: 'Запись в реестре патентов', description: 'Поля записи на странице «Патенты».' },
  relations: { title: 'Изображения и связи' },
  seo: { title: 'SEO', description: 'Пустые поля — сайт использует шаблон по умолчанию. Полная проверка SEO появится в разделе SEO.' },
};

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  section: SectionId;
  hint?: string;
  max?: number;
  /** Label of one list item («Пункт», «Характеристика»). */
  itemLabel?: string;
  mediaKind?: 'image' | 'video';
  ref?: 'technologies' | 'projects';
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Shown multi-line even though it is a single text (e.g. headlines with line breaks). */
  multiline?: boolean;
}

export interface CollectionUi {
  name: CollectionName;
  title: string;
  /** Accusative for buttons: «Создать проект». */
  one: string;
  /** Title of the create dialog. */
  newTitle: string;
  routable: boolean;
  /** Public path prefix, for the SEO block (`/projects/` + slug). */
  pathPrefix?: string;
  fields: readonly FieldDef[];
  /** Fields the create dialog asks for (API `requiredOnCreate`). */
  createFields: readonly string[];
}

export const LIMITS = { line: 300, text: 5000, item: 1000 } as const;

const seo = (): FieldDef[] => [
  { name: 'slug', label: 'Адрес страницы (slug)', kind: 'slug', section: 'seo', hint: 'Латинские строчные буквы, цифры и дефисы. Одинаковый для всех языков.' },
  { name: 'seoMetaTitle', label: 'SEO-заголовок (title)', kind: 'lineNull', section: 'seo', max: 200, hint: 'Рекомендуется до 60 символов. Пусто — «Название | Soltex Global».' },
  { name: 'seoMetaDescription', label: 'Мета-описание (description)', kind: 'textNull', section: 'seo', max: 400, hint: 'Рекомендуется 70–160 символов.' },
  { name: 'ogImage', label: 'Изображение для соцсетей (OG)', kind: 'mediaNull', section: 'seo', mediaKind: 'image', hint: 'Пусто — основное изображение.' },
  { name: 'noindex', label: 'Не индексировать (noindex)', kind: 'bool', section: 'seo', hint: 'Страница не попадёт в поисковики и в sitemap.' },
];
const position: FieldDef = { name: 'position', label: 'Порядок в списке', kind: 'position', section: 'main', hint: 'Меньше — выше в списках на сайте.' };

export const COLLECTION_UI: Readonly<Record<CollectionName, CollectionUi>> = {
  projects: {
    name: 'projects',
    newTitle: 'Новый проект',
    title: 'Проекты',
    one: 'проект',
    routable: true,
    pathPrefix: '/projects/',
    createFields: ['title', 'image', 'relatedTechnology'],
    fields: [
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'category', label: 'Категория', kind: 'line', section: 'main', max: LIMITS.line, hint: 'Например, «Pectin Plant».' },
      { name: 'categoryNumber', label: 'Номер категории', kind: 'code', section: 'main', max: 10, hint: 'Номер на карточке, например 01.' },
      { name: 'country', label: 'Страна / регион', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'years', label: 'Годы', kind: 'line', section: 'main', max: 60 },
      { name: 'capacity', label: 'Мощность', kind: 'lineNull', section: 'main', max: LIMITS.line, hint: 'Необязательно.' },
      { name: 'type', label: 'Тип проекта', kind: 'line', section: 'main', max: LIMITS.line },
      position,
      { name: 'overview', label: 'Обзор', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'scope', label: 'Объём работ', kind: 'list', section: 'content', itemLabel: 'Пункт' },
      { name: 'technology', label: 'Применённая технология', kind: 'text', section: 'content', max: LIMITS.text, hint: 'Краткое описание процесса на этом заводе.' },
      { name: 'results', label: 'Результаты', kind: 'listNull', section: 'content', itemLabel: 'Результат' },
      { name: 'specs', label: 'Характеристики', kind: 'labelValue', section: 'content', itemLabel: 'Характеристика' },
      { name: 'image', label: 'Основное изображение', kind: 'media', section: 'relations', mediaKind: 'image' },
      { name: 'imagePosition', label: 'Кадрирование основного изображения', kind: 'codeNull', section: 'relations', max: 40, hint: 'Какая часть фото видна в карточке, например «center top». Пусто — по центру.' },
      { name: 'gallery', label: 'Галерея', kind: 'mediaList', section: 'relations', mediaKind: 'image' },
      { name: 'relatedTechnology', label: 'Технология', kind: 'ref', section: 'relations', ref: 'technologies' },
      ...seo(),
    ],
  },
  technologies: {
    name: 'technologies',
    newTitle: 'Новая технология',
    title: 'Технологии',
    one: 'технологию',
    routable: true,
    pathPrefix: '/technologies/',
    createFields: ['title', 'image'],
    fields: [
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'categoryTitle', label: 'Название категории', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'categoryNumber', label: 'Номер категории', kind: 'code', section: 'main', max: 10, hint: 'Например, 01.' },
      { name: 'subtitle', label: 'Подзаголовок', kind: 'line', section: 'main', max: LIMITS.line },
      position,
      { name: 'overview', label: 'Обзор', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'rawMaterials', label: 'Сырьё', kind: 'list', section: 'content', itemLabel: 'Сырьё' },
      { name: 'processPrinciples', label: 'Принципы процесса', kind: 'titleDesc', section: 'content', itemLabel: 'Принцип' },
      { name: 'keyAdvantages', label: 'Ключевые преимущества', kind: 'list', section: 'content', itemLabel: 'Преимущество' },
      { name: 'applications', label: 'Применение', kind: 'list', section: 'content', itemLabel: 'Применение' },
      { name: 'productsProduced', label: 'Получаемые продукты', kind: 'list', section: 'content', itemLabel: 'Продукт' },
      { name: 'patentInfo', label: 'Патент', kind: 'patentInfo', section: 'content', hint: 'Блок о патенте на странице технологии. Необязательно.' },
      { name: 'image', label: 'Основное изображение', kind: 'media', section: 'relations', mediaKind: 'image' },
      { name: 'relatedProjects', label: 'Проекты с этой технологией', kind: 'refList', section: 'relations', ref: 'projects' },
      ...seo(),
    ],
  },
  products: {
    name: 'products',
    newTitle: 'Новый продукт',
    title: 'Продукты',
    one: 'продукт',
    routable: true,
    pathPrefix: '/products/',
    createFields: ['title', 'image', 'relatedTechnology', 'relatedProject'],
    fields: [
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'categoryTitle', label: 'Название категории', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'categoryNumber', label: 'Номер категории', kind: 'code', section: 'main', max: 10 },
      position,
      { name: 'description', label: 'Описание', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'rawMaterials', label: 'Сырьё', kind: 'list', section: 'content', itemLabel: 'Сырьё' },
      { name: 'productionTechnology', label: 'Технология производства', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'applications', label: 'Применение', kind: 'list', section: 'content', itemLabel: 'Применение' },
      { name: 'characteristics', label: 'Характеристики', kind: 'list', section: 'content', itemLabel: 'Характеристика' },
      { name: 'image', label: 'Основное изображение', kind: 'media', section: 'relations', mediaKind: 'image' },
      { name: 'relatedTechnology', label: 'Технология', kind: 'ref', section: 'relations', ref: 'technologies' },
      { name: 'relatedProject', label: 'Проект', kind: 'ref', section: 'relations', ref: 'projects' },
      ...seo(),
    ],
  },
  'epcm-stages': {
    name: 'epcm-stages',
    newTitle: 'Новый этап EPC / EPCM',
    title: 'EPC / EPCM',
    one: 'этап',
    routable: false,
    createFields: ['title'],
    fields: [
      { name: 'number', label: 'Номер этапа', kind: 'code', section: 'main', max: 10, hint: 'Например, 01.' },
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'focus', label: 'Фокус этапа', kind: 'line', section: 'main', max: LIMITS.line },
      position,
      { name: 'description', label: 'Описание', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'deliverables', label: 'Результаты этапа', kind: 'list', section: 'content', itemLabel: 'Результат' },
      { name: 'image', label: 'Изображение', kind: 'mediaNull', section: 'relations', mediaKind: 'image' },
    ],
  },
  patents: {
    name: 'patents',
    newTitle: 'Новый патент',
    title: 'Патенты',
    one: 'патент',
    routable: false,
    createFields: ['title', 'placements'],
    fields: [
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'patentNo', label: 'Номер патента или заявки', kind: 'code', section: 'main', max: 60 },
      {
        name: 'placements',
        label: 'Где показывать',
        kind: 'placements',
        section: 'main',
        options: [
          { value: 'home', label: 'Карточка на главной' },
          { value: 'registry', label: 'Реестр патентов' },
        ],
      },
      {
        name: 'legalStatus',
        label: 'Правовой статус',
        kind: 'enumNull',
        section: 'main',
        options: [
          { value: 'granted', label: 'Патент выдан' },
          { value: 'application', label: 'Заявка' },
        ],
      },
      { name: 'registryNumber', label: 'Номер в реестре', kind: 'codeNull', section: 'main', max: 60 },
      position,
      { name: 'statusLabel', label: 'Подпись статуса', kind: 'lineNull', section: 'home', max: LIMITS.line },
      { name: 'patentLabel', label: 'Подпись патента', kind: 'lineNull', section: 'home', max: LIMITS.line },
      { name: 'jurisdiction', label: 'Юрисдикция', kind: 'lineNull', section: 'home', max: LIMITS.line },
      { name: 'abstract', label: 'Аннотация', kind: 'textNull', section: 'home', max: LIMITS.text },
      { name: 'claimsSummary', label: 'Формула изобретения (кратко)', kind: 'listNull', section: 'home', itemLabel: 'Пункт' },
      { name: 'code', label: 'Код', kind: 'lineNull', section: 'registry', max: LIMITS.line },
      { name: 'location', label: 'Место', kind: 'lineNull', section: 'registry', max: LIMITS.line },
      { name: 'overview', label: 'Обзор', kind: 'textNull', section: 'registry', max: LIMITS.text },
      { name: 'keyPillars', label: 'Ключевые положения', kind: 'titleDescNull', section: 'registry', itemLabel: 'Положение' },
      { name: 'industrialImplementation', label: 'Промышленное внедрение', kind: 'textNull', section: 'registry', max: LIMITS.text },
      { name: 'image', label: 'Изображение', kind: 'mediaNull', section: 'registry', mediaKind: 'image' },
      { name: 'imageCaption', label: 'Подпись к изображению', kind: 'lineNull', section: 'registry', max: LIMITS.line },
    ],
  },
  videos: {
    name: 'videos',
    newTitle: 'Новое видео',
    title: 'Видео',
    one: 'видео',
    routable: false,
    createFields: ['title', 'video', 'poster'],
    fields: [
      { name: 'number', label: 'Номер', kind: 'code', section: 'main', max: 10 },
      { name: 'title', label: 'Название', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'category', label: 'Категория', kind: 'line', section: 'main', max: LIMITS.line },
      { name: 'headline', label: 'Заголовок на экране', kind: 'line', section: 'main', max: LIMITS.line, multiline: true, hint: 'Перенос строки (Enter) переносится и на сайте.' },
      position,
      { name: 'description', label: 'Описание', kind: 'text', section: 'content', max: LIMITS.text },
      { name: 'video', label: 'Видеофайл', kind: 'media', section: 'relations', mediaKind: 'video' },
      { name: 'poster', label: 'Обложка', kind: 'media', section: 'relations', mediaKind: 'image' },
    ],
  },
};

/** Who may change a field: SEO fields need seo.edit, every other field content.edit (same rule as the API). */
export function fieldPermission(name: string): Permission {
  return (SEO_FIELDS as readonly string[]).includes(name) ? 'seo.edit' : 'content.edit';
}

export const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликовано', archived: 'В архиве' } as const;
export const STATUS_TONES = { draft: 'warn', published: 'ok', archived: 'neutral' } as const;

export const TR_STATE_LABELS = { missing: 'Нет перевода', in_progress: 'Перевод в работе', approved: 'Переведено' } as const;
export const LOCALE_LABELS = { en: 'EN', ru: 'RU', zh: 'ZH', tr: 'TR', ar: 'AR', es: 'ES' } as const;

/** Messages of field-level API errors (problem `errors[].message`). */
export const FIELD_ERROR_LABELS: Record<string, string> = {
  required: 'Заполните поле.',
  not_allowed: 'У вашей роли нет права менять это поле.',
  taken: 'Такой адрес уже занят другой записью.',
  format: 'Только латинские строчные буквы, цифры и одиночные дефисы.',
  reserved: 'Этот адрес занят разделом сайта.',
  too_long: 'Слишком длинный адрес.',
  empty: 'Укажите адрес.',
  locked_published: 'Адрес опубликованной записи меняется вместе с перенаправлением — это появится в разделе SEO.',
  unknown_media: 'Файл не найден.',
  not_an_image: 'Нужно изображение.',
  not_a_video: 'Нужен видеофайл.',
  unknown_reference: 'Запись не найдена.',
  archived_reference: 'Запись в архиве — выберите другую.',
  duplicate: 'Элемент выбран дважды.',
  invalid: 'Проверьте значение.',
  invalid_list_origin: 'Список изменился. Обновите страницу.',
  placeholders: 'Сохраните подстановки в фигурных скобках, например {title}: их заполняет сайт.',
  not_on_this_page: 'Этого поля нет на странице.',
  structure_is_fixed: 'Количество элементов задано страницей.',
};
