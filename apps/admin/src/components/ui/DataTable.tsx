/**
 * Dense, readable table (review §X) on TanStack Table v9. Sorting is client-side; text search
 * filters the rows before they reach the table ("/" focuses the search field).
 * Rows are keyed by `getRowId`, never by index.
 */
import { createColumnHelper, createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_text, tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { cx } from './cx';
import { Kbd } from './Layout';

export const tableFeaturesDefault = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});
export type TableFeaturesDefault = typeof tableFeaturesDefault;
export const columnHelper = <T extends RowData>() => createColumnHelper<TableFeaturesDefault, T>();
export type Columns<T extends RowData> = Array<ColumnDef<TableFeaturesDefault, T, any>>;

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: Columns<T>;
  getRowId: (row: T) => string;
  /** Plain text of a row used by the search field; omit to hide search. */
  searchText?: (row: T) => string;
  searchLabel?: string;
  empty: ReactNode;
  caption: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T extends RowData>({ data, columns, getRowId, searchText, searchLabel = 'Поиск', empty, caption, toolbar, rowClassName }: DataTableProps<T>) {
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('ru');
    if (!needle || !searchText) return data;
    return data.filter((r) => searchText(r).toLocaleLowerCase('ru').includes(needle));
  }, [data, q, searchText]);

  const table = useTable({ features: tableFeaturesDefault, columns, data: filtered, getRowId, enableSortingRemoval: false });

  // "/" focuses the search field (review §X keyboard), unless typing elsewhere.
  useEffect(() => {
    if (!searchText) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchText]);

  const rows = table.getRowModel().rows;
  return (
    <div className="space-y-3">
      {searchText || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {searchText ? (
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">{searchLabel}</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchLabel}
                className="h-9 w-full rounded-md border border-line-strong bg-surface pr-9 pl-8 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" aria-hidden>
                <Kbd>/</Kbd>
              </span>
            </label>
          ) : null}
          {toolbar ? <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-subtle text-xs text-ink-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className="border-b border-line px-3 py-2 font-medium whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-ink">
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="px-3 py-8 text-center text-ink-muted">
                  {q && data.length ? 'Ничего не найдено. Измените запрос.' : empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={cx('border-b border-line last:border-b-0 hover:bg-subtle/50', rowClassName?.(row.original))}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-top">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
