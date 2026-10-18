/**
 * Lead submission contract.
 *
 * Forms only know this interface. Where a lead ends up (the demo service, or the site API —
 * POST /api/v1/public/leads, Phase K-2) is an implementation detail of the service selected in
 * ./index.ts — page components never change when the backend changes.
 */
import type { Locale } from '../../i18n/config';

/** Which form produced the lead. */
export type LeadFormType = 'cta_section' | 'inquiry_modal' | 'contact_page';

export interface LeadFields {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  message?: string;
}

export interface LeadPayload {
  formType: LeadFormType;
  fields: LeadFields;
  /** Inquiry topic shown to the visitor (already in the visitor's language), if any. */
  topic: string | null;
  locale: Locale;
  /** Page the form was submitted from (path without origin). */
  pagePath: string;
  /** Hidden honeypot field; must stay empty (sent only by the real service, Phase K-2). */
  hp?: string;
  /** Milliseconds from showing the form to sending it (spam check, Phase K-2). */
  fillMs?: number;
  /** The visitor ticked the consent box (Phase N-0; sent only when the Privacy Policy is published). */
  consent?: true;
}

export type LeadSubmissionResult =
  | { ok: true; /** Reference shown to the visitor, e.g. "SOL-4821". */ reference: string }
  | { ok: false; error: 'validation' | 'network' | 'server' | 'rate_limited'; message?: string };

export interface LeadSubmissionService {
  readonly name: string;
  submitLead(payload: LeadPayload): Promise<LeadSubmissionResult>;
}
