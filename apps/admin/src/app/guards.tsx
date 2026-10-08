/**
 * Route guards. They only decide what to render; every request is authorised by the API again.
 *  - PublicOnly: sign-in and password pages; a signed-in user is sent on.
 *  - StepRoute: the second-factor and enrollment steps of sign-in.
 *  - Authenticated: the shell; anonymous users go to /login and come back afterwards.
 *  - RequirePermission: a screen behind a permission; without it a «Недостаточно прав» page.
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permission } from '@soltex/core/domain';
import { useHeldCodes } from '../lib/held-codes';
import { SessionViewProvider, peekEndReason, useCan, useSession, type SessionView } from '../lib/session';
import { Button } from '../components/ui/Button';
import { LoadingBlock } from '../components/ui/Spinner';
import { routeFor, type LocationState } from '../features/auth/routing';
import { ForbiddenPage } from './ErrorPages';

export function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingBlock label="Загрузка…" />
    </div>
  );
}

function SessionError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-medium">Не удалось связаться с сервером.</p>
      <p className="text-[13px] text-ink-muted">Проверьте подключение к интернету и повторите.</p>
      <Button onClick={retry}>Повторить</Button>
    </div>
  );
}

/** The page asked for before sign-in (router state), carried through every sign-in step. */
function useFrom(): string | undefined {
  return ((useLocation().state ?? {}) as LocationState).from;
}

export function PublicOnly() {
  const s = useSession();
  const from = useFrom();
  if (s.isPending) return <FullScreenLoading />;
  if (s.isError && s.data === undefined) return <SessionError retry={() => void s.refetch()} />;
  if (s.data) return <Navigate to={routeFor(s.data, from)} replace state={{ from }} />;
  return <Outlet />;
}

export function StepRoute({ step, render }: { step: SessionView['next']; render: (view: SessionView) => ReactNode }) {
  const s = useSession();
  const held = useHeldCodes();
  const from = useFrom();
  if (s.isPending) return <FullScreenLoading />;
  if (s.isError && s.data === undefined) return <SessionError retry={() => void s.refetch()} />;
  if (!s.data) return <Navigate to="/login" replace />;
  // Recovery codes on screen: stay until the user confirms they saved them.
  if (s.data.next !== step && !(step === 'mfa_enrollment_required' && held.codes)) return <Navigate to={routeFor(s.data, from)} replace state={{ from }} />;
  return <>{render(s.data)}</>;
}

export function Authenticated({ children }: { children: ReactNode }) {
  const s = useSession();
  const location = useLocation();
  if (s.isPending) return <FullScreenLoading />;
  if (s.isError && s.data === undefined) return <SessionError retry={() => void s.refetch()} />;
  if (!s.data) {
    const reason = peekEndReason();
    const from = reason === 'signed_out' ? undefined : location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from, reason: reason ?? undefined }} />;
  }
  if (s.data.next !== 'authenticated') return <Navigate to={routeFor(s.data)} replace state={{ from: location.pathname + location.search }} />;
  return <SessionViewProvider value={s.data}>{children}</SessionViewProvider>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = useCan();
  return can(permission) ? <>{children}</> : <ForbiddenPage />;
}
