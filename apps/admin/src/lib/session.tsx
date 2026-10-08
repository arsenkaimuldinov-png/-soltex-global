/**
 * Session state of the admin. The server is the only authority: the SPA asks GET /auth/session,
 * keeps the answer in the query cache and routes by its `next` step. The session token itself is
 * an HttpOnly cookie the SPA never sees.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import type { Permission } from '@soltex/core/domain';
import { api, isApiError, onApiError } from './api/client';
import type { SessionView } from './api/schema.gen';

export type { SessionView };
export const SESSION_KEY = ['auth', 'session'] as const;

export async function fetchSession(): Promise<SessionView | null> {
  try {
    return await api('GET /api/v1/auth/session');
  } catch (e) {
    if (isApiError(e, 'unauthenticated')) return null;
    throw e;
  }
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 60_000, refetchInterval: 5 * 60_000, retry: 1 });
}

/** Other tabs learn about sign-in / sign-out at once (BroadcastChannel; ignored if unavailable). */
const CHANNEL = 'soltex-admin-session';
function channel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

/** Why the session ended, shown once on the sign-in screen. */
export type EndReason = 'expired' | 'signed_out';
let endReason: EndReason | null = null;
export const peekEndReason = (): EndReason | null => endReason;
export const clearEndReason = () => {
  endReason = null;
};

export function setSession(qc: QueryClient, view: SessionView | null, broadcast = true, reason?: EndReason) {
  if (view === null && reason) endReason = reason;
  if (view === null) {
    // Signed out: drop every cached response, keep only the empty session.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] || q.queryKey[1] !== SESSION_KEY[1] });
  }
  qc.setQueryData(SESSION_KEY, view);
  if (broadcast) {
    const ch = channel();
    ch?.postMessage({ type: view ? 'changed' : 'signed_out' });
    ch?.close();
  }
}

/** Mounted once: keeps the cached session consistent with what the API says. */
export function SessionSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const off = onApiError((e, key) => {
      if (key === 'GET /api/v1/auth/session' || key === 'POST /api/v1/auth/login') return;
      if (e.code === 'unauthenticated') setSession(qc, null, false, 'expired');
      else if (e.code === 'mfa_required' || e.code === 'mfa_enrollment_required') void qc.invalidateQueries({ queryKey: SESSION_KEY });
    });
    const ch = channel();
    if (ch) {
      ch.onmessage = (m: MessageEvent<{ type: string }>) => {
        if (m.data?.type === 'signed_out') setSession(qc, null, false, 'signed_out');
        else void qc.invalidateQueries({ queryKey: SESSION_KEY });
      };
    }
    return () => {
      off();
      ch?.close();
    };
  }, [qc]);
  return null;
}

// --- Inside the authenticated shell the session is always present -----------------------------

const SessionCtx = createContext<SessionView | null>(null);

export function SessionViewProvider({ value, children }: { value: SessionView; children: ReactNode }) {
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSessionView(): SessionView {
  const v = useContext(SessionCtx);
  if (!v) throw new Error('useSessionView outside the authenticated shell');
  return v;
}

/** Permission check for presentation only; the API enforces every permission itself. */
export function useCan(): (p: Permission) => boolean {
  const { permissions } = useSessionView();
  return useCallback((p: Permission) => (permissions as readonly string[]).includes(p), [permissions]);
}

export function useLogout() {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      await api('POST /api/v1/auth/logout');
    } catch {
      /* already signed out or offline: clear locally anyway */
    }
    setSession(qc, null, true, 'signed_out');
  }, [qc]);
}
