/**
 * Mandatory second-factor enrollment (approved §7: MFA is mandatory by permission; Owner and
 * Admin need a passkey). Reached right after the password when the role requirement is unmet.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Smartphone } from 'lucide-react';
import type { SessionView } from '../../lib/api/schema.gen';
import { useHeldCodes } from '../../lib/held-codes';
import { setSession, SESSION_KEY, useLogout } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { cx } from '../../components/ui/cx';
import { AddPasskeyForm } from '../security/AddPasskeyForm';
import { RecoveryCodesPanel } from '../security/RecoveryCodesPanel';
import { TotpSetup } from '../security/TotpSetup';
import { AuthLayout } from './AuthLayout';
import { routeFor, type LocationState } from './routing';

type Result = SessionView & { recoveryCodes?: string[] };

export function SetupMfaPage({ view }: { view: SessionView }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useLogout();
  const held = useHeldCodes();
  const from = ((useLocation().state ?? {}) as LocationState).from;
  const [pending, setPending] = useState<SessionView | null>(null);
  const passkeyOnly = view.mfa.requirement === 'passkey';
  const [method, setMethod] = useState<'passkey' | 'totp'>('passkey');

  const finish = (result: Result) => {
    const { recoveryCodes, ...next } = result;
    if (recoveryCodes?.length) {
      held.hold(recoveryCodes);
      setPending(next);
      return;
    }
    if (next.next === 'authenticated') {
      setSession(qc, next);
      navigate(routeFor(next, from), { replace: true });
    } else void qc.invalidateQueries({ queryKey: SESSION_KEY });
  };

  if (held.codes)
    return (
      <AuthLayout title="Резервные коды" wide>
        <RecoveryCodesPanel
          codes={held.codes}
          email={view.user.email}
          doneLabel="Перейти в админку"
          onDone={() => {
            held.release();
            if (pending) setSession(qc, pending);
            navigate(pending ? routeFor(pending, from) : '/', { replace: true });
          }}
        />
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Настройте второй фактор входа"
      wide
      description={
        passkeyOnly ? (
          <>Для роли владельца и администратора вход защищается ключом доступа (passkey): Touch ID, Face ID, Windows Hello или аппаратный ключ.</>
        ) : (
          <>Ваша роль даёт доступ к важным разделам, поэтому вход защищается вторым фактором. Рекомендуем ключ доступа.</>
        )
      }
    >
      <div className="space-y-5">
        {passkeyOnly && view.mfa.totp ? <Alert tone="info">Приложение-аутентификатор уже подключено. Для вашей роли нужен также ключ доступа.</Alert> : null}
        {!passkeyOnly ? (
          <div role="radiogroup" aria-label="Способ подтверждения" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ['passkey', 'Ключ доступа', 'Рекомендуется. Без кодов, защищён от фишинга.', KeyRound],
                ['totp', 'Приложение-аутентификатор', 'Шестизначные коды в телефоне.', Smartphone],
              ] as const
            ).map(([value, label, hint, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => setMethod(value)}
                className={cx('flex items-start gap-3 rounded-md border px-3 py-2.5 text-left', method === value ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-subtle')}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {passkeyOnly || method === 'passkey' ? <AddPasskeyForm onDone={finish} /> : <TotpSetup onDone={finish} />}
        <button type="button" className="text-[13px] text-ink-muted hover:text-ink hover:underline" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
    </AuthLayout>
  );
}
