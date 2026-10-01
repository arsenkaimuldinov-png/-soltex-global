/**
 * Lead submission contract.
 *
 * Forms only know this interface. Where a lead ends up (a future custom backend endpoint,
 * a PHP handler on the production host, a CRM, e-mail…) is an implementation detail of the
 * service selected in ./index.ts — page components never change when the backend changes.
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
}

export type LeadSubmissionResult =
  | { ok: true; /** Reference shown to the visitor, e.g. "SOL-4821". */ reference: string }
  | { ok: false; error: 'validation' | 'network' | 'server' | 'rate_limited'; message?: string };

export interface LeadSubmissionService {
  readonly name: string;
  submitLead(payload: LeadPayload): Promise<LeadSubmissionResult>;
}
