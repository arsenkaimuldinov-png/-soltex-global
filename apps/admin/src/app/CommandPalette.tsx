/**
 * ⌘K / Ctrl+K: search and commands (review §X, approved §16). Only navigation and harmless
 * commands: nothing that changes the site, no publish, no rollback. Arrows/Enter/Esc.
 */
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, LogOut, Search, User, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api/client';
import { useCan, useLogout } from '../lib/session';
import { ROLE_LABELS } from '../i18n/ru';
import { cx } from '../components/ui/cx';
import { ACCOUNT_ITEM, visibleNav } from './nav';
import { matches } from './search';

export interface Command {
  id: string;
  group: 'Разделы' | 'Действия' | 'Пользователи';
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const can = useCan();
  const logout = useLogout();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const canUsers = can('users.manage');
  const users = useQuery({ queryKey: ['users'], queryFn: () => api('GET /api/v1/users'), enabled: open && canUsers, staleTime: 60_000 });

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      onOpenChange(false);
      navigate(to);
    };
    const list: Command[] = [];
    for (const item of [...visibleNav(can).flatMap((s) => s.items), ACCOUNT_ITEM])
      list.push({ id: `nav:${item.id}`, group: 'Разделы', label: item.title ?? item.label, icon: item.icon, keywords: (item.keywords ?? []).join(' '), run: go(item.to) });
    if (canUsers) list.push({ id: 'act:new-user', group: 'Действия', label: 'Добавить пользователя', icon: UserPlus, keywords: 'создать новый сотрудник', run: go('/admin/users?new=1') });
    list.push({
      id: 'act:logout',
      group: 'Действия',
      label: 'Выйти',
      icon: LogOut,
      keywords: 'выход завершить',
      run: () => {
        onOpenChange(false);
        void logout();
      },
    });
    for (const u of users.data?.items ?? [])
      list.push({ id: `user:${u.id}`, group: 'Пользователи', label: u.name, hint: `${u.email} · ${ROLE_LABELS[u.role]}`, icon: User, keywords: u.email, run: go(`/admin/users?user=${encodeURIComponent(u.id)}`) });
    return list;
  }, [can, canUsers, users.data, navigate, onOpenChange, logout]);

  const results = useMemo(() => {
    const filtered = q.trim() ? commands.filter((c) => matches(c, q)) : commands.filter((c) => c.group !== 'Пользователи');
    return filtered.slice(0, 30);
  }, [commands, q]);

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[active]?.run();
    }
  };

  let lastGroup = '';
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <RadixDialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl" aria-describedby={undefined}>
          <RadixDialog.Title className="sr-only">Поиск и команды</RadixDialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-ink-faint" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Найти раздел, действие или пользователя"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={results[active] ? `cmdk-${results[active].id}` : undefined}
              aria-label="Поиск и команды"
            />
          </div>
          <ul id="cmdk-list" ref={listRef} role="listbox" aria-label="Результаты" className="max-h-[50vh] overflow-y-auto py-1">
            {results.length === 0 ? <li className="px-4 py-6 text-center text-[13px] text-ink-muted">Ничего не найдено</li> : null}
            {results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              const Icon = c.icon;
              return (
                <li key={c.id} role="presentation">
                  {header ? <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-ink-faint uppercase">{header}</div> : null}
                  <div
                    id={`cmdk-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => c.run()}
                    className={cx('mx-1 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px]', i === active ? 'bg-accent-soft text-ink' : 'text-ink')}
                  >
                    <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {c.label}
                      {c.hint ? <span className="ml-2 text-ink-faint">{c.hint}</span> : null}
                    </span>
                    {i === active ? <CornerDownLeft className="size-3.5 text-ink-faint" aria-hidden /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
