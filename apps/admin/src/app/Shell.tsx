/**
 * Authenticated layout: sidebar (review §X), top bar with ⌘K, user menu. On narrow screens the
 * sidebar becomes a drawer.
 */
import * as RadixDialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu as MenuIcon, Search, X } from 'lucide-react';
import { useCan, useLogout, useSessionView } from '../lib/session';
import { ROLE_LABELS } from '../i18n/ru';
import { cx } from '../components/ui/cx';
import { Kbd } from '../components/ui/Layout';
import { CommandPalette } from './CommandPalette';
import { ACCOUNT_ITEM, visibleNav } from './nav';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();
  return (
    <nav aria-label="Основная навигация" className="flex flex-col gap-5 px-3 py-4">
      {visibleNav(can).map((section) => (
        <div key={section.id} className="space-y-1">
          {section.label ? <p className="px-2 text-[11px] font-medium tracking-wide text-ink-faint uppercase">{section.label}</p> : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]', isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-subtle')
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { user } = useSessionView();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-subtle" aria-label="Меню пользователя">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white" aria-hidden>
          {user.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block truncate text-xs text-ink-muted">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className="size-3.5 text-ink-muted" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-lg">
          <div className="px-2 py-1.5 text-xs text-ink-muted">{user.email}</div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item onSelect={() => navigate(ACCOUNT_ITEM.to)} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-subtle">
            <ACCOUNT_ITEM.icon className="size-4" aria-hidden /> {ACCOUNT_ITEM.label}
          </Menu.Item>
          <Menu.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-subtle">
            <LogOut className="size-4" aria-hidden /> Выйти
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function Shell() {
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const brand = <p className="px-5 pt-5 text-xs font-semibold tracking-[0.2em] text-accent">SOLTEX ADMIN</p>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Перейти к содержимому
      </a>
      <aside className="hidden border-r border-line bg-surface lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
        {brand}
        <div className="flex-1 overflow-y-auto">
          <Sidebar />
        </div>
        <div className="border-t border-line p-2">
          <UserMenu />
        </div>
      </aside>

      <RadixDialog.Root open={drawer} onOpenChange={setDrawer}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/35 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl lg:hidden" aria-describedby={undefined}>
            <div className="flex items-center justify-between pr-3">
              {brand}
              <RadixDialog.Close className="mt-4 rounded p-1 text-ink-muted hover:bg-subtle" aria-label="Закрыть меню">
                <X className="size-4" aria-hidden />
              </RadixDialog.Close>
            </div>
            <RadixDialog.Title className="sr-only">Меню</RadixDialog.Title>
            <div className="flex-1 overflow-y-auto">
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-line p-2">
              <UserMenu />
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-canvas/95 px-4 backdrop-blur lg:px-8">
          <button type="button" className="rounded p-1.5 text-ink-muted hover:bg-subtle lg:hidden" aria-label="Открыть меню" onClick={() => setDrawer(true)}>
            <MenuIcon className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="ml-auto flex h-8 w-full max-w-72 items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink-faint hover:border-ink-faint"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Поиск и команды</span>
            <Kbd>{isMac() ? '⌘K' : 'Ctrl+K'}</Kbd>
          </button>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
