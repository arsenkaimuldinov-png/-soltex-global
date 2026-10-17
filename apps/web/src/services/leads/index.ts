/**
 * The lead service used by every form. With SOLTEX_LEADS_ENDPOINT set at build time (Phase K-2,
 * ./flags.ts) the forms send to the server; otherwise the demo service is used and nothing is sent.
 */
import { LEADS_ENDPOINT } from './flags';
import { createHttpLeadService } from './http';
import { simulatedLeadService } from './simulated';
import type { LeadSubmissionService } from './types';

export const leadService: LeadSubmissionService = LEADS_ENDPOINT ? createHttpLeadService(LEADS_ENDPOINT) : simulatedLeadService;

export { ATTRIBUTION_ENABLED, LEADS_ENDPOINT } from './flags';
export type { LeadFormType, LeadPayload, LeadSubmissionResult, LeadSubmissionService } from './types';
