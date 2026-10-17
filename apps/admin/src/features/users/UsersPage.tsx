import * as Menu from '@radix-ui/react-dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { canManageUser } from '@soltex/core/domain';
import { api } from '../../lib/api/client';
import type { User } from '../../lib/api/schema.gen';
import { formatDateTime } from '../../lib/format';
import { useSessionView } from '../../lib/session';
import { useStepUp } from '../../lib/step-up';
import { ROLE_LABELS, USER_STATUS_LABELS } from '../../i18n/ru';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { PageHeader } from '../../components/ui/Layout';
import { LoadingBlock, Spinner } from '../../components/ui/Spinner';
import { Badge, Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { CreateUserDialog, EditUserDialog, InitialPasswordDialog } from './UserDialogs';

export const USERS_KEY = ['users'] as const;
const col = columnHelper<User>();

export function UsersPage() {
  const { user: actor } = useSessionView();
  const qc = useQueryClient();
  const toast = useToast();
  const withStepUp = useStepUp();
  const [params, setParams] = useSearchParams();
  const users = useQuery({ queryKey: USERS_KEY, queryFn: () => api('GET /api/v1/users') });
  const [confirm, setConfirm] = useState<{ kind: 'mfa' | 'sessions'; user: User } | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialFor, setInitialFor] = useState<User | null>(null);

  const creating = params.get('new') === '1';
  const editingId = params.get('user');
  const editing = users.data?.items.find((u) => u.id === editingId) ?? null;
  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );

  useEffect(() => {
    if (editingId && users.data && !editing) setParam('user', null);
  }, [editingId, users.data, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const may = (u: User, change: 'reset_mfa' | 'revoke_sessions' | 'update_profile' | 'set_initial_password') =>
    canManageUser({ actorRole: actor.role, actorId: actor.id, targetId: u.id, targetRole: u.role, change });

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Пользователь',
        sortFn: 'text',
        cell: (c) => (
          <div>
            <p className="font-medium text-ink">
              {c.getValue()}
              {c.row.original.id === actor.id ? <span className="ml-2 text-xs font-normal text-ink-muted">(вы)</span> : null}
            </p>
            <p className="text-xs text-ink-muted">{c.row.original.email}</p>
          </div>
        ),
      }),
      col.accessor((u) => ROLE_LABELS[u.role], { id: 'role', header: 'Роль', sortFn: 'text', cell: (c) => <Badge>{c.getValue()}</Badge> }),
      col.accessor('status', {
        header: 'Статус',
        cell: (c) => (
          <span>
            <Status tone={c.getValue() === 'active' ? 'ok' : 'neutral'}>{USER_STATUS_LABELS[c.getValue()]}</Status>
            {c.row.original.passwordTemporary ? <span className="block text-xs text-warn">Ещё не сменил начальный пароль</span> : null}
          </span>
        ),
      }),
      col.accessor((u) => u.lastLoginAt ?? '', { id: 'lastLogin', header: 'Последний вход', sortFn: 'alphanumeric', cell: (c) => formatDateTime(c.row.original.lastLoginAt) }),
      col.display({
        id: 'actions',
        header: () => <span className="sr-only">Действия</span>,
        cell: (c) => {
          const u = c.row.original;
          return (
            <Menu.Root>
              <Menu.Trigger className="rounded p-1 text-ink-muted hover:bg-subtle hover:text-ink" aria-label={`Действия: ${u.name}`}>
                <MoreHorizontal className="size-4" aria-hidden />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-lg">
                  <Menu.Item onSelect={() => setParam('user', u.id)} className="cursor-pointer rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-subtle">
                    Изменить
                  </Menu.Item>
                  {may(u, 'revoke_sessions') ? (
                    <Menu.Item onSelect={() => setConfirm({ kind: 'sessions', user: u })} className="cursor-pointer rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-subtle">
                      Завершить все сеансы
                    </Menu.Item>
                  ) : null}
                  {may(u, 'set_initial_password') ? (
                    <Menu.Item onSelect={() => setInitialFor(u)} className="cursor-pointer rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-subtle">
                      Выдать новый начальный пароль
                    </Menu.Item>
                  ) : null}
                  {may(u, 'reset_mfa') ? (
                    <Menu.Item onSelect={() => setConfirm({ kind: 'mfa', user: u })} className="cursor-pointer rounded px-2 py-1.5 text-[13px] text-danger outline-none data-[highlighted]:bg-danger-soft">
                      Сбросить второй фактор
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      }),
    ],
    [actor.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setConfirm(null);
    setBusy(true);
    try {
      if (kind === 'mfa') {
        await withStepUp(() => api('POST /api/v1/users/{id}/mfa-reset', { params: { id: user.id } }));
        toast.success(`Второй фактор пользователя ${user.name} сброшен`);
      } else {
        await withStepUp(() => api('POST /api/v1/users/{id}/sessions/revoke', { params: { id: user.id } }));
        toast.success(`Пользователь ${user.name} выведен из всех сеансов`);
      }
      void qc.invalidateQueries({ queryKey: USERS_KEY });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Пользователи"
        description="Учётные записи сотрудников и их роли. Роли фиксированы: права каждой роли описаны в документации проекта."
        crumbs={[{ label: 'Администрирование' }, { label: 'Пользователи' }]}
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setParam('new', '1')}>
            Добавить пользователя
          </Button>
        }
      />
      {users.isPending ? (
        <LoadingBlock />
      ) : users.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void users.refetch()}>Повторить</Button>}>
          Не удалось загрузить пользователей.
        </Alert>
      ) : (
        <DataTable
          data={users.data.items}
          columns={columns}
          getRowId={(u) => u.id}
          searchText={(u) => `${u.name} ${u.email} ${ROLE_LABELS[u.role]}`}
          searchLabel="Поиск по имени, e-mail или роли"
          caption="Пользователи админки"
          empty="Пользователей пока нет."
          rowClassName={(u) => (u.status === 'disabled' ? 'text-ink-muted' : undefined)}
          toolbar={busy ? <Spinner label="Выполняется…" /> : null}
        />
      )}

      <CreateUserDialog
        open={creating}
        onOpenChange={(o) => setParam('new', o ? '1' : null)}
        onCreated={(u) => {
          setParam('new', null);
          void qc.invalidateQueries({ queryKey: USERS_KEY });
          toast.success(`Пользователь ${u.name} создан`);
        }}
      />
      <EditUserDialog
        user={editing}
        onOpenChange={(o) => !o && setParam('user', null)}
        onSaved={(u) => {
          setParam('user', null);
          void qc.invalidateQueries({ queryKey: USERS_KEY });
          toast.success(`Изменения сохранены: ${u.name}`);
        }}
      />
      <InitialPasswordDialog
        user={initialFor}
        onOpenChange={(o) => !o && setInitialFor(null)}
        onDone={(u) => {
          setInitialFor(null);
          void qc.invalidateQueries({ queryKey: USERS_KEY });
          toast.success(`Новый начальный пароль выдан: ${u.name}. Передайте его защищённым способом.`);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'mfa'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Сбросить второй фактор: ${confirm?.user.name ?? ''}?`}
        consequences={[
          'Сначала убедитесь, что просьба исходит от самого пользователя (звонок или личная встреча).',
          'Все его ключи доступа, приложение-аутентификатор и резервные коды будут удалены.',
          'Все его сеансы будут завершены; при следующем входе он настроит второй фактор заново.',
          'Пользователь получит уведомление, действие попадёт в журнал.',
        ]}
        confirmLabel="Сбросить второй фактор"
        onConfirm={() => void runConfirm()}
      />
      <ConfirmDialog
        open={confirm?.kind === 'sessions'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Завершить все сеансы: ${confirm?.user.name ?? ''}?`}
        consequences={['Пользователю придётся войти заново на всех устройствах.', 'Пароль и второй фактор не меняются.']}
        confirmLabel="Завершить сеансы"
        onConfirm={() => void runConfirm()}
      />
    </>
  );
}
