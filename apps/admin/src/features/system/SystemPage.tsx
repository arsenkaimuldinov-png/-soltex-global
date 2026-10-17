/**
 * Система (review §X, approved §19; Phase L): whether the API answers and how fast; the database;
 * whether the worker is running; the queues (builds, e-mail, image copies); the site's release and
 * builds; disk space; mail. Backups, WAL and restore tests are set up with the server (Phase N) and
 * are shown as not configured until then. No paths or connection strings.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import type { SystemStatus } from '../../lib/api/schema.gen';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { LoadingBlock } from '../../components/ui/Spinner';
import { diskLow, formatBytes, formatDuration } from '../overview/model';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { ReleaseRef } from '../overview/ReleaseRef';
import { Status } from '../../components/ui/Status';

export async function checkApi(now: () => number = () => performance.now()): Promise<{ ok: boolean; ms: number; at: string }> {
  const start = now();
  try {
    const r = await api('GET /api/v1/health');
    return { ok: r.status === 'ok', ms: Math.round(now() - start), at: new Date().toISOString() };
  } catch {
    return { ok: false, ms: Math.round(now() - start), at: new Date().toISOString() };
  }
}

export function SystemPage() {
  const health = useQuery({ queryKey: ['system', 'health'], queryFn: () => checkApi(), refetchInterval: 30_000 });
  const status = useQuery({ queryKey: ['system', 'status'], queryFn: () => api('GET /api/v1/system/status'), refetchInterval: 30_000 });
  const h = health.data;
  return (
    <>
      <PageHeader
        title="Система"
        description="Состояние серверной части админки."
        crumbs={[{ label: 'Администрирование' }, { label: 'Система' }]}
        actions={
          <Button
            size="sm"
            icon={<RefreshCw className="size-3.5" aria-hidden />}
            loading={health.isFetching || status.isFetching}
            onClick={() => {
              void health.refetch();
              void status.refetch();
            }}
          >
            Проверить
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Сервер админки" description="Проверяется автоматически каждые 30 секунд.">
          <Facts
            items={[
              {
                label: 'Состояние',
                value: !h ? <Status tone="neutral">Проверяется…</Status> : h.ok ? <Status tone="ok">Работает</Status> : <Status tone="danger">Нет ответа</Status>,
              },
              { label: 'Время ответа', value: h?.ok ? `${h.ms} мс` : '—' },
              { label: 'Проверено', value: h ? formatDateTime(h.at) : '—' },
            ]}
          />
        </Card>
        {status.isPending ? <LoadingBlock /> : status.isError ? <Alert tone="danger">Не удалось получить состояние системы.</Alert> : <StatusCards s={status.data} />}
      </div>
    </>
  );
}

function StatusCards({ s }: { s: SystemStatus }) {
  const build = (b: SystemStatus['site']['lastSuccessfulBuild']) =>
    b ? (
      <span>
        <span className="font-mono text-xs break-all">{b.key}</span>
        <span className="block text-xs text-ink-muted">
          {formatDateTime(b.at)}
          {b.durationSeconds !== null ? ` · ${formatDuration(b.durationSeconds)}` : ''}
        </span>
        {b.reason ? <span className="block text-xs text-ink-muted">{b.reason}</span> : null}
      </span>
    ) : (
      '—'
    );
  return (
    <>
      <Card title="База данных">
        <Facts
          items={[
            { label: 'Состояние', value: s.database.ok ? <Status tone="ok">Работает</Status> : <Status tone="danger">Нет связи</Status> },
            { label: 'Время ответа', value: `${s.database.latencyMs} мс` },
            { label: 'Версия PostgreSQL', value: s.database.version ?? '—' },
            { label: 'Размер', value: s.database.sizeBytes !== null ? formatBytes(s.database.sizeBytes) : '—' },
          ]}
        />
      </Card>
      <Card title="Обработчик задач" description="Собирает релизы сайта, готовит копии изображений, отправляет письма и обезличивает старые заявки.">
        <Facts
          items={[
            {
              label: 'Состояние',
              value: s.worker.running ? <Status tone="ok">Работает</Status> : <Status tone="danger">Не запущен</Status>,
            },
            { label: 'Запущен', value: s.worker.since ? formatDateTime(s.worker.since) : '—' },
            { label: 'В очереди', value: `сборок: ${s.queue.builds} · писем: ${s.queue.mail} · копий изображений: ${s.queue.imageCopies}` },
          ]}
        />
        {!s.worker.running ? <p className="mt-2 text-xs text-danger">Без обработчика релизы не собираются и письма не отправляются. Его запускает администратор сервера.</p> : null}
        {s.queue.mailFailed ? <p className="mt-2 text-xs text-warn">Писем с ошибкой отправки: {s.queue.mailFailed}. Они отправятся повторно автоматически.</p> : null}
      </Card>
      <Card
        title="Сайт"
        actions={
          <Link to="/publishing/releases" className="text-[13px] text-accent hover:underline">
            Релизы
          </Link>
        }
      >
        <Facts
          items={[
            { label: 'На сайте', value: <ReleaseRef release={s.site.active} /> },
            { label: 'Последняя успешная сборка', value: build(s.site.lastSuccessfulBuild) },
            { label: 'Последняя неудачная сборка', value: build(s.site.lastFailedBuild) },
          ]}
        />
      </Card>
      <Card title="Место на диске">
        {s.disk.length ? (
          <Facts
            items={s.disk.map((d) => ({
              label: d.label,
              value: diskLow(d) ? (
                <Status tone="warn">{`Свободно ${formatBytes(d.freeBytes)} из ${formatBytes(d.totalBytes)}`}</Status>
              ) : (
                `Свободно ${formatBytes(d.freeBytes)} из ${formatBytes(d.totalBytes)}`
              ),
            }))}
          />
        ) : (
          <p className="text-[13px] text-ink-muted">Папки релизов и медиатеки ещё не созданы.</p>
        )}
      </Card>
      <Card title="Почта">
        <Facts
          items={[
            { label: 'Отправка писем', value: s.mail.configured ? <Status tone="ok">Настроена</Status> : <Status tone="warn">Не настроена</Status> },
            { label: 'Получатели заявок', value: s.mail.recipients ? String(s.mail.recipients) : 'не указаны' },
          ]}
        />
        {!s.mail.configured ? <p className="mt-2 text-xs text-ink-muted">Пока почта не настроена, уведомления ждут в очереди и ничего не теряется.</p> : null}
      </Card>
      <Card title="Резервные копии">
        <Facts
          items={[
            {
              label: 'Состояние',
              value: !s.backups.configured ? (
                <Status tone="neutral">Не настроены</Status>
              ) : s.backups.stale ? (
                <Status tone="danger">{s.backups.lastSuccessAt ? 'Давно не было' : 'Ещё не было'}</Status>
              ) : (
                <Status tone="ok">Работают</Status>
              ),
            },
            ...(s.backups.configured ? [{ label: 'Последняя успешная', value: s.backups.lastSuccessAt ? formatDateTime(s.backups.lastSuccessAt) : '—' }] : []),
          ]}
        />
        <p className="mt-2 text-xs text-ink-muted">
          {!s.backups.configured
            ? 'Резервные копии настраиваются на сервере (docs/deploy-runbook-ru.md).'
            : s.backups.stale
              ? 'Ночной бэкап не выполнялся больше 36 часов — сообщите администратору сервера.'
              : 'База данных и медиатека копируются каждую ночь.'}
        </p>
      </Card>
      <p className="text-xs text-ink-muted md:col-span-2">Проверено {formatDateTime(s.checkedAt)}.</p>
    </>
  );
}
