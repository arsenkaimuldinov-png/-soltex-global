/**
 * Leads in the admin (Phase K-1, docs/admin-leads.md): Russian wording of statuses, forms,
 * notification states and history entries. Pure functions (unit-tested in node).
 */
import { LEAD_STATUSES, type LeadForm, type LeadStatus } from '@soltex/core/domain';

export const LEADS_KEY = ['leads'] as const;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  qualified: 'Квалифицирован',
  won: 'Успешно',
  lost: 'Отказ',
  spam: 'Спам',
};
export const LEAD_STATUS_TONES: Record<LeadStatus, 'info' | 'warn' | 'ok' | 'neutral' | 'danger'> = {
  new: 'info',
  in_progress: 'warn',
  qualified: 'warn',
  won: 'ok',
  lost: 'neutral',
  spam: 'danger',
};
export const LEAD_STATUS_ORDER = LEAD_STATUSES;

export const LEAD_FORM_LABELS: Record<LeadForm, string> = {
  cta_section: 'Блок «Связаться»',
  inquiry_modal: 'Окно запроса',
  contact_page: 'Страница «Контакты»',
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  sent: 'Уведомление отправлено',
  pending: 'Уведомление в очереди',
  failed: 'Уведомление не отправлено',
  not_needed: 'Уведомление не требуется',
};

const NOTIFY_ERRORS: Record<string, string> = {
  mail_not_configured: 'почта сервера ещё не настроена (SMTP)',
  no_recipients: 'не указаны получатели заявок',
  smtp_rejected: 'почтовый сервер отклонил письмо',
  smtp_unavailable: 'почтовый сервер недоступен',
};
export const notifyErrorText = (code: string | null | undefined) => (code ? NOTIFY_ERRORS[code] ?? 'ошибка отправки' : '');

export const SPAM_REASON_LABELS: Record<string, string> = {
  honeypot: 'заполнено скрытое поле',
  too_fast: 'форма отправлена быстрее 3 секунд',
  links: 'много ссылок',
  markup: 'HTML-разметка в тексте',
  keywords: 'типичные спам-слова',
};

export const LOCALE_LABELS: Record<string, string> = { en: 'английский', ru: 'русский', zh: 'китайский', tr: 'турецкий', ar: 'арабский', es: 'испанский' };

export interface LeadEventView {
  kind: string;
  data: Record<string, unknown>;
  note: string | null;
  actor: { id: string; name: string } | null;
}

/** One history line in Russian. Names of assignees are resolved by the caller. */
export function describeLeadEvent(e: LeadEventView, nameOf: (id: string | null) => string): string {
  const d = e.data;
  switch (e.kind) {
    case 'created':
      return d.spam ? 'Заявка получена и помечена как спам' : 'Заявка получена с сайта';
    case 'status':
      return `Статус: ${LEAD_STATUS_LABELS[d.from as LeadStatus] ?? '—'} → ${LEAD_STATUS_LABELS[d.to as LeadStatus] ?? '—'}`;
    case 'assignee':
      return d.to ? `Ответственный: ${nameOf(d.to as string)}` : 'Ответственный снят';
    case 'note':
      return 'Заметка';
    case 'notified':
      return `Уведомление отправлено (получателей: ${d.recipients ?? '—'})`;
    case 'notify_failed':
      return `Уведомление не отправлено: ${notifyErrorText(d.code as string)}`;
    case 'deleted':
      return 'Перенесена в корзину';
    case 'restored':
      return 'Восстановлена из корзины';
    case 'anonymized':
      return d.reason === 'retention' ? 'Обезличена: истёк срок хранения' : 'Обезличена через 30 дней после удаления';
    default:
      return e.kind;
  }
}

/** «tel:» link value: digits and a leading plus only. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
