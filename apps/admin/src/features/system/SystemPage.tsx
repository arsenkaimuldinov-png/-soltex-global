/**
 * Система (review §X, approved §19). Phase D shows what the API exposes today: whether the API
 * answers, and how fast. Builds, releases, disk, backups and the queue come with Phases G, L and N
 * (approved §23); no placeholder values are shown for them.
 */
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
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
  const h = health.data;
  return (
    <>
      <PageHeader
        title="Система"
        description="Состояние серверной части админки."
        crumbs={[{ label: 'Администрирование' }, { label: 'Система' }]}
        actions={
          <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={health.isFetching} onClick={() => void health.refetch()}>
            Проверить
          </Button>
        }
      />
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
      <p className="mt-4 text-[13px] text-ink-muted">
        Публикации сайта, резервные копии и место на диске появятся здесь вместе с публикацией и развёртыванием на сервере.
      </p>
    </>
  );
}
