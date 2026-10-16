/**
 * «SEO · Проверка SEO»: every issue of the next release (records marked for publication), all
 * public pages and languages. Errors block «Создать релиз»; warnings and hints do not. Filters are
 * kept in the address. Each row links to the record's editor, where the SEO block explains it.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CONTENT_LOCALES, type Locale } from '@soltex/core/domain';
import { SEO_SEVERITIES, type SeoSeverity } from '@soltex/core/seo';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { pageName } from '../publishing/model';
import { LOCALE_INFO, TRANSLATABLE_TYPES, TYPE_LABELS, type TranslatableType } from '../translations/model';
import { describeSeoIssue, SEVERITY_LABELS, SEVERITY_PLURAL, SEVERITY_TONES, sortIssues, type SeoIssueView } from './model';

export const SEO_REPORT_KEY = ['seo', 'report'] as const;

interface Row extends SeoIssueView {
  record: { id: string; title: string; status: string } | null;
}

const col = columnHelper<Row & { rowId: string }>();

const editorPath = (type: string, id: string) => `/content/${type}/${id}`;
/** "page-global-presence" → page name «Глобальное присутствие». */
const pageTitle = (storeId: string) => pageName(storeId.replace(/^page-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

export function SeoReportPage() {
  const [params, setParams] = useSearchParams();
  const severity = (params.get('severity') ?? '') as SeoSeverity | '';
  const locale = (params.get('locale') ?? '') as Locale | '';
  const type = (params.get('type') ?? '') as TranslatableType | '';
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

  const q = useQuery({
    queryKey: [...SEO_REPORT_KEY, { severity, locale, type }],
    queryFn: () => api('GET /api/v1/seo/report', { query: { severity: severity || undefined, locale: locale || undefined, type: type || undefined } }),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => sortIssues((q.data?.issues ?? []) as Row[]).map((r, i) => ({ ...r, rowId: String(i) })), [q.data]);
  const columns = useMemo(
    () => [
      col.accessor('severity', { header: 'Важность', enableSorting: false, cell: (c) => <Status tone={SEVERITY_TONES[c.getValue()]}>{SEVERITY_LABELS[c.getValue()]}</Status> }),
      col.accessor('key', {
        header: 'Материал',
        enableSorting: false,
        cell: (c) => {
          const r = c.row.original;
          const title = r.type === 'pages' ? pageTitle(r.key) : (r.record?.title ?? r.key);
          return r.record ? (
            <Link to={editorPath(r.type, r.record.id)} className="block min-w-44 font-medium text-ink hover:text-accent hover:underline">
              {title}
              <span className="mt-0.5 block text-xs font-normal text-ink-muted">{TYPE_LABELS[r.type as TranslatableType] ?? r.type}</span>
            </Link>
          ) : (
            <span className="font-mono text-xs">{title}</span>
          );
        },
      }),
      col.accessor('locale', { header: 'Язык', enableSorting: false, cell: (c) => (c.getValue() ? <span className="font-mono text-xs font-semibold">{LOCALE_INFO[c.getValue()!].short}</span> : <span className="text-ink-muted">все</span>) }),
      col.accessor('code', { header: 'Замечание', enableSorting: false, cell: (c) => <span className="block min-w-64">{describeSeoIssue(c.row.original)}</span> }),
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Проверка SEO"
        description="Все замечания следующего релиза: материалы, отмеченные к публикации, на всех языках. Ошибки блокируют создание релиза; предупреждения и подсказки — нет."
        crumbs={[{ label: 'SEO' }, { label: 'Проверка SEO' }]}
      />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          Не удалось выполнить проверку SEO.
        </Alert>
      ) : (
        <div className="space-y-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Итоги проверки">
            {SEO_SEVERITIES.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => update({ severity: severity === s ? null : s })}
                  aria-pressed={severity === s}
                  className="w-full rounded-lg border border-line bg-surface p-4 text-left hover:border-line-strong aria-pressed:border-accent"
                  data-summary={s}
                >
                  <span className="block text-2xl font-semibold tabular-nums">{q.data.summary[s]}</span>
                  <Status tone={SEVERITY_TONES[s]} className="text-[13px] text-ink-muted">
                    {SEVERITY_PLURAL[s]}
                  </Status>
                </button>
              </li>
            ))}
          </ul>
          {q.data.summary.blocking ? (
            <Alert tone="danger">Пока есть ошибки, новый релиз создать нельзя. Откройте материал и исправьте поле, на которое указывает замечание.</Alert>
          ) : (
            <Alert tone="info">Блокирующих ошибок нет: релиз можно создавать. Проверено страниц: {q.data.pages} (маршруты × языки).</Alert>
          )}
          <Card>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="block w-44">
                <span className="sr-only">Важность</span>
                <Select aria-label="Важность" value={severity} onChange={(e) => update({ severity: e.target.value || null })}>
                  <option value="">Любая важность</option>
                  {SEO_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_PLURAL[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block w-44">
                <span className="sr-only">Язык</span>
                <Select aria-label="Язык" value={locale} onChange={(e) => update({ locale: e.target.value || null })}>
                  <option value="">Все языки</option>
                  {CONTENT_LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_INFO[l].short} · {LOCALE_INFO[l].name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block w-48">
                <span className="sr-only">Раздел</span>
                <Select aria-label="Раздел" value={type} onChange={(e) => update({ type: e.target.value || null })}>
                  <option value="">Все разделы</option>
                  {TRANSLATABLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </label>
              <span className="text-xs text-ink-muted">Проверено {formatDateTime(q.data.checkedAt)}</span>
            </div>
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(r) => r.rowId}
              caption="Замечания SEO"
              searchText={(r) => `${r.record?.title ?? r.key} ${describeSeoIssue(r)}`}
              searchLabel="Поиск по материалу или замечанию"
              empty={severity || locale || type ? 'Замечаний с такими фильтрами нет.' : 'Замечаний нет.'}
            />
          </Card>
        </div>
      )}
    </>
  );
}
