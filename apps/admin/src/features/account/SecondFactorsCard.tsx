/**
 * Passkeys, authenticator app and recovery codes of the signed-in user. Adding a further factor,
 * removing one and regenerating codes need step-up (handled by useStepUp).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyRound, Plus, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { SessionView } from '../../lib/api/schema.gen';
import { formatDate, formatDateTime, plural } from '../../lib/format';
import { SESSION_KEY, useSessionView } from '../../lib/session';
import { useStepUp } from '../../lib/step-up';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Card, EmptyState } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Badge, Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { AddPasskeyForm } from '../security/AddPasskeyForm';
import { RecoveryCodesPanel } from '../security/RecoveryCodesPanel';
import { TotpSetup } from '../security/TotpSetup';

export const PASSKEYS_KEY = ['auth', 'passkeys'] as const;
type WithCodes = SessionView & { recoveryCodes?: string[] };

export function SecondFactorsCard() {
  const view = useSessionView();
  const qc = useQueryClient();
  const toast = useToast();
  const withStepUp = useStepUp();
  const passkeys = useQuery({ queryKey: PASSKEYS_KEY, queryFn: () => api('GET /api/v1/auth/passkeys') });

  const [adding, setAdding] = useState<'passkey' | 'totp' | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [disablingTotp, setDisablingTotp] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const { mfa } = view;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: SESSION_KEY });
    void qc.invalidateQueries({ queryKey: PASSKEYS_KEY });
  };
  const added = (result: WithCodes, message: string) => {
    setAdding(null);
    refresh();
    if (result.recoveryCodes?.length) setCodes(result.recoveryCodes);
    toast.success(message);
  };
  // The confirmation closes first, so a step-up dialog never opens on top of it.
  const act = async (fn: () => Promise<unknown>, ok: string, done: () => void) => {
    done();
    setBusy(true);
    try {
      await withStepUp(fn);
      refresh();
      toast.success(ok);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const items = passkeys.data?.items ?? [];
  const lastRequired = mfa.requirement === 'passkey' && items.length <= 1;

  return (
    <>
      <Card
        title="Ключи доступа"
        description="Вход по отпечатку, лицу, PIN-коду устройства или аппаратному ключу. Самый надёжный способ."
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setAdding('passkey')}>
            Добавить ключ
          </Button>
        }
      >
        {passkeys.isPending ? (
          <LoadingBlock />
        ) : passkeys.isError ? (
          <Alert tone="danger">Не удалось загрузить ключи доступа.</Alert>
        ) : items.length === 0 ? (
          <EmptyState title="Ключей доступа пока нет">{mfa.requirement === 'passkey' ? 'Для вашей роли ключ доступа обязателен.' : 'Добавьте ключ доступа, чтобы входить быстрее и надёжнее.'}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-3">
                <KeyRound className="size-4 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                    {k.name}
                    {k.backedUp ? <Badge>Синхронизируется между устройствами</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Добавлен {formatDate(k.createdAt)} · {k.lastUsedAt ? `последний вход ${formatDateTime(k.lastUsedAt)}` : 'ещё не использовался'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="size-3.5" aria-hidden />}
                  disabled={lastRequired}
                  title={lastRequired ? 'Это единственный ключ, а для вашей роли он обязателен. Сначала добавьте другой.' : undefined}
                  onClick={() => setRemoving({ id: k.id, name: k.name })}
                >
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Приложение-аутентификатор"
        description="Шестизначные коды в телефоне: запасной способ подтверждения."
        actions={
          mfa.totp ? (
            <Button size="sm" variant="ghost" onClick={() => setDisablingTotp(true)}>
              Отключить
            </Button>
          ) : (
            <Button size="sm" icon={<Smartphone className="size-3.5" aria-hidden />} onClick={() => setAdding('totp')}>
              Подключить
            </Button>
          )
        }
      >
        {mfa.totp ? <Status tone="ok">Подключено</Status> : <Status tone="neutral">Не подключено</Status>}
      </Card>

      <section id="recovery">
        <Card
          title="Резервные коды"
          description="Одноразовые коды для входа, если устройство с ключом или приложением потеряно."
          actions={
            mfa.enrolled ? (
              <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => setRegenerating(true)}>
                Создать новые
              </Button>
            ) : null
          }
        >
          {mfa.enrolled ? (
            <Status tone={mfa.recoveryCodesLeft > 3 ? 'ok' : 'warn'}>{`Осталось ${mfa.recoveryCodesLeft} ${plural(mfa.recoveryCodesLeft, 'код', 'кода', 'кодов')} из 10`}</Status>
          ) : (
            <p className="text-[13px] text-ink-muted">Коды появятся после подключения первого способа подтверждения.</p>
          )}
        </Card>
      </section>

      <Dialog open={adding === 'passkey'} onOpenChange={(o) => !o && setAdding(null)} title="Новый ключ доступа" description="Браузер попросит подтвердить действие отпечатком, лицом, PIN-кодом или аппаратным ключом.">
        <AddPasskeyForm onDone={(r) => added(r, 'Ключ доступа добавлен')} />
      </Dialog>
      <Dialog open={adding === 'totp'} onOpenChange={(o) => !o && setAdding(null)} title="Приложение-аутентификатор">
        <TotpSetup onDone={(r) => added(r, 'Приложение-аутентификатор подключено')} />
      </Dialog>
      <Dialog open={codes !== null} onOpenChange={() => undefined} title="Резервные коды" modalLock size="md">
        {codes ? <RecoveryCodesPanel codes={codes} email={view.user.email} doneLabel="Готово" onDone={() => setCodes(null)} /> : null}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Удалить ключ «${removing?.name ?? ''}»?`}
        consequences={['Войти с этим ключом будет нельзя.', 'Если устройство потеряно, удалите ключ сразу.', 'Потребуется подтверждение вторым фактором.']}
        confirmLabel="Удалить ключ"
        busy={busy}
        onConfirm={() => {
          const id = removing!.id;
          void act(() => api('DELETE /api/v1/auth/passkeys/{id}', { params: { id } }), 'Ключ доступа удалён', () => setRemoving(null));
        }}
      />
      <ConfirmDialog
        open={disablingTotp}
        onOpenChange={setDisablingTotp}
        title="Отключить приложение-аутентификатор?"
        consequences={['Коды из приложения перестанут приниматься.', 'Если это ваш единственный способ подтверждения, отключить его нельзя.', 'Потребуется подтверждение вторым фактором.']}
        confirmLabel="Отключить"
        busy={busy}
        onConfirm={() => void act(() => api('DELETE /api/v1/auth/mfa/totp'), 'Приложение-аутентификатор отключено', () => setDisablingTotp(false))}
      />
      <ConfirmDialog
        open={regenerating}
        onOpenChange={setRegenerating}
        title="Создать новые резервные коды?"
        consequences={['Все прежние коды перестанут действовать.', 'Новые коды будут показаны один раз.', 'Потребуется подтверждение вторым фактором.']}
        confirmLabel="Создать коды"
        destructive={false}
        busy={busy}
        onConfirm={async () => {
          setRegenerating(false);
          setBusy(true);
          try {
            const r = await withStepUp(() => api('POST /api/v1/auth/mfa/recovery-codes/regenerate'));
            refresh();
            setCodes(r.recoveryCodes);
          } catch (e) {
            toast.error(e);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
