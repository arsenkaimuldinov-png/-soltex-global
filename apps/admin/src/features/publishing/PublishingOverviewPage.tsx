/**
 * «Публикация · Обзор»: what is live (active release), what is being built, which records changed
 * since the live release, recent releases and failed builds. «Создать релиз» (content.publish) and
 * «Предпросмотр черновиков» start builds; nothing goes live from this page.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card, EmptyState, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { editorPath, IN_PROGRESS, PREVIEW_PERMISSIONS, RELEASE_STATUS_LABELS, RELEASE_STATUS_TONES, TYPE_LABELS } from './model';
import type { ReleaseStatus } from '@soltex/core/domain';
import type { TranslatableType } from '../translations/model';

export const OVERVIEW_KEY = ['publishing', 'overview'] as const;

export function useCreateBuild() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const create = async (kind: 'release' | 'preview') => {
    setBusy(true);
    try {
      const rel = await api(kind === 'release' ? 'POST /api/v1/releases' : 'POST /api/v1/previews', { body: {} });
      void qc.invalidateQueries({ queryKey: ['publishing'] });
      toast.success(kind === 'release' ? 'Релиз создан: идёт сборка' : 'Собирается предпросмотр');
      navigate(`/publishing/releases/${rel.id}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return { create, busy };
}

export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  return <Status tone={RELEASE_STATUS_TONES[status]}>{RELEASE_STATUS_LABELS[status]}</Status>;
}

export function PublishingOverviewPage() {
  const can = useCan();
  const q = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => api('GET /api/v1/publishing/overview'),
    refetchInterval: (query) => (query.state.data?.running.length ? 3000 : false),
  });
  const { create, busy } = useCreateBuild();
  const [confirm, setConfirm] = useState(false);
  const canPreview = PREVIEW_PERMISSIONS.some((p) => can(p));

  return (
    <>
      <PageHeader
        title="Публикация"
        description="Сайт показывает только опубликованный релиз. Изменения в «Контенте» и «Переводах» попадают на сайт со следующим релизом."
        crumbs={[{ label: 'Публикация' }, { label: 'Обзор' }]}
        actions={
          <>
            {canPreview ? (
              <Button onClick={() => void create('preview')} loading={busy}>
                Предпросмотр черновиков
              </Button>
            ) : null}
            {can('content.publish') ? (
              <Button variant="primary" onClick={() => setConfirm(true)} disabled={busy}>
                Создать релиз
              </Button>
            ) : null}
          </>
        }
      />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          Не удалось загрузить обзор публикации.
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Сейчас на сайте">
              {q.data.active ? (
                <div className="space-y-1 text-[13px]" data-active-release>
                  <Link to={`/publishing/releases/${q.data.active.id}`} className="font-mono font-medium text-accent hover:underline">
                    {q.data.active.key}
                  </Link>
                  <p className="text-ink-muted">
                    Опубликован {formatDateTime(q.data.active.activatedAt)}
                    {q.data.active.activatedBy ? ` · ${q.data.active.activatedBy.name}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">Через систему публикации ещё ничего не публиковалось: сайт собран из исходного содержимого.</p>
              )}
            </Card>
            <Card title="Сборка">
              {q.data.running.length ? (
                <ul className="space-y-2 text-[13px]" aria-label="Идущие сборки">
                  {q.data.running.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                      <ReleaseStatusBadge status={r.status} />
                      <Link to={`/publishing/releases/${r.id}`} className="font-mono text-accent hover:underline">
                        {r.key}
                      </Link>
                      <span className="text-ink-muted">{r.kind === 'preview' ? 'предпросмотр' : 'релиз'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">Сейчас ничего не собирается.</p>
              )}
              {q.data.lastSuccessful ? (
                <p className="mt-3 text-xs text-ink-muted">
                  Последняя успешная публикация: {q.data.lastSuccessful.key}, {formatDateTime(q.data.lastSuccessful.activatedAt)}
                </p>
              ) : null}
            </Card>
          </div>

          <Card title="Не опубликованные изменения" description="Материалы, текущая версия которых отличается от версии на сайте.">
            {q.data.pending.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-[13px]">
                  <caption className="sr-only">Не опубликованные изменения</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-muted">
                      <th scope="col" className="py-2 pr-3 font-medium">Материал</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Версия</th>
                      <th scope="col" className="py-2 font-medium">Изменено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.pending.map((p) => (
                      <tr key={`${p.type}/${p.key}`} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={editorPath(p.type as TranslatableType, p.id)} className="font-medium text-accent hover:underline">
                            {p.title}
                          </Link>
                          <span className="block text-xs text-ink-muted">
                            {TYPE_LABELS[p.type as TranslatableType]}
                            {p.status !== 'published' ? ' · снимается с сайта' : ''}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {p.liveRevision ? `${p.liveRevision} → ${p.revision}` : `новая (${p.revision})`}
                        </td>
                        <td className="py-2 whitespace-nowrap">{formatDateTime(p.changedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">{q.data.active ? 'Всё опубликованное уже на сайте.' : 'Опубликуйте первый релиз, чтобы отслеживать изменения.'}</p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Последние релизы" actions={<Link to="/publishing/releases" className="text-[13px] font-medium text-accent hover:underline">Все релизы</Link>}>
              {q.data.recent.length ? <ReleaseMiniList items={q.data.recent} /> : <EmptyState title="Релизов пока нет" />}
            </Card>
            <Card title="Неудачные сборки">
              {q.data.failed.length ? <ReleaseMiniList items={q.data.failed} /> : <p className="text-[13px] text-ink-muted">Нет.</p>}
            </Card>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Создать релиз?"
        consequences={[
          'Сейчас будет зафиксирован снимок всех материалов, отмеченных к публикации, с их переводами.',
          'Снимок соберётся в готовый сайт и пройдёт проверки. Изменения, сделанные после этого, в релиз не войдут.',
          'На сайт ничего не попадёт, пока вы не нажмёте «Опубликовать» в готовом релизе.',
        ]}
        confirmLabel="Создать релиз"
        destructive={false}
        busy={busy}
        onConfirm={() => {
          setConfirm(false);
          void create('release');
        }}
      />
    </>
  );
}

function ReleaseMiniList({ items }: { items: Array<{ id: string; key: string; status: ReleaseStatus; createdAt: string; failure: { message: string } | null }> }) {
  return (
    <ul className="divide-y divide-line text-[13px]">
      {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <Link to={`/publishing/releases/${r.id}`} className="font-mono text-accent hover:underline">
            {r.key}
          </Link>
          <ReleaseStatusBadge status={r.status} />
          <span className="text-ink-muted">{formatDateTime(r.createdAt)}</span>
          {r.failure ? <span className="w-full text-xs text-danger">{r.failure.message}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export { IN_PROGRESS };
