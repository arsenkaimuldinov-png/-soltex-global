/**
 * Leads in the admin (Phase K-1): every status, form, notification state, error code, spam reason
 * and history entry has Russian wording.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { LEAD_FORMS, LEAD_STATUSES } from '@soltex/core/domain';
import { describeLeadEvent, describeTouch, LEAD_FORM_LABELS, LEAD_STATUS_LABELS, NOTIFICATION_LABELS, notifyErrorText, SPAM_REASON_LABELS, telHref } from '../src/features/leads/model';

test('labels for statuses, forms, notifications, errors and spam reasons', () => {
  for (const s of LEAD_STATUSES) assert.ok(/[А-Я]/.test(LEAD_STATUS_LABELS[s]), s);
  for (const f of LEAD_FORMS) assert.ok(LEAD_FORM_LABELS[f], f);
  for (const n of ['sent', 'pending', 'failed', 'not_needed']) assert.ok(NOTIFICATION_LABELS[n], n);
  for (const c of ['mail_not_configured', 'no_recipients', 'smtp_rejected', 'smtp_unavailable']) assert.ok(/[а-я]/.test(notifyErrorText(c)) && notifyErrorText(c) !== 'ошибка отправки', c);
  for (const r of ['honeypot', 'too_fast', 'links', 'markup', 'keywords']) assert.ok(SPAM_REASON_LABELS[r], r);
  assert.equal(telHref('+7 (701) 555-77-07'), 'tel:+77015557707');
});

test('history entries in words', () => {
  const name = (id: string | null) => (id === 'u1' ? 'Анна' : '—');
  const e = (kind: string, data: Record<string, unknown> = {}) => describeLeadEvent({ kind, data, note: null, actor: null }, name);
  assert.equal(e('status', { from: 'new', to: 'won' }), 'Статус: Новый → Успешно');
  assert.equal(e('assignee', { to: 'u1' }), 'Ответственный: Анна');
  assert.equal(e('assignee', { to: null }), 'Ответственный снят');
  assert.match(e('notify_failed', { code: 'mail_not_configured' }), /SMTP/);
  assert.match(e('anonymized', { reason: 'retention' }), /срок хранения/);
  for (const k of ['created', 'note', 'notified', 'deleted', 'restored']) assert.ok(/[А-Яа-я]/.test(e(k)), k);
});

test('attribution in words (Phase K-2)', () => {
  const date = (iso: string) => iso.slice(0, 10);
  const t = describeTouch({ at: '2026-10-01T10:00:00Z', landing: '/ru/projects', referrer: 'https://www.google.com', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'pectin', utm_term: 'pectin plant' }, date);
  assert.equal(t.source, 'google / cpc / pectin');
  assert.equal(t.details, 'страница входа /ru/projects · 2026-10-01 · ключевое слово: pectin plant · переход с https://www.google.com');
  assert.equal(describeTouch({ at: '2026-10-01T10:00:00Z', landing: '/', direct: true }, date).source, 'прямой заход');
  assert.equal(describeTouch({ at: '2026-10-01T10:00:00Z', landing: '/', referrer: 'https://linkedin.com' }, date).source, 'https://linkedin.com');
  assert.equal(describeTouch({ at: '2026-10-01T10:00:00Z', landing: '/', gclid: 'x' }, date).source, 'Google Ads');
});
