/**
 * DEMO / PREVIEW implementation — reproduces the approved front-end behaviour exactly:
 * a short "processing" state, then success with a reference number. NOTHING IS SENT OR
 * STORED. Used when the build has no SOLTEX_LEADS_ENDPOINT (./flags.ts), and by the real
 * service on any origin other than the site's own (release previews).
 */
import type { LeadPayload, LeadSubmissionResult, LeadSubmissionService } from './types';

const DELAY_MS = 450;

/** Reference format used by the approved inquiry dialog: "SOL-" + 4 digits. */
export function createLeadReference(): string {
  return `SOL-${(Math.random() * 9000 + 1000).toFixed(0)}`;
}

export const simulatedLeadService: LeadSubmissionService = {
  name: 'simulated',
  submitLead(_payload: LeadPayload): Promise<LeadSubmissionResult> {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true, reference: createLeadReference() }), DELAY_MS);
    });
  },
};
