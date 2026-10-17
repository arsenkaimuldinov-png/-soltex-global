/**
 * «Заявки» (Phase K-1, docs/admin-leads.md): the forms of the site, newest first. Filters are kept
 * in the address: status (with counts), form, period, assignee, search (name, company, number; an
 * exact e-mail or phone). The bin shows deleted leads until they are anonymized (30 days).
 * «Выгрузить CSV» (leads.export) asks for a fresh second factor and is recorded in the audit log.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Search } from 'lucide-react';
import { LEAD_FORMS, LEAD_STATUSES, type LeadForm, type LeadStatus } from '@soltex/core/domain';
import { api, downloadFile } from '../../lib/api/client';
import type { LeadItem } from '../../lib/api/schema.gen';
import { formatDateTime, plural } from '../../lib/format';
import { useCan } from '../../lib/session';
import { useStepUp } from '../../lib/step-up';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/Field';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { Cancelled } from '../../lib/errors';
import { LEAD_FORM_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONES, LEADS_KEY, NOTIFICATION_LABELS } from './model';

const col = columnHelper<LeadItem>();

export function LeadsListPage() {
  const can = useCan();
  const toast = useToast();
  const withStepUp = useStepUp();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const filters = {
    q: get('q'),
    status: get('status') as LeadStatus | '',
    form: get('form') as LeadForm | '',
    from: get('from'),
    to: get('to'),
    assignee: get('assignee'),
    deleted: get('bin') === '1',
  };
  const set = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true }
    );
  const [search, setSearch] = useState(filters.q);
  const [exporting, setExporting] = useState(false);

  const query = {
    q: filters.q || undefined,
    status: filters.status || undefined,
    form: filters.form || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    assignee: filters.assignee || undefined,
  };
  const list = useQuery({
    queryKey: [...LEADS_KEY, 'list', filters],
    queryFn: () => api('GET /api/v1/leads', { query: { ...query, deleted: filters.deleted ? 'true' : undefined, limit: 200 } }),
    placeholderData: keepPreviousData,
  });
  const people = useQuery({ queryKey: [...LEADS_KEY, 'assignees'], queryFn: () => api('GET /api/v1/leads/assignees'), staleTime: 5 * 60_000 });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, fileName } = await withStepUp(() => downloadFile('GET /api/v1/leads/export', { query }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Файл выгружен. Выгрузка записана в журнал действий.');
    } catch (e) {
      if (!(e instanceof Cancelled)) toast.error(e);
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo(
    () => [
      col.accessor('reference', {
        header: 'Заявка',
        cell: (c) => (
          <Link to={`/leads/${c.row.original.id}`} className="block min-w-32 font-medium text-ink hover:text-accent hover:underline" data-lead={c.getValue()}>
            <span className="font-mono text-[13px]">{c.getValue()}</span>
            <span className="block text-xs font-normal text-ink-muted">{formatDateTime(c.row.original.createdAt)}</span>
          </Link>
        ),
      }),
      col.accessor('name', {
        header: 'Контакт',
        cell: (c) => (
          <span className="block min-w-40">
            <span className="font-medium">{c.getValue() ?? '—'}</span>
            {c.row.original.company ? <span className="block text-xs text-ink-muted">{c.row.original.company}</span> : null}
            <span className="block text-xs text-ink-muted" dir="ltr">
              {[c.row.original.phone, c.row.original.email].filter(Boolean).join(' · ')}
            </span>
            {c.row.original.duplicates ? <span className="block text-xs text-warn">Ещё заявок с этими контактами: {c.row.original.duplicates}</span> : null}
          </span>
        ),
      }),
      col.accessor('formType', {
        header: 'Откуда',
        cell: (c) => (
          <span className="block min-w-36 text-xs">
            {LEAD_FORM_LABELS[c.getValue()]}
            {c.row.original.topic ? <span className="block text-ink-muted">{c.row.original.topic}</span> : null}
          </span>
        ),
      }),
      col.accessor('status', { header: 'Статус', cell: (c) => <Status tone={LEAD_STATUS_TONES[c.getValue()]}>{LEAD_STATUS_LABELS[c.getValue()]}</Status> }),
      col.accessor('assignee', { header: 'Ответственный', enableSorting: false, cell: (c) => <span className="text-xs">{c.getValue()?.name ?? '—'}</span> }),
      col.accessor('notification', {
        header: () => <span className="sr-only">Уведомление</span>,
        enableSorting: false,
        cell: (c) =>
          c.getValue() === 'failed' ? (
            <span className="inline-flex items-center gap-1 text-xs text-danger" title={NOTIFICATION_LABELS.failed}>
              <AlertTriangle className="size-3.5" aria-hidden />
              <span className="sr-only">{NOTIFICATION_LABELS.failed}</span>
            </span>
          ) : null,
      }),
    ],
    []
  );

  const counts = list.data?.byStatus ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader
        title="Заявки"
        description="Заявки из форм сайта. Контакты хранятся в зашифрованном виде; спам сохраняется со статусом «Спам», чтобы ничего не потерялось."
        crumbs={[{ label: 'Заявки' }]}
        actions={
          can('leads.export') ? (
            <Button icon={<Download className="size-4" aria-hidden />} loading={exporting} onClick={() => void exportCsv()} disabled={filters.deleted}>
              Выгрузить CSV
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4">
        <div role="group" aria-label="Статус" className="flex flex-wrap gap-1.5" data-status-filter>
          <button
            type="button"
            aria-pressed={!filters.status && !filters.deleted}
            onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('status'); n.delete('bin'); return n; }, { replace: true })}
            className="rounded-md border border-line-strong px-2.5 py-1 text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            Все · {total}
          </button>
          {LEAD_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={filters.status === st && !filters.deleted}
              onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('status', st); n.delete('bin'); return n; }, { replace: true })}
              className="rounded-md border border-line-strong px-2.5 py-1 text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
            >
              {LEAD_STATUS_LABELS[st]} · {counts[st] ?? 0}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={filters.deleted}
            onClick={() => set('bin', filters.deleted ? '' : '1')}
            className="rounded-md border border-line-strong px-2.5 py-1 text-[13px] text-ink-muted aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            Корзина
          </button>
        </div>
        <Card>
          <form
            className="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              set('q', search.trim());
            }}
          >
            <label className="relative block min-w-56 flex-1">
              <span className="sr-only">Поиск</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => set('q', search.trim())} placeholder="Имя, компания, номер; точный e-mail или телефон" className="pl-9" aria-label="Поиск" />
            </label>
            <label className="block w-full sm:w-48">
              <span className="sr-only">Форма</span>
              <Select aria-label="Форма" value={filters.form} onChange={(e) => set('form', e.target.value)}>
                <option value="">Все формы</option>
                {LEAD_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {LEAD_FORM_LABELS[f]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block w-full sm:w-48">
              <span className="sr-only">Ответственный</span>
              <Select aria-label="Ответственный" value={filters.assignee} onChange={(e) => set('assignee', e.target.value)}>
                <option value="">Все ответственные</option>
                <option value="none">Без ответственного</option>
                {(people.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-xs text-ink-muted">
              С
              <Input type="date" aria-label="С даты" value={filters.from} onChange={(e) => set('from', e.target.value)} className="mt-1 w-40" />
            </label>
            <label className="block text-xs text-ink-muted">
              По
              <Input type="date" aria-label="По дату" value={filters.to} onChange={(e) => set('to', e.target.value)} className="mt-1 w-40" />
            </label>
            <button type="submit" hidden />
          </form>
          {filters.deleted ? <Alert tone="info" className="mb-3">В корзине заявки хранятся 30 дней, потом их личные данные удаляются (обезличивание). Восстановить можно на странице заявки.</Alert> : null}
          {list.isPending ? (
            <LoadingBlock />
          ) : list.isError ? (
            <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
              Не удалось загрузить заявки.
            </Alert>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink-muted" aria-live="polite">
                {list.data.total} {plural(list.data.total, 'заявка', 'заявки', 'заявок')}
                {list.data.total > list.data.items.length ? ` · показаны последние ${list.data.items.length}; уточните фильтры` : ''}
              </p>
              <DataTable data={list.data.items} columns={columns} getRowId={(r) => r.id} caption="Заявки" empty={filters.deleted ? 'Корзина пуста.' : 'Заявок с такими условиями нет.'} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
