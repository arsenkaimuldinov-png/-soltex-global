/** Fixed pages and templates (no create, no archive: the page set is owned by code). */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PageKey } from '@soltex/core/content';
import { api } from '../../lib/api/client';
import type { PageListItem } from '../../lib/api/schema.gen';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { PAGE_NAMES, PAGE_PATHS } from './page-labels';
import { StatusBadge, TranslationsSummaryText } from './shared';

const col = columnHelper<PageListItem & { name: string }>();
export const PAGES_KEY = ['content', 'pages', 'list'] as const;

export function PagesListPage() {
  const pages = useQuery({ queryKey: PAGES_KEY, queryFn: () => api('GET /api/v1/content/pages') });
  const rows = useMemo(() => (pages.data?.items ?? []).map((p) => ({ ...p, name: PAGE_NAMES[p.pageKey as PageKey] ?? p.pageKey })), [pages.data]);
  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Страница',
        sortFn: 'text',
        cell: (c) => (
          <Link to={`/content/pages/${c.row.original.id}`} className="block min-w-48 font-medium text-ink hover:text-accent hover:underline">
            {c.getValue()}
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
              {c.row.original.kind === 'template' ? 'Общие тексты всех страниц этого типа' : <span className="font-mono">{PAGE_PATHS[c.row.original.pageKey as PageKey]}</span>}
            </span>
          </Link>
        ),
      }),
      col.accessor('status', { header: 'Статус', enableSorting: false, cell: (c) => <StatusBadge status={c.getValue()} /> }),
      col.accessor('translations', { header: 'Переводы', enableSorting: false, cell: (c) => <TranslationsSummaryText translations={c.getValue()} /> }),
      col.accessor('updatedAt', {
        header: 'Изменено',
        sortFn: 'alphanumeric',
        cell: (c) => (
          <span className="whitespace-nowrap">
            {formatDateTime(c.getValue())}
            {c.row.original.updatedBy ? <span className="block text-xs text-ink-muted">{c.row.original.updatedBy.name}</span> : null}
          </span>
        ),
      }),
    ],
    []
  );
  return (
    <>
      <PageHeader
        title="Страницы"
        description="Постоянные страницы сайта и шаблоны страниц проектов, технологий и продуктов. Состав блоков задан дизайном сайта; здесь меняются тексты, изображения и SEO."
        crumbs={[{ label: 'Контент' }, { label: 'Страницы' }]}
      />
      {pages.isPending ? (
        <LoadingBlock />
      ) : pages.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void pages.refetch()}>Повторить</Button>}>
          Не удалось загрузить страницы.
        </Alert>
      ) : (
        <DataTable data={rows} columns={columns} getRowId={(r) => r.id} searchText={(r) => `${r.name} ${PAGE_PATHS[r.pageKey as PageKey] ?? ''}`} searchLabel="Поиск страницы" caption="Страницы" empty="Страниц нет." />
      )}
    </>
  );
}
