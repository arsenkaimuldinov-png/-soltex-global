/**
 * «SEO · Редиректы» (Phase I-2, docs/admin-seo.md §8): every rule with its source, status code,
 * languages, hit counter and the SEO checks of the next release; create / change / delete for
 * roles with redirects.manage. Rules reach the site with the next release.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CircleX, Plus } from 'lucide-react';
import { normalizeRedirectPath } from '@soltex/core/seo';
import { api, isApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { columnHelper, DataTable } from '../../components/ui/DataTable';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Field, FormError, Input, Select } from '../../components/ui/Field';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { saveErrorMessage } from '../content/shared';
import { describeSeoIssue, REDIRECT_SOURCE_LABELS, redirectErrorMessage, type SeoIssueView } from './model';

export const REDIRECTS_KEY = ['redirects'] as const;

interface RedirectRow {
  id: string;
  from: string;
  to: string;
  statusCode: 301 | 302;
  allLocales: boolean;
  source: string;
  hits: number;
  lastHitAt: string | null;
  version: number;
  updatedAt: string;
  issues: SeoIssueView[];
}

const col = columnHelper<RedirectRow>();

export function RedirectsPage() {
  const can = useCan();
  const manage = can('redirects.manage');
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<RedirectRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RedirectRow | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: [...REDIRECTS_KEY, 'list'],
    queryFn: () => api('GET /api/v1/redirects', { query: { limit: 200 } }),
    placeholderData: keepPreviousData,
  });
  const rows = (q.data?.items ?? []) as RedirectRow[];

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api('DELETE /api/v1/redirects/{id}', { params: { id: deleting.id }, headers: { 'if-match': `"${deleting.version}"` } });
      toast.success('Редирект удалён');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: REDIRECTS_KEY });
      void qc.invalidateQueries({ queryKey: ['seo'] });
    } catch (e) {
      toast.error(e, saveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      col.accessor('from', {
        header: 'Старый адрес',
        cell: (c) => (
          <span className="block min-w-40 font-mono text-xs break-all" dir="ltr">
            <span data-from>{c.getValue()}</span>
            {c.row.original.allLocales ? <span className="mt-0.5 block font-sans text-ink-muted">и на всех языках</span> : null}
          </span>
        ),
      }),
      col.accessor('to', { header: 'Новый адрес', cell: (c) => <span className="block min-w-40 font-mono text-xs break-all" dir="ltr">{c.getValue()}</span> }),
      col.accessor('statusCode', { header: 'Код', cell: (c) => <span className="tabular-nums" title={c.getValue() === 301 ? 'Постоянный' : 'Временный'}>{c.getValue()}</span> }),
      col.accessor('source', { header: 'Источник', cell: (c) => REDIRECT_SOURCE_LABELS[c.getValue()] ?? c.getValue() }),
      col.accessor('hits', {
        header: 'Переходы',
        cell: (c) => (
          <span className="block text-xs">
            <span className="tabular-nums">{c.getValue()}</span>
            {c.row.original.lastHitAt ? <span className="block text-ink-muted">{formatDateTime(c.row.original.lastHitAt)}</span> : null}
          </span>
        ),
      }),
      col.display({
        id: 'issues',
        header: 'Проверка',
        cell: (c) =>
          c.row.original.issues.length ? (
            <ul className="min-w-48 space-y-1 text-xs" data-redirect-issues>
              {c.row.original.issues.map((i, n) => (
                <li key={n} className="flex items-start gap-1.5" data-seo-issue={i.code}>
                  {i.severity === 'blocking' ? <CircleX className="size-3.5 shrink-0 text-danger" aria-label="Ошибка" /> : <AlertTriangle className="size-3.5 shrink-0 text-warn" aria-label="Предупреждение" />}
                  {describeSeoIssue(i)}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs whitespace-nowrap text-ok">В порядке</span>
          ),
      }),
      ...(manage
        ? [
            col.display({
              id: 'actions',
              header: () => <span className="sr-only">Действия</span>,
              cell: (c) => (
                <span className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c.row.original)} aria-label={`Изменить редирект ${c.row.original.from}`}>
                    Изменить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(c.row.original)} aria-label={`Удалить редирект ${c.row.original.from}`}>
                    Удалить
                  </Button>
                </span>
              ),
            }),
          ]
        : []),
    ],
    [manage]
  );

  return (
    <>
      <PageHeader
        title="Редиректы"
        description="Перенаправления со старых адресов на страницы сайта. Новые и изменённые правила начинают работать после публикации следующего релиза."
        crumbs={[{ label: 'SEO' }, { label: 'Редиректы' }]}
        actions={
          manage ? (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
              Добавить редирект
            </Button>
          ) : undefined
        }
      />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          Не удалось загрузить редиректы.
        </Alert>
      ) : (
        <div className="space-y-4">
          {q.data.issues.blocking ? (
            <Alert tone="danger">Есть ошибки в редиректах ({q.data.issues.blocking}): пока они не исправлены, новый релиз создать нельзя.</Alert>
          ) : null}
          {!manage ? <Alert tone="info">Ваша роль может только просматривать редиректы.</Alert> : null}
          <Card>
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              caption="Редиректы"
              searchText={(r) => `${r.from} ${r.to}`}
              searchLabel="Поиск по адресу"
              empty="Редиректов пока нет. Они появляются при смене адреса опубликованной страницы или добавляются вручную."
            />
          </Card>
        </div>
      )}
      {manage ? <RedirectDialog value={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Удалить редирект?"
        consequences={[
          `После публикации следующего релиза адрес ${deleting?.from ?? ''} будет отвечать «Страница не найдена».`,
          'Действие записывается в журнал.',
        ]}
        confirmLabel="Удалить"
        busy={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function RedirectDialog({ value, onClose }: { value: RedirectRow | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const existing = value && value !== 'new' ? value : null;
  const [form, setForm] = useState({ from: '', to: '', statusCode: '301', allLocales: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return;
    setForm(existing ? { from: existing.from, to: existing.to, statusCode: String(existing.statusCode), allLocales: existing.allLocales } : { from: '', to: '', statusCode: '301', allLocales: true });
    setErrors({});
    setFormError(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.from.trim()) errs.from = 'Укажите старый адрес.';
    if (!form.to.trim()) errs.to = 'Укажите новый адрес.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = { from: form.from, to: form.to, statusCode: Number(form.statusCode) as 301 | 302, allLocales: form.allLocales };
    setBusy(true);
    setFormError(null);
    try {
      const saved = existing
        ? await api('PATCH /api/v1/redirects/{id}', { params: { id: existing.id }, headers: { 'if-match': `"${existing.version}"` }, body })
        : await api('POST /api/v1/redirects', { body });
      toast.success(existing ? 'Редирект сохранён' : 'Редирект добавлен');
      if (saved.to !== normalizeRedirectPath(form.to)) toast.success(`Цепочка сокращена: редирект ведёт сразу на ${saved.to}`);
      void qc.invalidateQueries({ queryKey: REDIRECTS_KEY });
      void qc.invalidateQueries({ queryKey: ['seo'] });
      onClose();
    } catch (e) {
      const fe = isApiError(e) ? e.fieldErrors : [];
      if (fe.length) {
        const out: Record<string, string> = {};
        for (const x of fe) out[x.field === 'from' ? 'from' : 'to'] = redirectErrorMessage(x.message);
        setErrors(out);
      } else setFormError(isApiError(e, 'edit_conflict') ? 'Редирект изменил другой пользователь. Закройте окно и откройте его снова.' : saveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!value}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Изменить редирект' : 'Новый редирект'}
      description="Можно вставить полный адрес страницы сайта — он будет сокращён до пути."
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {existing ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormError message={formError} />
        <Field label="Старый адрес" hint="Путь, с которого перенаправлять, например /old-page" error={errors.from}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} className="font-mono" dir="ltr" spellCheck={false} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />}
        </Field>
        <Field label="Новый адрес" hint="Страница этого сайта, например /company. Внешние адреса не допускаются." error={errors.to}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} className="font-mono" dir="ltr" spellCheck={false} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />}
        </Field>
        <Field label="Тип" hint="301 — адрес изменился навсегда (передаёт позиции в поиске). 302 — временно.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: e.target.value })}>
              <option value="301">301 — постоянный</option>
              <option value="302">302 — временный</option>
            </Select>
          )}
        </Field>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={form.allLocales} onChange={(e) => setForm({ ...form, allLocales: e.target.checked })} />
          <span>
            <span className="font-medium">На всех языках</span>
            <span className="block text-ink-muted">Также /ru, /zh, /tr, /ar и /es + этот путь. Снимите, чтобы перенаправлять только указанный адрес (он может начинаться с языка, например /ru/…).</span>
          </span>
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

