/**
 * The real lead service (Phase K-2): POST /api/v1/public/leads on the site's own origin (nginx
 * proxies this one path to the API, docs/deployment.md). On any other origin — the preview of a
 * release (preview.soltexglobal.co), a local copy — it behaves like the demo service, so testing a
 * release never creates leads.
 */
import { browserStores, clearAttribution, currentAttribution } from './attribution';
import { ATTRIBUTION_ENABLED } from './flags';
import { simulatedLeadService } from './simulated';
import type { LeadPayload, LeadSubmissionResult, LeadSubmissionService } from './types';

const TIMEOUT_MS = 15_000;

export function createHttpLeadService(endpoint: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): LeadSubmissionService {
  const target = new URL(endpoint);
  return {
    name: 'http',
    async submitLead(payload: LeadPayload): Promise<LeadSubmissionResult> {
      if (typeof location === 'undefined' || location.origin !== target.origin) return simulatedLeadService.submitLead(payload);
      const stores = ATTRIBUTION_ENABLED ? browserStores() : null;
      const attribution = stores ? currentAttribution(stores) : null;
      const fields = Object.fromEntries(Object.entries(payload.fields).filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
      const body = { ...payload, fields, ...(attribution ? { attribution } : {}) };
      let res: Response;
      try {
        res = await fetchImpl(target.href, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-site' },
          body: JSON.stringify(body),
          credentials: 'omit',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { ok: false, error: 'network' };
      }
      if (res.status === 201) {
        const data = (await res.json().catch(() => null)) as { reference?: unknown } | null;
        if (typeof data?.reference !== 'string') return { ok: false, error: 'server' };
        if (stores) clearAttribution(stores);
        return { ok: true, reference: data.reference };
      }
      if (res.status === 400 || res.status === 413) return { ok: false, error: 'validation' };
      if (res.status === 429) return { ok: false, error: 'rate_limited' };
      return { ok: false, error: 'server' };
    },
  };
}
