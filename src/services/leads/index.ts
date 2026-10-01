/**
 * The lead service used by every form. Phase 1: the simulated (demo) service.
 * A future backend implementation is selected here, e.g.
 *   export const leadService = createHttpLeadService(import.meta.env.VITE_LEAD_ENDPOINT)
 */
import { simulatedLeadService } from './simulated';
import type { LeadSubmissionService } from './types';

export const leadService: LeadSubmissionService = simulatedLeadService;

export type { LeadFormType, LeadPayload, LeadSubmissionResult, LeadSubmissionService } from './types';
