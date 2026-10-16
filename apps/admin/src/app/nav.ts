/**
 * Navigation model (review §X sidebar). One list drives the sidebar, the ⌘K palette and the route
 * guards, so a screen is never visible in one place and hidden in another.
 *
 * Only screens that exist are listed. The sections of later phases (Медиатека, Заявки,
 * Настройки) are added here together with their screens; there are no placeholders.
 * Visibility is a presentation of the user's permissions (from GET /auth/session); the API
 * enforces every permission on its own.
 */
import type { Permission } from '@soltex/core/domain';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Award, FileText, FlaskConical, FolderKanban, History, Languages, SearchCheck, LayoutDashboard, ListChecks, Package, Rocket, ScrollText, Send, ShieldCheck, Users, Video, Workflow } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Required permission; omitted = every signed-in user. */
  permission?: Permission;
  /** Name outside the sidebar section (⌘K, overview), when the short label needs its section. */
  title?: string;
  /** Extra words for ⌘K search. */
  keywords?: string[];
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    id: 'main',
    items: [{ id: 'overview', label: 'Обзор', to: '/', icon: LayoutDashboard, keywords: ['главная', 'дашборд'] }],
  },
  {
    id: 'content',
    label: 'Контент',
    items: [
      { id: 'pages', label: 'Страницы', to: '/content/pages', icon: FileText, permission: 'content.read', keywords: ['главная', 'о компании', 'контакты', 'тексты'] },
      { id: 'projects', label: 'Проекты', to: '/content/projects', icon: FolderKanban, permission: 'content.read', keywords: ['заводы', 'кейсы'] },
      { id: 'technologies', label: 'Технологии', to: '/content/technologies', icon: FlaskConical, permission: 'content.read', keywords: ['процессы'] },
      { id: 'products', label: 'Продукты', to: '/content/products', icon: Package, permission: 'content.read', keywords: ['ингредиенты'] },
      { id: 'epcm-stages', label: 'EPC / EPCM', to: '/content/epcm-stages', icon: Workflow, permission: 'content.read', keywords: ['этапы', 'epc', 'epcm'] },
      { id: 'patents', label: 'Патенты', to: '/content/patents', icon: Award, permission: 'content.read', keywords: ['ис', 'интеллектуальная собственность'] },
      { id: 'videos', label: 'Видео', to: '/content/videos', icon: Video, permission: 'content.read', keywords: ['ролики'] },
    ],
  },
  {
    id: 'translations',
    label: 'Переводы',
    items: [
      { id: 'translations-overview', label: 'Обзор', title: 'Переводы: обзор', to: '/translations', icon: Languages, permission: 'content.read', keywords: ['переводы', 'языки', 'готовность'] },
      { id: 'translations-all', label: 'Все переводы', title: 'Переводы: все', to: '/translations/all', icon: ListChecks, permission: 'content.read', keywords: ['переводы', 'языки', 'ru', 'zh', 'tr', 'ar', 'es'] },
      { id: 'translations-attention', label: 'Требуют внимания', title: 'Переводы: требуют внимания', to: '/translations/attention', icon: AlertTriangle, permission: 'content.read', keywords: ['переводы', 'устарел', 'нет перевода', 'утвердить'] },
    ],
  },
  {
    id: 'seo',
    label: 'SEO',
    items: [{ id: 'seo-report', label: 'Проверка SEO', title: 'SEO: проверка', to: '/seo', icon: SearchCheck, permission: 'seo.read', keywords: ['seo', 'title', 'description', 'мета', 'поиск', 'ошибки'] }],
  },
  {
    id: 'publishing',
    label: 'Публикация',
    items: [
      { id: 'publishing-overview', label: 'Обзор', title: 'Публикация: обзор', to: '/publishing', icon: Send, permission: 'content.read', keywords: ['публикация', 'сайт', 'релиз', 'изменения'] },
      { id: 'publishing-revisions', label: 'Ревизии', title: 'Публикация: ревизии', to: '/publishing/revisions', icon: History, permission: 'content.read', keywords: ['история', 'версии', 'восстановить', 'сравнить'] },
      { id: 'publishing-releases', label: 'Релизы', title: 'Публикация: релизы', to: '/publishing/releases', icon: Rocket, permission: 'content.read', keywords: ['релизы', 'сборка', 'предпросмотр', 'откат'] },
    ],
  },
  {
    id: 'administration',
    label: 'Администрирование',
    items: [
      { id: 'users', label: 'Пользователи', to: '/admin/users', icon: Users, permission: 'users.manage', keywords: ['роли', 'доступ', 'сотрудники'] },
      { id: 'audit', label: 'Журнал действий', to: '/admin/audit', icon: ScrollText, permission: 'audit.read', keywords: ['аудит', 'история', 'лог'] },
      { id: 'system', label: 'Система', to: '/admin/system', icon: Activity, permission: 'system.read', keywords: ['состояние', 'сервер', 'api'] },
    ],
  },
];

/** Personal pages (user menu), available to every signed-in user. */
export const ACCOUNT_ITEM: NavItem = { id: 'account', label: 'Профиль и безопасность', to: '/account', icon: ShieldCheck, keywords: ['пароль', 'ключ', 'passkey', 'сеансы', 'двухфакторная', 'коды'] };

export function visibleNav(can: (p: Permission) => boolean, nav: NavSection[] = NAV): NavSection[] {
  return nav
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((s) => s.items.length > 0);
}

export const allNavItems = (nav: NavSection[] = NAV): NavItem[] => [...nav.flatMap((s) => s.items), ACCOUNT_ITEM];

/** A section overview (e.g. /publishing) is highlighted only on itself when other items live below it. */
export const hasChildRoute = (to: string, nav: NavSection[] = NAV): boolean => allNavItems(nav).some((i) => i.to !== to && i.to.startsWith(`${to}/`));
