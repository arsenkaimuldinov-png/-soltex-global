/**
 * List of a content collection (table-first, review §X): search, status filter, sort and pages run
 * on the API; the address keeps them (?q=&status=&sort=&page=), so a list can be shared and
 * returned to. Technical ids are not shown (approved §16).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { EmptyState, Kbd, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { NotFoundPage } from '../../app/ErrorPages';
import { CreateDialog } from './CreateDialog';
import { COLLECTION_UI, COLLECTIONS, STATUS_LABELS, type CollectionName } from './model';
import { StatusBadge, TranslationsSummaryText, type ContentStatus, type TrState } from './shared';

export const PAGE_SIZE = 20;

interface Row {
  id: string;
  key: string;
  title: string;
  slug: string | null;
  status: ContentStatus;
  position: number;
  updatedAt: string;
  updatedBy: { name: string } | null;
  translations: Record<string, TrState>;
}

const col = columnHelper<Row>();

export function ContentListPageRoute() {
  const { collection = '' } = useParams();
  if (!(COLLECTIONS as readonly string[]).includes(collection)) return <NotFoundPage />;
  return <ContentListPage key={collection} collection={collection as CollectionName} />;
}

/** Debounced text for the search field. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ContentListPage({ collection }: { collection: CollectionName }) {
  const ui = COLLECTION_UI[collection];
  const can = useCan();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as ContentStatus | '';
  const sort = (params.get('sort') ?? 'position') as 'position' | 'title' | 'updated';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const query = useDebounced(q);
  const [creating, setCreating] = useState(false);

  // "/" focuses the search field (review §X keyboard), unless typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      document.querySelector<HTMLInputElement>('input[data-search]')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    queryKey: ['content', collection, 'list', { query, status, sort, page }],
    queryFn: () =>
      api(`GET /api/v1/content/${collection}` as 'GET /api/v1/content/projects', {
        query: { q: query || undefined, status: status || undefined, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () => [
      col.accessor('title', {
        header: 'Название',
        enableSorting: false,
        cell: (c) => (
          <Link to={`/content/${collection}/${c.row.original.id}`} className="block min-w-48 font-medium text-ink hover:text-accent hover:underline">
            {c.getValue() || 'Без названия'}
            {c.row.original.slug ? <span className="mt-0.5 block font-mono text-xs font-normal text-ink-muted">{ui.pathPrefix}{c.row.original.slug}</span> : null}
          </Link>
        ),
      }),
      col.accessor('status', { header: 'Статус', enableSorting: false, cell: (c) => <StatusBadge status={c.getValue()} /> }),
      col.accessor('translations', { header: 'Переводы', enableSorting: false, cell: (c) => <TranslationsSummaryText translations={c.getValue()} /> }),
      col.accessor('position', { header: 'Порядок', enableSorting: false, cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }),
      col.accessor('updatedAt', {
        header: 'Изменено',
        enableSorting: false,
        cell: (c) => (
          <span className="whitespace-nowrap">
            {formatDateTime(c.getValue())}
            {c.row.original.updatedBy ? <span className="block text-xs text-ink-muted">{c.row.original.updatedBy.name}</span> : null}
          </span>
        ),
      }),
    ],
    [collection, ui.pathPrefix]
  );

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(query || status);

  return (
    <>
      <PageHeader
        title={ui.title}
        crumbs={[{ label: 'Контент' }, { label: ui.title }]}
        actions={
          can('content.edit') ? (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
              Создать {ui.one}
            </Button>
          ) : null
        }
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Поиск по названию или адресу</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию или адресу"
            data-search
            className="h-9 w-full rounded-md border border-line-strong bg-surface pr-9 pl-8 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" aria-hidden>
            <Kbd>/</Kbd>
          </span>
        </label>
        <label className="block w-44">
          <span className="sr-only">Статус</span>
          <Select aria-label="Статус" value={status} onChange={(e) => update({ status: e.target.value || null, page: null })}>
            <option value="">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as ContentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block w-52">
          <span className="sr-only">Сортировка</span>
          <Select aria-label="Сортировка" value={sort} onChange={(e) => update({ sort: e.target.value === 'position' ? null : e.target.value, page: null })}>
            <option value="position">Как на сайте</option>
            <option value="title">По названию</option>
            <option value="updated">Недавно изменённые</option>
          </Select>
        </label>
      </div>

      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
          Не удалось загрузить список.
        </Alert>
      ) : total === 0 && !filtered ? (
        <EmptyState
          title="Записей пока нет"
          action={can('content.edit') ? <Button variant="primary" onClick={() => setCreating(true)}>Создать {ui.one}</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          <DataTable data={list.data.items as Row[]} columns={columns} getRowId={(r) => r.id} caption={ui.title} empty="Ничего не найдено. Измените запрос или фильтр." />
          <nav aria-label="Страницы списка" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <span>
              {total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} из ${total}` : 'Нет записей'}
            </span>
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
      <CreateDialog collection={collection} open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(`/content/${collection}/${id}`)} />
    </>
  );
}
