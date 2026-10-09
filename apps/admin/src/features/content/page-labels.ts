/**
 * Russian names of the fixed pages and of their text slots. The slot set itself is code-owned
 * (@soltex/core/content PAGE_REGISTRY); here only the presentation: a slot key such as
 * `heroHeadlineLine1` becomes «Первый экран · заголовок · строка 1».
 */
import type { PageKey } from '@soltex/core/content';

export const PAGE_NAMES: Record<PageKey, string> = {
  home: 'Главная',
  company: 'О компании',
  globalPresence: 'Глобальное присутствие',
  technologies: 'Технологии',
  patents: 'Патенты',
  epcm: 'EPC / EPCM',
  products: 'Продукты',
  projects: 'Проекты',
  contact: 'Контакты',
  privacy: 'Политика конфиденциальности',
  terms: 'Условия использования',
  projectDetail: 'Шаблон страницы проекта',
  technologyDetail: 'Шаблон страницы технологии',
  productDetail: 'Шаблон страницы продукта',
};

export const PAGE_PATHS: Partial<Record<PageKey, string>> = {
  home: '/',
  company: '/company',
  globalPresence: '/company/global-presence',
  technologies: '/technologies',
  patents: '/technologies/patents',
  epcm: '/epcm',
  products: '/products',
  projects: '/projects',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
};

/** Words of slot keys (camelCase parts) in Russian. Unknown words are shown as they are. */
const WORDS: Record<string, string> = {
  all: 'все',
  advantages: 'преимущества',
  action: 'действие',
  alt: 'описание изображения (alt)',
  applications: 'применение',
  archive: 'архив',
  assurance: 'гарантия',
  badge: 'метка',
  band: 'полоса',
  capabilities: 'возможности',
  capacity: 'мощность',
  caption: 'подпись',
  certification: 'сертификация',
  characteristics: 'характеристики',
  compliance: 'соответствие',
  context: 'контекст',
  contract: 'контракт',
  corridors: 'направления',
  cta: 'призыв к действию',
  description: 'описание',
  efficiency: 'эффективность',
  epcm: 'EPCM',
  eyebrow: 'надзаголовок',
  facilities: 'объекты',
  fallback: 'текст по умолчанию',
  feedstock: 'сырьё',
  gallery: 'галерея',
  guarantee: 'гарантия',
  header: 'шапка',
  heading: 'заголовок',
  headline: 'заголовок',
  headquarters: 'штаб-квартира',
  hero: 'первый экран',
  hygienic: 'гигиена',
  image: 'изображение',
  inquiry: 'заявка',
  intro: 'вступление',
  ip: 'интеллектуальная собственность',
  item: 'пункт',
  label: 'подпись',
  life: 'хранения',
  line: 'строка',
  link: 'ссылка',
  list: 'список',
  mandate: 'миссия',
  note: 'примечание',
  offices: 'офисы',
  packaging: 'упаковка',
  paragraph: 'абзац',
  patent: 'патент',
  philosophy: 'подход',
  principles: 'принципы',
  projects: 'проекты',
  provenance: 'происхождение',
  purity: 'чистота',
  recovery: 'выход продукта',
  region: 'регион',
  registry: 'реестр',
  regulatory: 'регуляторика',
  results: 'результаты',
  scope: 'объём работ',
  secondary: 'второстепенный',
  shelf: 'срок',
  site: 'площадка',
  sites: 'площадки',
  stat: 'показатель',
  status: 'статус',
  subtitle: 'подзаголовок',
  tag: 'тег',
  technologies: 'технологии',
  technology: 'технология',
  text: 'текст',
  timeline: 'история',
  title: 'заголовок',
  topic: 'тема',
  usp: 'уникальное предложение',
  value: 'значение',
  videos: 'видео',
  workflow: 'процесс',
};

/** «Первый экран · заголовок · строка 1» from `heroHeadlineLine1`. */
export function slotLabel(key: string): string {
  const parts = key
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .split(' ')
    .map((p) => p.toLowerCase());
  const words: string[] = [];
  for (const p of parts) {
    if (/^\d+$/.test(p) && words.length) words[words.length - 1] += ` ${p}`;
    else words.push(WORDS[p] ?? p);
  }
  const text = words.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Section of a slot (its first word), for grouping long slot lists. */
export const slotGroup = (key: string) => key.replace(/([a-z])([A-Z0-9]).*$/, '$1');

export const LIST_NAMES: Record<string, string> = {
  heroTags: 'Теги первого экрана',
  keyDirections: 'Ключевые направления',
  capabilities: 'Возможности',
  timeline: 'История компании',
};

export const LIST_FIELD_NAMES: Record<string, string> = {
  label: 'Подпись',
  title: 'Заголовок',
  subtitle: 'Подзаголовок',
  description: 'Описание',
  year: 'Год',
};
