/**
 * SEO in the admin (Phase I-1, docs/admin-seo.md): Russian wording of the checker's issues,
 * severities and the search-result snippet. Pure functions (unit-tested in node). The checks run in
 * @soltex/core/seo on the server; the admin only presents them.
 */
import { CONTENT_LOCALES, type Locale } from '@soltex/core/domain';
import { DEFAULT_SITE_URL, localizedPath, SEO_DESCRIPTION_RECOMMENDED_MAX, SEO_TITLE_RECOMMENDED_MAX, type SeoIssueCode, type SeoSeverity } from '@soltex/core/seo';

export interface SeoIssueView {
  code: SeoIssueCode | string;
  severity: SeoSeverity;
  type: string;
  key: string;
  locale: Locale | null;
  field: string | null;
  params: Record<string, string | number>;
}

export const SEVERITY_LABELS: Record<SeoSeverity, string> = { blocking: 'Ошибка', warning: 'Предупреждение', info: 'Подсказка' };
export const SEVERITY_PLURAL: Record<SeoSeverity, string> = { blocking: 'Ошибки', warning: 'Предупреждения', info: 'Подсказки' };
export const SEVERITY_TONES = { blocking: 'danger', warning: 'warn', info: 'neutral' } as const;
export const SEVERITY_ORDER: Record<SeoSeverity, number> = { blocking: 0, warning: 1, info: 2 };

const SLUG_PROBLEMS: Record<string, string> = {
  empty: 'адрес пустой',
  too_long: 'адрес слишком длинный',
  format: 'допустимы только латинские строчные буквы, цифры и дефисы',
  reserved: 'адрес занят страницей сайта',
};

const PATH_PROBLEMS: Record<string, string> = {
  empty: 'путь пустой',
  not_absolute: 'путь должен начинаться с «/»',
  protocol_relative: 'путь не может начинаться с «//»',
  backslash: 'обратная косая черта недопустима',
  scheme: 'внешние адреса недопустимы',
  control: 'недопустимые символы',
  encoded: 'закодированные служебные символы недопустимы',
  dot_segment: 'сегменты «..» недопустимы',
  too_long: 'путь слишком длинный',
  query: 'параметры после «?» и «#» не учитываются — укажите путь без них',
  trailing_slash: 'уберите «/» в конце',
  locale_prefix: 'для правила на всех языках укажите путь без языкового префикса (/ru, /zh, …)',
  reserved: 'с этого адреса сайт отдаёт файлы или главную страницу — редирект не сработает',
};

const p = (i: SeoIssueView, k: string) => String(i.params[k] ?? '');

/** One sentence in Russian for an issue (no codes in the main UI). */
export function describeSeoIssue(i: SeoIssueView): string {
  switch (i.code) {
    case 'slug_invalid':
      return `Адрес страницы некорректен: ${SLUG_PROBLEMS[p(i, 'problem')] ?? p(i, 'problem')}.`;
    case 'slug_duplicate':
      return `Адрес «${p(i, 'slug')}» уже занят другой записью этого раздела.`;
    case 'relation_broken':
      return 'Связанный материал не опубликован или удалён — на сайте связь будет битой.';
    case 'media_missing':
      return 'Изображение не найдено в медиатеке.';
    case 'link_broken':
      return `Ссылка ведёт на несуществующую страницу: ${p(i, 'href')}.`;
    case 'title_missing':
      return 'Пустой SEO-заголовок.';
    case 'description_missing':
      return 'Пустое мета-описание.';
    case 'title_too_long':
      return `SEO-заголовок длиннее ${p(i, 'max')} символов (${p(i, 'length')}).`;
    case 'title_length':
      return `SEO-заголовок — ${p(i, 'length')} символов, рекомендуется до ${p(i, 'max')}: в поиске он будет обрезан.`;
    case 'description_length':
      return `Мета-описание — ${p(i, 'length')} символов, рекомендуется ${p(i, 'min')}–${p(i, 'max')}.`;
    case 'title_duplicate':
      return `Такой же SEO-заголовок у другой страницы: ${p(i, 'with')}.`;
    case 'description_duplicate':
      return `Такое же мета-описание у другой страницы: ${p(i, 'with')}.`;
    case 'translation_missing':
      return 'Перевод не утверждён — страница показывается на английском и не попадает в поиск на этом языке.';
    case 'translation_outdated':
      return 'Перевод устарел — на сайте остаётся ранее утверждённый текст.';
    case 'og_image_missing':
      return 'Не задано изображение для соцсетей (OG).';
    case 'noindex_in_navigation':
      return 'Страница скрыта от поисковиков (noindex), хотя она есть в главном меню.';
    case 'title_default':
      return 'SEO-заголовок не задан — используется шаблон «Название | Soltex Global».';
    case 'description_default':
      return 'Мета-описание не задано — используется начало описания.';
    case 'redirect_invalid':
      return `Некорректный редирект: ${PATH_PROBLEMS[p(i, 'problem')] ?? p(i, 'problem')}.`;
    case 'redirect_self':
      return 'Редирект ведёт сам на себя.';
    case 'redirect_duplicate':
      return `С адреса ${p(i, 'path')} уже есть другой редирект.`;
    case 'redirect_loop':
      return 'Редиректы зациклены.';
    case 'redirect_shadows_page':
      return `Редирект перекрывает существующую страницу ${p(i, 'path')}.`;
    case 'redirect_target_missing':
      return `Редирект ведёт на несуществующую страницу ${p(i, 'path')}.`;
    case 'redirect_chain':
      return `Цепочка редиректов: лучше вести сразу на ${p(i, 'final')}.`;
    default:
      return i.code;
  }
}

