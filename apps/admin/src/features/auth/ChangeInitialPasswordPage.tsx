/**
 * First sign-in with an initial password (Phase M-1, ASVS 4.0.3 §2.3.1): an Owner or Admin gave the
 * password, so the user replaces it before anything else — right after the second factor. The
 * initial password stops working; other sessions end.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import type { SessionView } from '../../lib/api/schema.gen';
import { useLogout } from '../../lib/session';
import { PasswordForm } from '../account/PasswordCard';
import { AuthLayout } from './AuthLayout';
import { safeFrom, type LocationState } from './routing';

export function ChangeInitialPasswordPage({ view }: { view: SessionView }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const from = ((useLocation().state ?? {}) as LocationState).from;
  return (
    <AuthLayout
      title="Придумайте свой пароль"
      description={
        <>
          {view.user.name}, вы вошли с начальным паролем, который выдал администратор. Замените его на свой: начальный пароль после этого перестанет работать.
        </>
      }
    >
      <PasswordForm currentLabel="Начальный пароль" submitLabel="Сохранить и продолжить" onDone={() => navigate(safeFrom(from) ?? '/', { replace: true })} />
      <button type="button" onClick={() => void logout()} className="mt-4 text-[13px] text-ink-muted hover:text-accent hover:underline">
        Выйти
      </button>
    </AuthLayout>
  );
}
