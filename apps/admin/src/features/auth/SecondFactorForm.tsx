/**
 * Second factor: passkey, authenticator code, or (sign-in only) a one-time recovery code.
 * Used by the sign-in screen and by the step-up dialog.
 */
import { useState, type FormEvent } from 'react';
import { KeyRound, Smartphone } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { SessionView } from '../../lib/api/schema.gen';
import { describeError } from '../../lib/errors';
import { authenticateWithPasskey, passkeysSupported } from '../../lib/webauthn';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Field';

type Method = 'passkey' | 'totp' | 'recovery';

export interface SecondFactorFormProps {
  mfa: SessionView['mfa'];
  allowRecovery: boolean;
  onSuccess: (view: SessionView) => void;
  /** Called when the API revoked the session (too many failures) or it expired. */
  onSessionLost?: () => void;
  submitLabel?: string;
}

export function SecondFactorForm({ mfa, allowRecovery, onSuccess, onSessionLost, submitLabel = 'Подтвердить' }: SecondFactorFormProps) {
  const hasPasskey = mfa.passkeys > 0 && passkeysSupported();
  const initial: Method = hasPasskey ? 'passkey' : mfa.totp ? 'totp' : 'recovery';
  const [method, setMethod] = useState<Method>(initial);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<SessionView>) {
    setBusy(true);
    setError(null);
    try {
      onSuccess(await fn());
    } catch (e) {
      const d = describeError(e);
      if ((e as { code?: string }).code === 'unauthenticated') {
        onSessionLost?.();
        return;
      }
      if (!d.silent) setError(d.message);
    } finally {
      setBusy(false);
    }
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (method === 'totp') {
      if (!/^\d{6}$/.test(value.replace(/\s/g, ''))) return setError('Введите шесть цифр из приложения.');
      void run(() => api('POST /api/v1/auth/mfa/totp/verify', { body: { code: value.replace(/\s/g, '') } }));
    } else {
      if (value.replace(/[\s-]/g, '').length !== 32) return setError('Резервный код состоит из 32 символов (дефисы можно не вводить).');
      void run(() => api('POST /api/v1/auth/mfa/recovery/verify', { body: { code: value } }));
    }
  }

  const switchTo = (m: Method) => {
    setMethod(m);
    setCode('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      <FormError message={error} />
      {method === 'passkey' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">Используйте ключ доступа: Touch ID, Face ID, Windows Hello или аппаратный ключ.</p>
          <Button variant="primary" className="w-full" loading={busy} icon={<KeyRound className="size-4" aria-hidden />} onClick={() => void run(authenticateWithPasskey)}>
            Подтвердить ключом доступа
          </Button>
        </div>
      ) : (
        <form onSubmit={submitCode} className="space-y-3" noValidate>
          {method === 'totp' ? (
            <Field label="Код из приложения-аутентификатора" hint="Шесть цифр, код обновляется каждые 30 секунд.">
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono tracking-[0.3em]"
                />
              )}
            </Field>
          ) : (
            <Field label="Резервный код" hint="Каждый код действует один раз. После входа рекомендуем создать новые коды.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="off" spellCheck={false} autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
              )}
            </Field>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            {submitLabel}
          </Button>
        </form>
      )}

      <div className="flex flex-col items-start gap-1.5 border-t border-line pt-3 text-[13px]">
        {method !== 'passkey' && hasPasskey ? (
          <button type="button" className="inline-flex items-center gap-1.5 text-accent hover:underline" onClick={() => switchTo('passkey')}>
            <KeyRound className="size-3.5" aria-hidden /> Использовать ключ доступа
          </button>
        ) : null}
        {method !== 'totp' && mfa.totp ? (
          <button type="button" className="inline-flex items-center gap-1.5 text-accent hover:underline" onClick={() => switchTo('totp')}>
            <Smartphone className="size-3.5" aria-hidden /> Ввести код из приложения
          </button>
        ) : null}
        {allowRecovery && method !== 'recovery' && mfa.recoveryCodesLeft > 0 ? (
          <button type="button" className="text-ink-muted hover:text-ink hover:underline" onClick={() => switchTo('recovery')}>
            Нет доступа к устройству? Использовать резервный код
          </button>
        ) : null}
      </div>
    </div>
  );
}