/** Fields the «Перейти к полю» link can focus in the editors. */
export function focusField(field: string | null): boolean {
  if (!field || typeof document === 'undefined') return false;
  const box = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
  if (!box) return false;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  box.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true });
  return true;
}

// ---------------------------------------------------------------------------
// Search-result snippet
// ---------------------------------------------------------------------------

/** Text as a search result shows it: cut at a word boundary with "…" past `max` characters. */
export function truncateForSnippet(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:—–-]+$/, '')}…`;
}

export const snippetTitle = (t: string) => truncateForSnippet(t, SEO_TITLE_RECOMMENDED_MAX);
export const snippetDescription = (d: string) => truncateForSnippet(d, SEO_DESCRIPTION_RECOMMENDED_MAX);

/** "soltexglobal.co › ru › projects › solbar-israel" */
export function snippetUrl(url: string): string {
  try {
    const u = new URL(url);
    return [u.host, ...u.pathname.split('/').filter(Boolean)].join(' › ');
  } catch {
    return url;
  }
}

export function sortIssues<T extends SeoIssueView>(issues: T[]): T[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.locale ?? '').localeCompare(b.locale ?? ''));
}

// ---------------------------------------------------------------------------
// Redirects (Phase I-2)
// ---------------------------------------------------------------------------

export const REDIRECT_SOURCE_LABELS: Record<string, string> = { manual: 'Вручную', slug_change: 'Смена адреса', import: 'Импорт' };

/** Russian message for a field error of the redirects API (path rule, `exists`, `self` or an issue code). */
export function redirectErrorMessage(message: string): string {
  if (message === 'exists') return 'С этого адреса уже есть редирект — измените его в списке.';
  if (message === 'self') return 'Адрес назначения совпадает с исходным.';
  if (PATH_PROBLEMS[message]) {
    const text = PATH_PROBLEMS[message]!;
    return text.charAt(0).toUpperCase() + text.slice(1) + '.';
  }
  const rejected: Record<string, string> = {
    redirect_target_missing: 'Такой страницы нет среди опубликованных (с учётом следующего релиза).',
    redirect_shadows_page: 'По этому адресу открывается страница сайта — редирект её бы закрыл.',
    redirect_duplicate: 'Для этого адреса уже есть редирект на одном из языков.',
    redirect_loop: 'Редиректы зациклились бы.',
    redirect_self: 'Адрес назначения совпадает с исходным.',
    redirect_invalid: 'Некорректный адрес.',
  };
  return rejected[message] ?? 'Проверьте адрес.';
}

/** Old and new addresses of a record in every language, for the address-change dialog. */
export function slugChangeUrls(prefix: string, oldSlug: string, newSlug: string, siteUrl: string = DEFAULT_SITE_URL): Array<{ locale: Locale; from: string; to: string }> {
  return CONTENT_LOCALES.map((locale) => ({ locale, from: siteUrl + localizedPath(prefix + oldSlug, locale), to: siteUrl + localizedPath(prefix + newSlug, locale) }));
}
