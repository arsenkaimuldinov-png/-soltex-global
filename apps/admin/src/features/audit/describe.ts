/**
 * Audit events in plain Russian (approved §16: no enum values or codes in the main UI). The API
 * writes only whitelisted summary keys (admin-auth.md §5); unknown keys and values are not shown
 * in the main row, only in «Дополнительно».
 */
import { AUDIT_DETAIL_LABELS, auditActionLabel, RESOURCE_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from '../../i18n/ru';
import { plural } from '../../lib/format';

export interface AuditItem {
  id: number;
  at: string;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: 'success' | 'failure' | 'denied';
  requestId: string | null;
  summary: Record<string, unknown>;
}

const word = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  if (v in ROLE_LABELS) return ROLE_LABELS[v as keyof typeof ROLE_LABELS].toLowerCase();
  if (v in USER_STATUS_LABELS) return USER_STATUS_LABELS[v as keyof typeof USER_STATUS_LABELS].toLowerCase();
  return AUDIT_DETAIL_LABELS[v] ?? null;
};

const FIELD_LABELS: Record<string, string> = { name: 'имя', role: 'роль', status: 'статус' };

/** One short human sentence of details, or '' when there is nothing a reader needs. */
export function describeAuditDetails(e: Pick<AuditItem, 'action' | 'summary' | 'result'> & { resourceType?: string | null }): string {
  const s = e.summary ?? {};
  const parts: string[] = [];
  if (e.action.startsWith('content.')) {
    if (e.resourceType && RESOURCE_LABELS[e.resourceType]) parts.push(RESOURCE_LABELS[e.resourceType]!);
    if (Array.isArray(s.fields) && s.fields.length)
      parts.push(`${e.result === 'denied' ? 'отказано в изменении полей' : 'изменено полей'}: ${s.fields.length}`);
    const st = word(s.status);
    if (st) parts.push(st);
    return parts.join(' · ');
  }
  const reason = word(s.reason);
  if (reason) parts.push(`причина: ${reason}`);
  const method = word(s.method);
  if (method && e.action !== 'user.bootstrap_owner') parts.push(`способ: ${method}`);
  if (e.action === 'user.bootstrap_owner' && method) parts.push(method);
  const factor = word(s.factor);
  if (factor) parts.push(`фактор: ${factor}`);
  if (s.step_up === true) parts.push('повторное подтверждение');
  const role = word(s.role);
  if (role && e.action !== 'user.bootstrap_owner') parts.push(`роль: ${role}`);
  const prev = word(s.previous_role);
  const next = word(s.new_role);
  if (prev && next) parts.push(`роль: ${prev} → ${next}`);
  else if (next) parts.push(`новая роль: ${next}`);
  const status = word(s.status);
  if (status) parts.push(e.action === 'auth.login' ? status : `статус: ${status}`);
  if (Array.isArray(s.fields) && s.fields.length) {
    const names = s.fields.map((f) => FIELD_LABELS[String(f)]).filter(Boolean);
    if (names.length) parts.push(`изменено: ${names.join(', ')}`);
  }
  if (typeof s.count === 'number') parts.push(`попыток: ${s.count}`);
  // `revoked` is a count of sessions (as text), or 'session' / 'no' after failed second factors.
  if (s.revoked === 'session') parts.push('сеанс завершён после неудачных попыток');
  else {
    const n = typeof s.revoked === 'number' ? s.revoked : typeof s.revoked === 'string' && /^\d+$/.test(s.revoked) ? Number(s.revoked) : 0;
    if (n > 0) parts.push(`завершено ${n} ${plural(n, 'сеанс', 'сеанса', 'сеансов')}`);
  }
  if (typeof s.remaining === 'number') parts.push(`осталось кодов: ${s.remaining}`);
  if (typeof s.permission === 'string') parts.push('нет нужного права');
  return parts.join(' · ');
}

export { auditActionLabel };
