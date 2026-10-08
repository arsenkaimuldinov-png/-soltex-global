/**
 * Authenticator app (TOTP) enrollment: the QR code is rendered locally (the secret never leaves the
 * browser for a third-party QR service), with the key as text for manual entry.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { renderSVG } from 'uqr';
import { api } from '../../lib/api/client';
import type { Operations } from '../../lib/api/schema.gen';
import { describeError } from '../../lib/errors';
import { useStepUp } from '../../lib/step-up';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Field';

export type TotpResult = Operations['POST /api/v1/auth/mfa/totp/confirm']['response'];

export function TotpSetup({ onDone }: { onDone: (result: TotpResult) => void }) {
  const withStepUp = useStepUp();
  const [started, setStarted] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qr = useMemo(() => (started ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(started.otpauthUri, { border: 2 }))}` : null), [started]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setStarted(await withStepUp(() => api('POST /api/v1/auth/mfa/totp/enroll')));
    } catch (e) {
      const d = describeError(e);
      if (!d.silent) setError(d.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    const value = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(value)) return setError('Введите шесть цифр из приложения.');
    setBusy(true);
    setError(null);
    try {
      onDone(await withStepUp(() => api('POST /api/v1/auth/mfa/totp/confirm', { body: { code: value } })));
    } catch (e2) {
      const d = describeError(e2);
      if (!d.silent) setError(d.message);
    } finally {
      setBusy(false);
    }
  }

  if (!started)
    return (
      <div className="space-y-3">
        <FormError message={error} />
        <p className="text-[13px] text-ink-muted">Подойдёт любое приложение-аутентификатор: Google Authenticator, Microsoft Authenticator, 1Password, Яндекс Ключ и другие.</p>
        <Button variant="primary" loading={busy} onClick={() => void start()}>
          Подключить приложение
        </Button>
      </div>
    );

  return (
    <form onSubmit={confirm} className="space-y-4" noValidate>
      <FormError message={error} />
      <ol className="list-decimal space-y-3 pl-5 text-[13px]">
        <li>
          Отсканируйте QR-код в приложении.
          <img src={qr ?? ''} alt="QR-код для приложения-аутентификатора" className="mt-2 size-44 rounded border border-line bg-white p-1" width={176} height={176} />
        </li>
        <li>
          Или введите ключ вручную:
          <p className="mt-1 font-mono text-[13px] break-all select-all" aria-label="Ключ для ручного ввода">
            {started.secret.match(/.{1,4}/g)?.join(' ')}
          </p>
        </li>
        <li>Введите шесть цифр, которые покажет приложение.</li>
      </ol>
      <Field label="Код из приложения">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-40 font-mono tracking-[0.3em]" />
        )}
      </Field>
      <Button type="submit" variant="primary" loading={busy}>
        Подтвердить
      </Button>
    </form>
  );
}
