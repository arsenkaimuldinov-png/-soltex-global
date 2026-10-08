import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { describeError } from '../../lib/errors';
import { describeDevice } from '../../lib/format';
import { useStepUp } from '../../lib/step-up';
import { defaultPasskeyName, passkeysSupported, registerPasskey } from '../../lib/webauthn';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Field';

export type PasskeyResult = Awaited<ReturnType<typeof registerPasskey>>;

/** Register a passkey on this device (name it so it can be recognised in the list later). */
export function AddPasskeyForm({ onDone, submitLabel = 'Добавить ключ доступа' }: { onDone: (result: PasskeyResult) => void; submitLabel?: string }) {
  const withStepUp = useStepUp();
  const [name, setName] = useState(() => defaultPasskeyName(describeDevice(typeof navigator === 'undefined' ? null : navigator.userAgent)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!passkeysSupported())
    return <Alert tone="warn" title="Браузер не поддерживает ключи доступа">Откройте админку в актуальной версии Chrome, Safari, Edge или Firefox.</Alert>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Введите название ключа.');
    setBusy(true);
    setError(null);
    try {
      onDone(await withStepUp(() => registerPasskey(n)));
    } catch (err) {
      const d = describeError(err);
      if (!d.silent) setError(d.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={error} />
      <Field label="Название ключа" hint="Например, «MacBook — Touch ID» или «YubiKey». Видно только вам и администраторам.">
        {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" loading={busy} icon={<KeyRound className="size-4" aria-hidden />}>
        {submitLabel}
      </Button>
    </form>
  );
}
