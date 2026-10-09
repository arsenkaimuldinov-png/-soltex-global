import { isApiError } from '../../lib/api/client';
import { FIELD_ERROR_LABELS } from './model';

/** Messages per field from an API error (`errors[]`), with Russian texts. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const out: Record<string, string> = {};
  for (const e of error.fieldErrors) {
    // "title", "scope.0.value" → the field; page fields keep their slot: "copy.heroTitle", "header.title".
    const parts = e.field.split('.');
    const key = ['copy', 'lists', 'media', 'header'].includes(parts[0]!) && parts[1] ? `${parts[0]}.${parts[1]}` : parts[0]!;
    out[key] = FIELD_ERROR_LABELS[e.message] ?? 'Проверьте значение поля.';
  }
  return out;
}
