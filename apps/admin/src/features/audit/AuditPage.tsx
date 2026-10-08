/**
 * Журнал действий (approved §17.2, admin-auth.md §5). Newest first, 50 per page («Показать ещё»
 * uses the `before` cursor of the API). Filters by person and action run on the server.
 * Technical values (request id, event id, raw summary) only in «Дополнительно».
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { AUDIT_ACTION_LABELS, RESULT_LABELS } from '../../i18n/ru';
import { Advanced, TechValue } from '../../components/ui/Advanced';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Select } from '../../components/ui/Field';
import { Facts, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { auditActionLabel, describeAuditDetails, type AuditItem } from './describe';

export const PAGE_SIZE = 50;
const RESULT_TONE = { success: 'ok', failure: 'danger', denied: 'warn' } as const;
const col = columnHelper<AuditItem & { actor: string }>();

export function AuditPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const actorId = params.get('actor') ?? '';
  const action = params.get('action') ?? '';
  const [open, setOpen] = useState<(AuditItem & { actor: string }) | null>(null);

  // Names of people. Audit readers (Owner, Admin) also hold users.manage; without it ids stay hidden.
  const users = useQuery({ queryKey: ['users'], queryFn: () => api('GET /api/v1/users'), enabled: can('users.manage'), staleTime: 60_000 });
  const names = useMemo(() => new Map((users.data?.items ?? []).map((u) => [u.id, u.name])), [users.data]);
  const actorName = (id: string | null) => (id === null ? 'Система' : names.get(id) ?? 'Пользователь');

  const events = useInfiniteQuery({
    queryKey: ['audit', { actorId, action }],
    queryFn: ({ pageParam }) =>
      api('GET /api/v1/audit', { query: { limit: PAGE_SIZE, before: pageParam, actorId: actorId || undefined, action: action || undefined } }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.items.length < PAGE_SIZE ? undefined : last.items[last.items.length - 1]?.id),
  });
  const rows = useMemo(() => (events.data?.pages ?? []).flatMap((p) => p.items).map((e) => ({ ...e, actor: actorName(e.actorId) })), [events.data, names]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const columns = useMemo(
    () => [
      col.accessor('at', { header: 'Время', enableSorting: false, cell: (c) => <span className="whitespace-nowrap">{formatDateTime(c.getValue())}</span> }),
      col.accessor('actor', { header: 'Кто', enableSorting: false }),
      col.accessor((e) => auditActionLabel(e.action), { id: 'action', header: 'Действие', enableSorting: false }),
      col.accessor('result', { header: 'Результат', enableSorting: false, cell: (c) => <Status tone={RESULT_TONE[c.getValue()]}>{RESULT_LABELS[c.getValue()]}</Status> }),
      col.accessor((e) => describeAuditDetails(e), { id: 'details', header: 'Подробности', enableSorting: false, cell: (c) => <span className="text-ink-muted">{c.getValue() || '—'}</span> }),
      col.display({
        id: 'open',
        header: () => <span className="sr-only">Открыть</span>,
        cell: (c) => (
          <Button size="sm" variant="ghost" onClick={() => setOpen(c.row.original)} aria-label={`Подробнее: ${auditActionLabel(c.row.original.action)}, ${formatDateTime(c.row.original.at)}`}>
            Подробнее
          </Button>
        ),
      }),
    ],
    []
  );

  const filtered = !!(actorId || action);
  return (
    <>
      <PageHeader
        title="Журнал действий"
        description="Входы, изменения доступа и настроек безопасности. Записи нельзя изменить или удалить."
        crumbs={[{ label: 'Администрирование' }, { label: 'Журнал действий' }]}
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        {can('users.manage') ? (
          <Field label="Кто" className="w-56">
            {({ id }) => (
              <Select id={id} value={actorId} onChange={(e) => setFilter('actor', e.target.value)}>
                <option value="">Все</option>
                {(users.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Действие" className="w-72">
          {({ id }) => (
            <Select id={id} value={action} onChange={(e) => setFilter('action', e.target.value)}>
              <option value="">Все действия</option>
              {Object.entries(AUDIT_ACTION_LABELS)
                .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        {filtered ? (
          <Button size="md" variant="ghost" onClick={() => setParams({}, { replace: true })}>
            Сбросить фильтры
          </Button>
        ) : null}
      </div>

      {events.isPending ? (
        <LoadingBlock />
      ) : events.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void events.refetch()}>Повторить</Button>}>
          Не удалось загрузить журнал.
        </Alert>
      ) : (
        <div className="space-y-3">
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(e) => String(e.id)}
            caption="Журнал действий"
            empty={filtered ? 'Нет записей по выбранным фильтрам.' : 'Записей пока нет.'}
          />
          {events.hasNextPage ? (
            <Button onClick={() => void events.fetchNextPage()} loading={events.isFetchingNextPage}>
              Показать ещё
            </Button>
          ) : rows.length > 0 ? (
            <p className="text-xs text-ink-muted">Показаны все записи{filtered ? ' по выбранным фильтрам' : ''}.</p>
          ) : null}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open ? auditActionLabel(open.action) : ''} description={open ? formatDateTime(open.at) : undefined}>
        {open ? (
          <div className="space-y-4">
            <Facts
              items={[
                { label: 'Кто', value: open.actor },
                { label: 'Результат', value: <Status tone={RESULT_TONE[open.result]}>{RESULT_LABELS[open.result]}</Status> },
                { label: 'Подробности', value: describeAuditDetails(open) || '—' },
                ...(open.resourceType === 'user' && open.resourceId ? [{ label: 'Пользователь', value: actorName(open.resourceId) }] : []),
              ]}
            />
            <Advanced>
              <TechValue label="Номер записи" value={String(open.id)} />
              <TechValue label="Код запроса" value={open.requestId} />
              <TechValue label="Действие" value={open.action} />
              <TechValue label="Объект" value={open.resourceType ? `${open.resourceType} ${open.resourceId ?? ''}` : null} />
              <TechValue label="ID пользователя" value={open.actorId} />
              <TechValue label="Данные" value={JSON.stringify(open.summary)} />
            </Advanced>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
