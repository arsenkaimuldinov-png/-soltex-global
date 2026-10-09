/**
 * «Все переводы» and «Требуют внимания»: one row per record and language. Search, filters (language,
 * section, state, record), sort and pages run on the API and are kept in the address, so a filtered
 * list can be shared. «Требуют внимания» = everything not approved for the current English text.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { TRANSLATED_LOCALES, type EffectiveTranslationState, type TranslatedLocale } from '@soltex/core/domain';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { Kbd, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { LOCALE_INFO, STATE_LABELS, STATE_TONES, translationPath, TRANSLATABLE_TYPES, TYPE_LABELS, type TranslatableType } from './model';

export const PAGE_SIZE = 25;

interface Row {
  type: TranslatableType;
  id: string;
  key: string;
  title: string;
  entityStatus: string;
  locale: TranslatedLocale;
  state: EffectiveTranslationState;
  sourceChangedSinceEdit: boolean;
  updatedAt: string;
  updatedBy: { name: string } | null;
}

const col = columnHelper<Row>();

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TranslationsListPage({ attention = false }: { attention?: boolean }) {
  const [params, setParams] = useSearchParams();
  const locale = (params.get('locale') ?? '') as TranslatedLocale | '';
  const type = (params.get('type') ?? '') as TranslatableType | '';
  const stateParam = (params.get('state') ?? '') as EffectiveTranslationState | '';
  const state = attention ? 'attention' : stateParam;
  const entity = params.get('entity') ?? '';
  const sort = (params.get('sort') ?? (attention ? 'state' : 'type')) as 'type' | 'title' | 'updated' | 'state';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const query = useDebounced(q);

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

  const list = useQuery({
    queryKey: ['translations', 'list', { locale, type, state, entity, query, sort, page }],
    queryFn: () =>
      api('GET /api/v1/translations', {
        query: {
          locale: locale || undefined,
          type: type || undefined,
          state: state || undefined,
          entity: entity || undefined,
          q: query || undefined,
          sort,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () => [
      col.accessor('title', {
        header: 'Материал',
        enableSorting: false,
        cell: (c) => (
          <Link to={translationPath(c.row.original.type, c.row.original.id, c.row.original.locale)} className="block min-w-48 font-medium text-ink hover:text-accent hover:underline">
            {c.getValue()}
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">{TYPE_LABELS[c.row.original.type]}</span>
          </Link>
        ),
      }),
      col.accessor('locale', {
        header: 'Язык',
        enableSorting: false,
        cell: (c) => (
          <span className="whitespace-nowrap">
            <span className="font-mono text-xs font-semibold">{LOCALE_INFO[c.getValue()].short}</span> {LOCALE_INFO[c.getValue()].name}
          </span>
        ),
      }),
      col.accessor('state', {
        header: 'Состояние',
        enableSorting: false,
        cell: (c) => (
          <span>
            <Status tone={STATE_TONES[c.getValue()]}>{STATE_LABELS[c.getValue()]}</Status>
            {c.getValue() === 'outdated' ? <span className="mt-0.5 block text-xs text-ink-muted">Исходный текст изменился</span> : null}
            {c.row.original.sourceChangedSinceEdit ? <span className="mt-0.5 block text-xs text-ink-muted">Исходный текст изменился после сохранения</span> : null}
          </span>
        ),
      }),
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
    []
  );

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const title = attention ? 'Требуют внимания' : 'Все переводы';

  return (
    <>
      <PageHeader
        title={title}
        description={attention ? 'Переводы, которых нет, которые в работе или устарели после изменения английского текста.' : undefined}
        crumbs={[{ label: 'Переводы', to: '/translations' }, { label: title }]}
      />
      {entity ? (
        <Alert tone="info" className="mb-3" action={<Button size="sm" onClick={() => update({ entity: null, page: null })}>Показать все</Button>}>
          Показаны переводы одного материала.
        </Alert>
      ) : null}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Поиск по названию</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию"
            data-search
            className="h-9 w-full rounded-md border border-line-strong bg-surface pr-9 pl-8 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2" aria-hidden>
            <Kbd>/</Kbd>
          </span>
        </label>
        <label className="block w-40">
          <span className="sr-only">Язык</span>
          <Select aria-label="Язык" value={locale} onChange={(e) => update({ locale: e.target.value || null, page: null })}>
            <option value="">Все языки</option>
            {TRANSLATED_LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_INFO[l].short} · {LOCALE_INFO[l].name}
              </option>
            ))}
          </Select>
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
        {!attention ? (
          <label className="block w-44">
            <span className="sr-only">Состояние</span>
            <Select aria-label="Состояние" value={stateParam} onChange={(e) => update({ state: e.target.value || null, page: null })}>
              <option value="">Все состояния</option>
              {(Object.keys(STATE_LABELS) as EffectiveTranslationState[]).map((s) => (
                <option key={s} value={s}>
                  {STATE_LABELS[s]}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="block w-52">
          <span className="sr-only">Сортировка</span>
          <Select aria-label="Сортировка" value={sort} onChange={(e) => update({ sort: e.target.value, page: null })}>
            <option value="type">По разделам</option>
            <option value="state">Сначала требующие внимания</option>
            <option value="title">По названию</option>
            <option value="updated">Недавно изменённые</option>
          </Select>
        </label>
      </div>

      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
          Не удалось загрузить переводы.
        </Alert>
      ) : (
        <div className="space-y-3">
          <DataTable
            data={list.data.items as Row[]}
            columns={columns}
            getRowId={(r) => `${r.type}:${r.id}:${r.locale}`}
            caption={title}
            empty={attention && !query && !locale && !type ? 'Все переводы утверждены для текущих английских текстов.' : 'Ничего не найдено. Измените запрос или фильтр.'}
          />
          <nav aria-label="Страницы списка" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} из ${total}` : 'Нет записей'}</span>
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
