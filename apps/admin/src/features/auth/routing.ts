import type { SessionView } from '../../lib/api/schema.gen';

/** Router state passed to /login. */
export interface LocationState {
  from?: string;
  reason?: 'expired' | 'signed_out' | 'password_reset';
}

/** Where a session belongs right now. `from` is only honoured for same-app paths. */
export function routeFor(view: SessionView | null, from?: string): string {
  if (!view) return '/login';
  if (view.next === 'mfa_required') return '/login/mfa';
  if (view.next === 'mfa_enrollment_required') return '/setup-mfa';
  return safeFrom(from) ?? '/';
}

/** Only internal paths, never `//host` or a scheme: no open redirect through `from`. */
export function safeFrom(from: string | undefined): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return null;
  if (/^\/(login|setup-mfa|forgot-password|reset-password)(\/|$|\?)/.test(from)) return null;
  return from;
}

/** Token from `#token=…` (preferred) or `?token=…`. */
export function readResetToken(location: { hash: string; search: string }): string | null {
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
  const token = fromHash ?? new URLSearchParams(location.search).get('token');
  return token && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
}
