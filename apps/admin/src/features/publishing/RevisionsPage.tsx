/**
 * «Публикация · Ревизии»: every recorded version of every record, newest first. Filters (section,
 * kind of change, title search) and pages run on the API and are kept in the address.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { REVISION_KINDS, type RevisionKind } from '@soltex/core/domain';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { TRANSLATABLE_TYPES, TYPE_LABELS, type TranslatableType } from '../translations/model';
import { revisionLine } from './HistoryPanel';
import { historyPath, REVISION_KIND_LABELS } from './model';

export const REVISIONS_PAGE_SIZE = 25;

interface Row {
  id: number;
  entityType: TranslatableType;
  entityId: string;
  number: number;
  kind: RevisionKind;
  locale: string | null;
  title: string;
  restoredFrom: number | null;
  createdAt: string;
  author: { name: string } | null;
  current: boolean;
}

const col = columnHelper<Row>();

export function RevisionsPage() {
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? '') as TranslatableType | '';
  const kind = (params.get('kind') ?? '') as RevisionKind | '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

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
  useEffect(() => {
    if ((params.get('q') ?? '') !== query) update({ q: query || null, page: null });
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useQuery({
    queryKey: ['publishing', 'revisions', 'all', { type, kind, query, page }],
    queryFn: () =>
      api('GET /api/v1/revisions', {
        query: { type: type || undefined, kind: kind || undefined, q: query || undefined, limit: REVISIONS_PAGE_SIZE, offset: (page - 1) * REVISIONS_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () => [
      col.accessor('title', {
        header: 'Материал',
        enableSorting: false,
        cell: (c) => (
          <Link to={historyPath(c.row.original.entityType, c.row.original.entityId)} className="block min-w-48 font-medium text-ink hover:text-accent hover:underline">
            {c.getValue()}
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">{TYPE_LABELS[c.row.original.entityType]}</span>
          </Link>
        ),
      }),
      col.accessor('number', {
        header: 'Версия',
        enableSorting: false,
        cell: (c) => (
          <span className="whitespace-nowrap tabular-nums">
            {c.getValue()}
            {c.row.original.current ? <span className="ml-1 text-xs text-ink-muted">(текущая)</span> : null}
          </span>
        ),
      }),
      col.accessor('kind', { header: 'Изменение', enableSorting: false, cell: (c) => revisionLine(c.row.original) }),
      col.accessor('createdAt', {
        header: 'Когда и кто',
        enableSorting: false,
        cell: (c) => (
          <span className="whitespace-nowrap">
            {formatDateTime(c.getValue())}
            <span className="block text-xs text-ink-muted">{c.row.original.author?.name ?? 'система'}</span>
          </span>
        ),
      }),
    ],
    []
  );

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / REVISIONS_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Ревизии"
        description="Каждое сохранение материала или перевода — новая версия. Версии не удаляются; любую можно сравнить с текущей и восстановить."
        crumbs={[{ label: 'Публикация', to: '/publishing' }, { label: 'Ревизии' }]}
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Поиск по названию</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию"
            className="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-8 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block w-44">
          <span className="sr-only">Раздел</span>
          <Select aria-label="Раздел" value={type} onChange={(e) => update({ type: e.target.value || null, page: null })}>
            <option value="">Все разделы</option>
            {TRANSLATABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block w-52">
          <span className="sr-only">Изменение</span>
          <Select aria-label="Изменение" value={kind} onChange={(e) => update({ kind: e.target.value || null, page: null })}>
            <option value="">Все изменения</option>
            {REVISION_KINDS.map((k) => (
              <option key={k} value={k}>
                {REVISION_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
          Не удалось загрузить ревизии.
        </Alert>
      ) : (
        <div className="space-y-3">
          <DataTable data={list.data.items as Row[]} columns={columns} getRowId={(r) => String(r.id)} caption="Ревизии" empty="Ничего не найдено. Измените запрос или фильтр." />
          <nav aria-label="Страницы списка" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <span>{total ? `${(page - 1) * REVISIONS_PAGE_SIZE + 1}–${Math.min(page * REVISIONS_PAGE_SIZE, total)} из ${total}` : 'Нет записей'}</span>
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
