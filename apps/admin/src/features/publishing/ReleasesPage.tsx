/**
 * «Публикация · Релизы»: release candidates and preview builds, newest first, with status filters.
 * Opening a release shows its steps, changes, checks and the publish / rollback actions.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RELEASE_STATUSES, type ReleaseStatus } from '@soltex/core/domain';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ReleaseStatusBadge, useCreateBuild } from './PublishingOverviewPage';
import { IN_PROGRESS, PREVIEW_PERMISSIONS, RELEASE_STATUS_LABELS } from './model';

export const RELEASES_PAGE_SIZE = 20;

interface Row {
  id: string;
  key: string;
  kind: 'release' | 'preview';
  status: ReleaseStatus;
  createdAt: string;
  createdBy: { name: string } | null;
  activatedAt: string | null;
  errors: number;
  warnings: number;
}

const col = columnHelper<Row>();

export function ReleasesPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('kind') ?? 'release') as 'release' | 'preview';
  const status = (params.get('status') ?? '') as ReleaseStatus | '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const { create, busy } = useCreateBuild();
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true }
    );

  const list = useQuery({
    queryKey: ['publishing', 'releases', { kind, status, page }],
    queryFn: () => api('GET /api/v1/releases', { query: { kind, status: status || undefined, limit: RELEASES_PAGE_SIZE, offset: (page - 1) * RELEASES_PAGE_SIZE } }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => ((q.state.data?.items as Row[] | undefined)?.some((r) => IN_PROGRESS.includes(r.status)) ? 3000 : false),
  });

  const columns = useMemo(
    () => [
      col.accessor('key', {
        header: 'Релиз',
        enableSorting: false,
        cell: (c) => (
          <Link to={`/publishing/releases/${c.row.original.id}`} className="font-mono font-medium text-accent hover:underline">
            {c.getValue()}
          </Link>
        ),
      }),
      col.accessor('status', { header: 'Состояние', enableSorting: false, cell: (c) => <ReleaseStatusBadge status={c.getValue()} /> }),
      col.accessor('createdAt', {
        header: 'Создан',
        enableSorting: false,
        cell: (c) => (
          <span className="whitespace-nowrap">
            {formatDateTime(c.getValue())}
            <span className="block text-xs text-ink-muted">{c.row.original.createdBy?.name ?? 'система'}</span>
          </span>
        ),
      }),
      col.accessor('activatedAt', { header: 'Опубликован', enableSorting: false, cell: (c) => (c.getValue() ? formatDateTime(c.getValue()!) : '—') }),
      col.accessor('warnings', {
        header: 'Проверки',
        enableSorting: false,
        cell: (c) => (c.row.original.errors ? `ошибок: ${c.row.original.errors}` : c.getValue() ? `предупреждений: ${c.getValue()}` : '—'),
      }),
    ],
    []
  );

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / RELEASES_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Релизы"
        description="Релиз — неизменяемый снимок опубликованных материалов, собранный в готовый сайт. На сайте всегда ровно один релиз; предыдущие остаются для отката."
        crumbs={[{ label: 'Публикация', to: '/publishing' }, { label: 'Релизы' }]}
        actions={
          PREVIEW_PERMISSIONS.some((p) => can(p)) ? (
            <Button onClick={() => void create('preview')} loading={busy}>
              Предпросмотр черновиков
            </Button>
          ) : undefined
        }
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block w-48">
          <span className="sr-only">Вид</span>
          <Select aria-label="Вид" value={kind} onChange={(e) => update({ kind: e.target.value === 'release' ? null : e.target.value, page: null })}>
            <option value="release">Релизы сайта</option>
            <option value="preview">Предпросмотры</option>
          </Select>
        </label>
        <label className="block w-48">
          <span className="sr-only">Состояние</span>
          <Select aria-label="Состояние" value={status} onChange={(e) => update({ status: e.target.value || null, page: null })}>
            <option value="">Все состояния</option>
            {RELEASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RELEASE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
          Не удалось загрузить релизы.
        </Alert>
      ) : (
        <div className="space-y-3">
          <DataTable
            data={list.data.items as Row[]}
            columns={columns}
            getRowId={(r) => r.id}
            caption="Релизы"
            rowClassName={(r) => (r.status === 'active' ? 'bg-accent-soft/40' : undefined)}
            empty={kind === 'preview' ? 'Предпросмотров пока не было.' : 'Релизов пока нет. Создайте релиз на странице «Обзор».'}
          />
          <nav aria-label="Страницы списка" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <span>{total ? `${(page - 1) * RELEASES_PAGE_SIZE + 1}–${Math.min(page * RELEASES_PAGE_SIZE, total)} из ${total}` : 'Нет записей'}</span>
            {pages > 1 ? (
              <span className="flex gap-2">
                <Button size="sm" disabled={page <= 1} onClick={() => update({ page: page - 1 <= 1 ? null : String(page - 1) })}>
                  Назад
                </Button>
                <Button size="sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
                  Вперёд
                </Button>
              </span>
            ) : null}
          </nav>
        </div>
      )}
    </>
  );
}
