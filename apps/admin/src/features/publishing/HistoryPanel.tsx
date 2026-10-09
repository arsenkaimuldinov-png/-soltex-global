/**
 * Revision history of one record (Phase G): timeline with author and time, the current version
 * marked, view and compare dialogs (structured, field by field and language by language — never
 * raw JSON), and «Восстановить как новую версию» with a confirmation. Restoring creates a new
 * working version; the live site changes only with the next release.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Select } from '../../components/ui/Field';
import { Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { LOCALE_INFO, type TranslatableType } from '../translations/model';
import { historyPath, pathLabel, REVISION_KIND_LABELS, showValue } from './model';

type Revision = {
  id: number;
  entityType: TranslatableType;
  entityId: string;
  number: number;
  kind: keyof typeof REVISION_KIND_LABELS;
  locale: string | null;
  title: string;
  fields: string[];
  restoredFrom: number | null;
  createdAt: string;
  author: { id: string; name: string } | null;
  current: boolean;
};

const localeLabel = (l: string | null) => (l ? LOCALE_INFO[l as keyof typeof LOCALE_INFO]?.short ?? l.toUpperCase() : '—');

export const revisionsKey = (type: string, id: string) => ['publishing', 'revisions', type, id] as const;

export function revisionLine(r: Pick<Revision, 'kind' | 'locale' | 'restoredFrom'>): string {
  const base = REVISION_KIND_LABELS[r.kind];
  if (r.kind === 'restore' && r.restoredFrom) return `${base} из версии ${r.restoredFrom}`;
  if (r.locale) return `${base} · ${localeLabel(r.locale)}`;
  return base;
}

export function HistoryPanel({
  type,
  id,
  entityVersion,
  archived,
  pageSize = 8,
  full = false,
  onRestored,
}: {
  type: TranslatableType;
  id: string;
  entityVersion: number;
  archived: boolean;
  pageSize?: number;
  full?: boolean;
  onRestored: () => void;
}) {
  const can = useCan();
  const toast = useToast();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [compare, setCompare] = useState<Revision | null>(null);
  const [view, setView] = useState<Revision | null>(null);
  const [restore, setRestore] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    // The record's version is part of the key: every save, publish or translation change refreshes the history.
    queryKey: [...revisionsKey(type, id), entityVersion, offset, pageSize],
    queryFn: () => api('GET /api/v1/revisions', { query: { type, entity: id, limit: pageSize, offset } }),
    placeholderData: keepPreviousData,
  });

  const doRestore = async (r: Revision) => {
    setBusy(true);
    try {
      await api(`POST /api/v1/content/${type}/{id}/revisions/{n}/restore` as 'POST /api/v1/content/projects/{id}/revisions/{n}/restore', {
        params: { id, n: r.number },
        headers: { 'if-match': `"${entityVersion}"` },
      });
      toast.success(`Версия ${r.number} восстановлена как новая версия. На сайт она попадёт со следующим релизом.`);
      setRestore(null);
      void qc.invalidateQueries({ queryKey: revisionsKey(type, id) });
      void qc.invalidateQueries({ queryKey: ['publishing'] });
      onRestored();
    } catch (e) {
      setRestore(null);
      if (isApiError(e, 'edit_conflict')) toast.error(e, 'Запись была изменена другим пользователем. Обновите страницу перед восстановлением.');
      else toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const items = (list.data?.items ?? []) as Revision[];
  const total = list.data?.total ?? 0;
  const canRestore = can('content.edit') && !archived;

  return (
    <Card
      title="История изменений"
      description="Каждое сохранение — новая версия. Восстановление создаёт ещё одну версию; история не перезаписывается, а сайт меняется только при публикации релиза."
      actions={
        !full ? (
          <Link to={historyPath(type, id)} className="text-[13px] font-medium text-accent hover:underline">
            Вся история
          </Link>
        ) : undefined
      }
    >
      {list.isPending ? (
        <LoadingBlock />
      ) : list.isError ? (
        <Alert tone="danger">Не удалось загрузить историю.</Alert>
      ) : (
        <>
          <ol className="divide-y divide-line" aria-label="Версии">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-[13px]" data-revision={r.number}>
                <span className="w-20 shrink-0 font-medium tabular-nums">Версия {r.number}</span>
                <span className="min-w-0 flex-1">
                  {revisionLine(r)}
                  {r.current ? (
                    <span className="ml-2">
                      <Badge tone="accent">Текущая</Badge>
                    </span>
                  ) : null}
                  <span className="block text-xs text-ink-muted">
                    {formatDateTime(r.createdAt)} · {r.author?.name ?? 'система'}
                    {r.fields.length ? ` · полей: ${r.fields.length}` : ''}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setView(r)}>
                    Просмотреть
                  </Button>
                  {!r.current ? (
                    <Button size="sm" onClick={() => setCompare(r)}>
                      Сравнить с текущей
                    </Button>
                  ) : null}
                  {!r.current && canRestore ? (
                    <Button size="sm" onClick={() => setRestore(r)}>
                      Восстановить
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          {total > pageSize ? (
            full ? (
              <nav aria-label="Страницы истории" className="mt-3 flex items-center gap-3 text-[13px] text-ink-muted">
                <span>
                  {offset + 1}–{Math.min(offset + pageSize, total)} из {total}
                </span>
                <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
                  Новее
                </Button>
                <Button size="sm" disabled={offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>
                  Старше
                </Button>
              </nav>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">Показаны последние {pageSize} из {total} версий.</p>
            )
          ) : null}
        </>
      )}
      {compare ? <CompareDialog type={type} id={id} revision={compare} onClose={() => setCompare(null)} /> : null}
      {view ? <ViewDialog type={type} id={id} revision={view} onClose={() => setView(null)} /> : null}
      <ConfirmDialog
        open={!!restore}
        onOpenChange={(o) => !o && setRestore(null)}
        title={restore ? `Восстановить версию ${restore.number}?` : ''}
        consequences={[
          'Тексты, изображения и связи этой версии станут текущей рабочей версией — на всех языках.',
          'Сохраняется новая версия: текущая остаётся в истории, её можно вернуть.',
          'Статус записи и адрес страницы не меняются.',
          'Сайт не изменится, пока не будет опубликован новый релиз.',
          'Если английский текст изменится, утверждённые переводы будут отмечены как устаревшие.',
        ]}
        confirmLabel="Восстановить"
        destructive={false}
        busy={busy}
        onConfirm={() => restore && void doRestore(restore)}
      />
    </Card>
  );
}

function CompareDialog({ type, id, revision, onClose }: { type: TranslatableType; id: string; revision: Revision; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['publishing', 'compare', type, id, revision.number],
    queryFn: () => api(`GET /api/v1/content/${type}/{id}/revisions/{n}/compare` as 'GET /api/v1/content/projects/{id}/revisions/{n}/compare', { params: { id, n: revision.number }, query: { with: 'current' } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Версия ${revision.number} → текущая`} description="Поля, которые отличаются, по языкам. Слева — выбранная версия, справа — текущая." size="xl">
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger">Не удалось сравнить версии.</Alert>
      ) : q.data.entries.length === 0 ? (
        <p className="text-[13px]">Отличий нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[13px]">
            <caption className="sr-only">Отличия версий</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Поле</th>
                <th scope="col" className="py-2 pr-3 font-medium">Язык</th>
                <th scope="col" className="py-2 pr-3 font-medium">Версия {q.data.from}</th>
                <th scope="col" className="py-2 font-medium">Текущая (версия {q.data.to})</th>
              </tr>
            </thead>
            <tbody>
              {q.data.entries.map((e, i) => (
                <tr key={`${e.path}:${e.locale}:${i}`} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {pathLabel(type, e.path)}
                  </th>
                  <td className="py-2 pr-3 font-mono text-xs">{localeLabel(e.locale)}</td>
                  <td className="py-2 pr-3 break-words whitespace-pre-wrap text-danger" lang={e.locale ?? undefined} dir={e.locale === 'ar' ? 'rtl' : undefined}>
                    {showValue(e.before)}
                  </td>
                  <td className="py-2 break-words whitespace-pre-wrap text-ok" lang={e.locale ?? undefined} dir={e.locale === 'ar' ? 'rtl' : undefined}>
                    {showValue(e.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data.truncated ? <p className="mt-2 text-xs text-ink-muted">Показаны первые 400 отличий.</p> : null}
        </div>
      )}
    </Dialog>
  );
}

function ViewDialog({ type, id, revision, onClose }: { type: TranslatableType; id: string; revision: Revision; onClose: () => void }) {
  const [lang, setLang] = useState('en');
  const q = useQuery({
    queryKey: ['publishing', 'revision', type, id, revision.number],
    queryFn: () => api(`GET /api/v1/content/${type}/{id}/revisions/{n}` as 'GET /api/v1/content/projects/{id}/revisions/{n}', { params: { id, n: revision.number } }),
  });
  const rows = useMemo(() => (q.data?.values ?? []).filter((v) => v.locale === null || v.locale === lang), [q.data, lang]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Версия ${revision.number}: ${revision.title}`}
      description={`${revisionLine(revision)} · ${formatDateTime(revision.createdAt)} · ${revision.author?.name ?? 'система'}`}
      size="xl"
    >
      <label className="mb-3 block w-48">
        <span className="sr-only">Язык</span>
        <Select aria-label="Язык" value={lang} onChange={(e) => setLang(e.target.value)}>
          {Object.entries(LOCALE_INFO).map(([code, l]) => (
            <option key={code} value={code}>
              {l.short} · {l.name}
            </option>
          ))}
        </Select>
      </label>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger">Не удалось загрузить версию.</Alert>
      ) : (
        <dl className="divide-y divide-line text-[13px]">
          {rows.map((v, i) => (
            <div key={`${v.path}:${i}`} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[14rem_1fr]">
              <dt className="font-medium text-ink-muted">{pathLabel(type, v.path)}</dt>
              <dd className="break-words whitespace-pre-wrap" lang={v.locale ?? undefined} dir={v.locale === 'ar' ? 'rtl' : undefined}>
                {showValue(v.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Dialog>
  );
}
