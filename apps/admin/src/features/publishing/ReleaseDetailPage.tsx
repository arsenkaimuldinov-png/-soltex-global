/**
 * One release (or preview build): build steps (polled while it builds), what changes compared with
 * the live site, translations, checks (blocking errors apart from warnings), history of events,
 * technical details under «Дополнительно», and the actions — preview link, «Опубликовать» (ready
 * release), «Вернуть на сайт» (retired release, step-up), «Собрать заново» (failed). Every action
 * that changes the live site asks for confirmation first.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ExternalLink } from 'lucide-react';
import { TRANSLATED_LOCALES, type ReleaseStatus } from '@soltex/core/domain';
import { api, isApiError } from '../../lib/api/client';
import { Cancelled } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { useStepUp } from '../../lib/step-up';
import { Advanced } from '../../components/ui/Advanced';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { LOCALE_INFO, TYPE_LABELS, type TranslatableType } from '../translations/model';
import { ReleaseStatusBadge } from './PublishingOverviewPage';
import { BUILD_STEPS, describeValidation, FAILURE_STEP_LABELS, IN_PROGRESS, RELEASE_EVENT_LABELS, RELEASE_STATUS_LABELS, stepIndex } from './model';

const CHANGE_LABELS = { added: 'Появится', changed: 'Изменится', removed: 'Будет снято' } as const;
const STATE_WORDS = { outdated: 'устарел', in_progress: 'в работе', missing: 'нет перевода' } as const;

export const releaseKey = (id: string) => ['publishing', 'release', id] as const;

export function ReleaseDetailPage() {
  const { id = '' } = useParams();
  return <ReleaseDetail key={id} id={id} />;
}

function ReleaseDetail({ id }: { id: string }) {
  const can = useCan();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const withStepUp = useStepUp();
  const [confirm, setConfirm] = useState<'activate' | 'rollback' | 'retry' | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const q = useQuery({
    queryKey: releaseKey(id),
    queryFn: () => api('GET /api/v1/releases/{id}', { params: { id } }),
    retry: false,
    refetchInterval: (query) => (query.state.data && IN_PROGRESS.includes(query.state.data.status) ? 2000 : false),
  });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError)
    return (
      <>
        <PageHeader title="Релиз" crumbs={[{ label: 'Публикация', to: '/publishing' }, { label: 'Релизы', to: '/publishing/releases' }, { label: 'Релиз' }]} />
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          {isApiError(q.error, 'not_found') ? 'Такого релиза нет.' : 'Не удалось загрузить релиз.'}
        </Alert>
      </>
    );
  const r = q.data;
  const isPreview = r.kind === 'preview';
  const building = IN_PROGRESS.includes(r.status);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['publishing'] });
  };

  const openPreview = async () => {
    // Open the tab synchronously (popup blockers), then point it at the one-time link.
    const win = window.open('about:blank', '_blank');
    if (win) win.opener = null;
    setOpening(true);
    try {
      const link = await api('POST /api/v1/releases/{id}/preview', { params: { id }, body: {} });
      if (win) win.location.href = link.url;
      else window.location.assign(link.url);
    } catch (e) {
      win?.close();
      toast.error(e);
    } finally {
      setOpening(false);
    }
  };

  const act = async (action: 'activate' | 'rollback' | 'retry') => {
    setBusy(true);
    try {
      if (action === 'retry') {
        const next = await api('POST /api/v1/releases/{id}/retry', { params: { id } });
        toast.success('Запущена повторная сборка.');
        refresh();
        navigate(`/publishing/releases/${next.id}`);
      } else {
        const call = () =>
          api(action === 'activate' ? 'POST /api/v1/releases/{id}/activate' : 'POST /api/v1/releases/{id}/rollback', {
            params: { id },
            headers: { 'if-match': `"${r.version}"` },
          });
        await (action === 'rollback' ? withStepUp(call) : call());
        toast.success(action === 'activate' ? `Релиз ${r.key} опубликован.` : `Сайт возвращён к релизу ${r.key}.`);
        refresh();
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) {
        toast.error(e);
        refresh();
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const failed = r.status === 'failed';
  const current = stepIndex(r.status);
  const added = r.changes.filter((c) => c.change === 'added').length;
  const removed = r.changes.filter((c) => c.change === 'removed').length;
  const changed = r.changes.length - added - removed;

  return (
    <>
      <PageHeader
        title={isPreview ? `Предпросмотр ${r.key}` : `Релиз ${r.key}`}
        description={
          isPreview
            ? 'Сборка текущих черновиков для проверки. Предпросмотр не может попасть на сайт.'
            : r.isActive
              ? 'Этот релиз сейчас на сайте.'
              : RELEASE_STATUS_LABELS[r.status as ReleaseStatus]
        }
        crumbs={[{ label: 'Публикация', to: '/publishing' }, { label: 'Релизы', to: '/publishing/releases' }, { label: r.key }]}
        actions={
          <>
            <ReleaseStatusBadge status={r.status} />
            {r.hasArtifact ? (
              <Button icon={<ExternalLink className="size-3.5" aria-hidden />} onClick={() => void openPreview()} loading={opening}>
                Открыть предпросмотр
              </Button>
            ) : null}
            {r.canActivate && can('content.publish') ? (
              <Button variant="primary" onClick={() => setConfirm('activate')} disabled={busy}>
                Опубликовать
              </Button>
            ) : null}
            {r.canRollback && can('system.rollback') ? (
              <Button variant="danger" onClick={() => setConfirm('rollback')} disabled={busy}>
                Вернуть на сайт
              </Button>
            ) : null}
            {failed && can('system.deploy') ? (
              <Button onClick={() => setConfirm('retry')} disabled={busy}>
                Собрать заново
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-4">
        {failed && r.failure ? (
          <Alert tone="danger">
            Сборка не удалась на шаге «{FAILURE_STEP_LABELS[r.failure.step] ?? r.failure.step}». {r.failure.message} Сайт не изменился.
          </Alert>
        ) : null}
        {r.status === 'superseded' ? <Alert tone="info">Этот релиз заменён более новым и уже не может быть опубликован.</Alert> : null}

        <Card title="Ход сборки">
          <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]" aria-label="Шаги сборки">
            {BUILD_STEPS.map((s, i) => {
              const done = !failed && (current > i || (!building && current === i));
              const now = building && current === i;
              return (
                <li key={s.status} className={cx('flex items-center gap-2', done ? 'text-ink' : now ? 'font-medium text-accent' : 'text-ink-muted')} aria-current={now ? 'step' : undefined}>
                  <span
                    className={cx(
                      'flex size-5 items-center justify-center rounded-full border text-[11px]',
                      done ? 'border-accent bg-accent text-white' : now ? 'border-accent' : 'border-line-strong'
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                  {now ? <span className="sr-only">(идёт)</span> : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-4">
            <Facts
              items={[
                { label: 'Создан', value: `${formatDateTime(r.createdAt)} · ${r.createdBy?.name ?? 'система'}` },
                { label: 'Сборка', value: r.buildStartedAt ? `${formatDateTime(r.buildStartedAt)}${r.buildFinishedAt ? ` — ${formatDateTime(r.buildFinishedAt)}` : ''}` : '—' },
                { label: 'Опубликован', value: r.activatedAt ? `${formatDateTime(r.activatedAt)} · ${r.activatedBy?.name ?? '—'}` : '—' },
                { label: 'Материалов в снимке', value: String(r.snapshot.records) },
              ]}
            />
          </div>
        </Card>

        <Card
          title={isPreview ? 'Отличия от сайта' : 'Что изменится на сайте'}
          description={r.previousRelease ? `По сравнению с релизом ${r.previousRelease.key}.` : 'По сравнению с текущим сайтом.'}
        >
          {r.changes.length ? (
            <>
              <p className="mb-2 text-[13px] text-ink-muted">
                Появится: {added} · изменится: {changed} · будет снято: {removed}
              </p>
              <ul className="divide-y divide-line text-[13px]" aria-label="Изменения">
                {r.changes.map((c) => (
                  <li key={`${c.type}/${c.key}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className={cx('w-24 shrink-0 text-xs font-medium', c.change === 'removed' ? 'text-danger' : c.change === 'added' ? 'text-accent' : 'text-ink-muted')}>
                      {CHANGE_LABELS[c.change]}
                    </span>
                    <span className="min-w-0 flex-1">
                      {c.title}
                      <span className="block text-xs text-ink-muted">{TYPE_LABELS[c.type as TranslatableType]}</span>
                    </span>
                    {c.revision ? <span className="text-xs text-ink-muted tabular-nums">версия {c.revision}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">Содержимое не отличается от сайта.</p>
          )}
        </Card>

        <Card title="Проверки" description="Ошибки блокируют публикацию. Предупреждения не мешают, но их стоит просмотреть.">
          {r.validation.errors.length ? (
            <div className="mb-3">
              <h3 className="mb-1 text-[13px] font-semibold text-danger">Ошибки ({r.validation.errors.length})</h3>
              <ul className="list-disc space-y-1 pl-5 text-[13px]" aria-label="Ошибки">
                {r.validation.errors.map((e) => (
                  <li key={e}>{describeValidation(e)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {r.validation.warnings.length ? (
            <div>
              <h3 className="mb-1 text-[13px] font-semibold">Предупреждения ({r.validation.warnings.length})</h3>
              <ul className="list-disc space-y-1 pl-5 text-[13px]" aria-label="Предупреждения">
                {r.validation.warnings.map((w) => (
                  <li key={w}>{describeValidation(w)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!r.validation.errors.length && !r.validation.warnings.length ? (
            <p className="text-[13px] text-ink-muted">{building ? 'Проверки выполняются после сборки.' : 'Замечаний нет.'}</p>
          ) : null}
        </Card>

        <Card title="Переводы в релизе" description="Устаревший перевод показывает ранее утверждённый текст; без утверждённого перевода сайт показывает английский.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-[13px]">
              <caption className="sr-only">Переводы по языкам</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Язык</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Утверждено</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Устарело</th>
                  <th scope="col" className="py-2 pr-3 font-medium">В работе</th>
                  <th scope="col" className="py-2 font-medium">Нет перевода</th>
                </tr>
              </thead>
              <tbody>
                {TRANSLATED_LOCALES.map((l) => {
                  const c = r.translations.locales[l] ?? { approved: 0, outdated: 0, in_progress: 0, missing: 0 };
                  return (
                    <tr key={l} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        <span className="font-mono text-xs font-semibold">{LOCALE_INFO[l].short}</span> {LOCALE_INFO[l].name}
                      </th>
                      <td className="py-2 pr-3 tabular-nums">{c.approved}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.outdated}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.in_progress}</td>
                      <td className="py-2 tabular-nums">{c.missing}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {r.translations.attention.length ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-ink-muted">Материалы, где нужен перевод ({r.translations.attention.length})</summary>
              <ul className="mt-2 space-y-1">
                {r.translations.attention.map((a) => (
                  <li key={`${a.type}/${a.key}/${a.locale}`}>
                    {TYPE_LABELS[a.type as TranslatableType]} · {a.key} · {LOCALE_INFO[a.locale as keyof typeof LOCALE_INFO]?.short ?? a.locale}: {STATE_WORDS[a.state]}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <Card title="История релиза">
          <ol className="divide-y divide-line text-[13px]" aria-label="События">
            {r.events.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 py-2">
                <span className="w-36 shrink-0 text-ink-muted">{formatDateTime(e.at)}</span>
                <span className="min-w-0 flex-1">
                  {RELEASE_EVENT_LABELS[e.event] ?? e.event}
                  {e.actor ? <span className="text-ink-muted"> · {e.actor.name}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <Advanced className="mt-3">
            <Facts
              items={[
                { label: 'ID', value: <span className="font-mono text-xs">{r.id}</span> },
                { label: 'Снимок', value: <span className="font-mono text-xs break-all">{r.snapshot.sha256}</span> },
                ...(r.artifact
                  ? [
                      { label: 'Контрольная сумма', value: <span className="font-mono text-xs break-all">{r.artifact.checksum}</span> },
                      { label: 'Файлов / страниц', value: `${r.artifact.files} / ${r.artifact.pages}` },
                      { label: 'Размер', value: `${(r.artifact.bytes / 1024 / 1024).toFixed(1)} МБ` },
                    ]
                  : []),
              ]}
            />
          </Advanced>
        </Card>

        <p className="text-[13px] text-ink-muted">
          <Link to="/publishing/releases" className="text-accent hover:underline">
            ← Все релизы
          </Link>
        </p>
      </div>

      <ConfirmDialog
        open={confirm === 'activate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Опубликовать релиз ${r.key}?`}
        consequences={[
          `Сайт переключится на этот релиз сразу для всех посетителей (${r.changes.length ? `изменений: ${r.changes.length}` : 'содержимое не меняется'}).`,
          r.validation.warnings.length ? `Есть предупреждения: ${r.validation.warnings.length}. Они не блокируют публикацию.` : 'Проверки пройдены без предупреждений.',
          'Предыдущий релиз останется доступным для отката.',
        ]}
        confirmLabel="Опубликовать"
        destructive={false}
        busy={busy}
        onConfirm={() => void act('activate')}
      />
      <ConfirmDialog
        open={confirm === 'rollback'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Вернуть сайт к релизу ${r.key}?`}
        consequences={[
          'Сайт сразу покажет содержимое этого релиза; пересборки не будет.',
          'Изменения, опубликованные позже, исчезнут с сайта, но останутся в админке и попадут в следующий релиз.',
          'Нужно будет подтвердить действие вторым фактором.',
        ]}
        confirmLabel="Вернуть на сайт"
        busy={busy}
        onConfirm={() => void act('rollback')}
      />
      <ConfirmDialog
        open={confirm === 'retry'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Собрать релиз заново?"
        consequences={['Будет создан новый релиз из того же снимка содержимого.', 'Сайт не изменится, пока новый релиз не будет опубликован.']}
        confirmLabel="Собрать заново"
        destructive={false}
        busy={busy}
        onConfirm={() => void act('retry')}
      />
    </>
  );
}
