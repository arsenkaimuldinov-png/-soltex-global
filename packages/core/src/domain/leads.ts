/**
 * Leads (Phase K, approved §13, review §K): statuses, forms, input limits, normalization for the
 * blind index, spam heuristics and the reference shown to the visitor. Pure functions shared by
 * the API (authoritative) and the admin.
 */

export const LEAD_FORMS = ['cta_section', 'inquiry_modal', 'contact_page'] as const;
export type LeadForm = (typeof LEAD_FORMS)[number];

/** Review §K: Новый, В работе, Квалифицирован, Успешно, Отказ, Спам. */
export const LEAD_STATUSES = ['new', 'in_progress', 'qualified', 'won', 'lost', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Fields each form must send (the forms validate the same on the site). */
export const LEAD_REQUIRED_FIELDS: Readonly<Record<LeadForm, readonly ('name' | 'phone' | 'email')[]>> = {
  cta_section: ['name', 'phone'],
  inquiry_modal: ['name', 'phone'],
  contact_page: ['name', 'phone', 'email'],
};

export const LEAD_LIMITS = { name: 200, phone: 40, email: 254, company: 200, message: 5000, topic: 300, pagePath: 300, note: 5000 } as const;
/** Whole request (review §K: ≤ 20 KB). */
export const LEAD_BODY_MAX_BYTES = 20 * 1024;
/** A human needs at least this long to fill a form (review §K). */
export const LEAD_MIN_FILL_MS = 3000;
/** Leads in the bin are anonymized after this many days (approved §13.1). */
export const LEAD_DELETE_GRACE_DAYS = 30;

/** E-mail for the blind index: trimmed, lower case. */
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
/** Phone for the blind index: digits only (formatting and a leading + do not matter). */
export const normalizePhone = (v: string) => v.replace(/\D/g, '');

export interface SpamInput {
  /** Hidden field real visitors never see; bots fill it. */
  honeypot: string | null | undefined;
  /** Milliseconds between showing the form and sending it, as the page measured it (null = unknown). */
  fillMs: number | null | undefined;
  name: string;
  message: string | null | undefined;
}

export type SpamReason = 'honeypot' | 'too_fast' | 'links' | 'markup' | 'keywords';

const KEYWORDS = /\b(viagra|casino|crypto ?airdrop|seo services|backlinks?|porn|loan offer|bitcoin investment)\b/i;

/**
 * Spam verdict (review §K): honeypot and fill time decide on their own; links, markup and typical
 * keywords add up. A spam lead is still stored (status `spam`) so nothing real is ever lost.
 */
export function spamVerdict(input: SpamInput): { score: number; reasons: SpamReason[]; spam: boolean } {
  const reasons: SpamReason[] = [];
  let score = 0;
  if (input.honeypot && input.honeypot.trim()) {
    reasons.push('honeypot');
    score += 100;
  }
  if (typeof input.fillMs === 'number' && input.fillMs >= 0 && input.fillMs < LEAD_MIN_FILL_MS) {
    reasons.push('too_fast');
    score += 100;
  }
  const text = `${input.name}\n${input.message ?? ''}`;
  const links = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links >= 2) {
    reasons.push('links');
    score += 30 * Math.min(links, 5);
  }
  if (/<\s*(a|script|iframe)\b|\[url=/i.test(text)) {
    reasons.push('markup');
    score += 60;
  }
  if (KEYWORDS.test(text)) {
    reasons.push('keywords');
    score += 50;
  }
  return { score, reasons, spam: score >= 100 };
}

/** Reference shown to the visitor and used in the admin: SOL-2026-000123. */
export function leadReference(year: number, number: number): string {
  return `SOL-${year}-${String(number).padStart(6, '0')}`;
}

/** CSV cell safe for spreadsheets (approved §13.1): quotes, and formula prefixes neutralised. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * UTM attribution (Phase K-2, approved §13.3): the only parameters recorded, the value limit, and
 * how long the first touch is kept. The site records them, the API validates them, the admin shows
 * them.
 */
export const LEAD_ATTRIBUTION_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as const;
export type LeadAttributionParam = (typeof LEAD_ATTRIBUTION_PARAMS)[number];
export const LEAD_ATTRIBUTION_MAX = 200;
export const LEAD_FIRST_TOUCH_DAYS = 90;

/** One visit: when, landing path (no query), referrer origin, allowlisted parameters; `direct` = none of them. */
export type LeadTouch = { at: string; landing: string; referrer?: string; direct?: true } & Partial<Record<LeadAttributionParam, string>>;
export interface LeadAttribution {
  first?: LeadTouch;
  last?: LeadTouch;
}

/** "google / cpc / spring-2026", the referrer origin, «прямой заход» or «—»: one line for lists and CSV. */
export function touchSummary(t: LeadTouch | null | undefined): string {
  if (!t) return '';
  if (t.direct) return 'прямой заход';
  const utm = [t.utm_source, t.utm_medium, t.utm_campaign].filter(Boolean).join(' / ');
  const click = t.gclid ? 'Google Ads' : t.fbclid ? 'Facebook / Instagram' : '';
  return utm || click || t.referrer || '—';
}
