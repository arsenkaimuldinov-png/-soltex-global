/**
 * Turning API errors into Russian messages. The API's problem titles are already Russian
 * (admin-auth.md §6); this adds field-level texts and decides when to show the request id.
 */
import { GENERIC_ERROR, PASSWORD_PROBLEMS } from '../i18n/ru';
import { ApiError } from './api/client';
import { PasskeyError } from './webauthn';

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

export interface ErrorDescription {
  message: string;
  /** Request id for the toast, only when the error is unexpected (support case). */
  requestId: string | null;
  /** Nothing to show (user cancelled). */
  silent: boolean;
}

const EXPECTED = new Set([
  'validation_failed',
  'invalid_credentials',
  'mfa_invalid',
  'password_rejected',
  'conflict',
  'challenge_invalid',
  'rate_limited',
  'login_throttled',
  'step_up_required',
  'forbidden',
  'not_found',
  'initial_password_expired',
  'password_change_required',
]);

export function retryText(seconds: number | null): string {
  if (!seconds) return '';
  const s = Math.ceil(seconds);
  if (s < 60) return ` Повторите через ${s} с.`;
  return ` Повторите через ${Math.ceil(s / 60)} мин.`;
}

export function describeError(error: unknown, fallback = GENERIC_ERROR): ErrorDescription {
  if (error instanceof Cancelled) return { message: '', requestId: null, silent: true };
  if (error instanceof PasskeyError) return { message: error.message, requestId: null, silent: error.cancelled };
  if (error instanceof ApiError) {
    let message = error.detail ?? error.title ?? fallback;
    if (error.code === 'password_rejected') {
      const texts = error.fieldErrors.map((f) => PASSWORD_PROBLEMS[f.message]).filter(Boolean);
      if (texts.length) message = texts.join(' ');
    }
    if (error.code === 'login_throttled' || error.code === 'rate_limited') message += retryText(error.retryAfterSeconds);
    if (!message) message = fallback;
    const unexpected = error.status === 0 ? false : !EXPECTED.has(error.code);
    return { message, requestId: unexpected ? error.requestId : null, silent: false };
  }
  return { message: fallback, requestId: null, silent: false };
}

/** Field errors for react-hook-form: API field name → Russian message. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const f of error.fieldErrors) {
    const field = f.field.replace(/^body\./, '').replace(/^\//, '');
    out[field] = PASSWORD_PROBLEMS[f.message] ?? (error.code === 'validation_failed' ? 'Проверьте значение поля.' : f.message);
  }
  return out;
}
