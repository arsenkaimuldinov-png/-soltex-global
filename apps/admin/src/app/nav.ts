/**
 * Navigation model (review §X sidebar). One list drives the sidebar, the ⌘K palette and the route
 * guards, so a screen is never visible in one place and hidden in another.
 *
 * Only screens that exist are listed. The sections of later phases (Контент, Медиатека, Переводы,
 * Заявки, SEO, Настройки) are added here together with their screens; there are no placeholders.
 * Visibility is a presentation of the user's permissions (from GET /auth/session); the API
 * enforces every permission on its own.
 */
import type { Permission } from '@soltex/core/domain';
import type { LucideIcon } from 'lucide-react';
import { Activity, LayoutDashboard, ScrollText, ShieldCheck, Users } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Required permission; omitted = every signed-in user. */
  permission?: Permission;
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
