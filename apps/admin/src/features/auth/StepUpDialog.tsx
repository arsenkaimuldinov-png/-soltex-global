import { useQuery } from '@tanstack/react-query';
import { Dialog } from '../../components/ui/Dialog';
import { LoadingBlock } from '../../components/ui/Spinner';
import { fetchSession, SESSION_KEY } from '../../lib/session';
import { SecondFactorForm } from './SecondFactorForm';

/** Re-confirm the second factor before a sensitive action (step-up, approved §7). */
export function StepUpDialog({ open, onVerified, onCancel }: { open: boolean; onVerified: () => void; onCancel: () => void }) {
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, enabled: open });
  const mfa = session.data?.mfa;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title="Подтвердите действие"
      description="Это действие меняет настройки безопасности или доступа. Подтвердите его вторым фактором; подтверждение действует 10 минут."
      size="sm"
    >
      {mfa ? <SecondFactorForm key={String(open)} mfa={mfa} allowRecovery={false} onSuccess={onVerified} onSessionLost={onCancel} submitLabel="Подтвердить действие" /> : <LoadingBlock />}
    </Dialog>
  );
}
