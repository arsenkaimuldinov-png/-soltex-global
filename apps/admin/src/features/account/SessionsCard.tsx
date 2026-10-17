import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { api } from '../../lib/api/client';
import { describeDevice, formatDateTime, plural } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';

const SESSIONS_KEY = ['auth', 'sessions'] as const;

export function SessionsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api('GET /api/v1/auth/sessions') });
  const [ending, setEnding] = useState<{ id: string; device: string } | null>(null);
  const [endingOthers, setEndingOthers] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = sessions.data?.items ?? [];
  const others = items.filter((s) => !s.current).length;

  const run = async (fn: () => Promise<unknown>, ok: string, done: () => void) => {
    setBusy(true);
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success(ok);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
      done();
    }
  };

  return (
    <Card
      title="Активные сеансы"
      description="Браузеры, в которых выполнен вход. Сеанс завершается после 8 часов бездействия и не позже чем через 12 часов после входа."
      actions={
        others > 0 ? (
          <Button size="sm" onClick={() => setEndingOthers(true)}>
            Завершить другие сеансы
          </Button>
        ) : null
      }
    >
      {sessions.isPending ? (
        <LoadingBlock />
      ) : sessions.isError ? (
        <Alert tone="danger">Не удалось загрузить сеансы.</Alert>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((s) => {
            const device = describeDevice(s.userAgent);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <Monitor className="size-4 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                    {device}
                    {s.current ? <Badge tone="accent">Этот браузер</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Вход {formatDateTime(s.createdAt)} · активность {formatDateTime(s.lastSeenAt)}
                  </p>
                </div>
                {s.current ? null : (
                  <Button size="sm" variant="ghost" onClick={() => setEnding({ id: s.id, device })}>
                    Завершить
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(o) => !o && setEnding(null)}
        title={`Завершить сеанс «${ending?.device ?? ''}»?`}
        consequences={['В этом браузере потребуется войти заново.']}
        confirmLabel="Завершить сеанс"
        busy={busy}
        onConfirm={() => {
          const id = ending!.id;
          void run(() => api('POST /api/v1/auth/sessions/{id}/revoke', { params: { id } }), 'Сеанс завершён', () => setEnding(null));
        }}
      />
      <ConfirmDialog
        open={endingOthers}
        onOpenChange={setEndingOthers}
        title="Завершить другие сеансы?"
        consequences={[`Будет завершено ${others} ${plural(others, 'сеанс', 'сеанса', 'сеансов')}.`, 'Этот браузер останется в системе.']}
        confirmLabel="Завершить"
        busy={busy}
        onConfirm={() => void run(() => api('POST /api/v1/auth/sessions/revoke-others'), 'Другие сеансы завершены', () => setEndingOthers(false))}
      />
    </Card>
  );
}
