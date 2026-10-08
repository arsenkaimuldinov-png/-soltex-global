import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSession, useLogout } from '../../lib/session';
import type { SessionView } from '../../lib/api/schema.gen';
import { AuthLayout } from './AuthLayout';
import { SecondFactorForm } from './SecondFactorForm';
import { routeFor, type LocationState } from './routing';

/** Second step of sign-in. */
export function MfaPage({ view }: { view: SessionView }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useLogout();
  const state = (useLocation().state ?? {}) as LocationState;
  return (
    <AuthLayout title="Подтверждение входа" description={<>Вы входите как <span className="font-medium text-ink">{view.user.email}</span>.</>}>
      <SecondFactorForm
        mfa={view.mfa}
        allowRecovery
        onSuccess={(next) => {
          setSession(qc, next);
          navigate(routeFor(next, state.from), { replace: true });
        }}
        onSessionLost={() => {
          setSession(qc, null);
          navigate('/login', { replace: true, state: { reason: 'expired' } });
        }}
        submitLabel="Войти"
      />
      <button type="button" className="mt-4 text-[13px] text-ink-muted hover:text-ink hover:underline" onClick={() => void logout()}>
        Войти под другой учётной записью
      </button>
    </AuthLayout>
  );
}
