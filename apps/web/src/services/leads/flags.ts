/**
 * Build-time switches of the lead forms (Phase K-2, docs/admin-leads.md §10).
 *
 *   SOLTEX_LEADS_ENDPOINT  absolute URL of POST /api/v1/public/leads; empty → the demo service
 *   SOLTEX_ATTRIBUTION     "true" → UTM attribution (approved §13.3); needs the endpoint
 *
 * The publishing builder sets them from the API's SITE_LEADS_ENABLED / ATTRIBUTION_ENABLED. A plain
 * `npm run build` leaves both off and the site behaves exactly as before. vite.config.ts inlines
 * them as constants, so code behind an off switch is removed from the bundle (no attribution code
 * is shipped while attribution is off); prerender (Node) reads the same environment, so the HTML and
 * the hydrated page always agree.
 */
export interface LeadFlags {
  endpoint: string;
  attribution: boolean;
}

export function leadFlagsFromEnv(env: Record<string, string | undefined>): LeadFlags {
  const endpoint = (env.SOLTEX_LEADS_ENDPOINT ?? '').trim();
  if (endpoint && !/^https?:\/\/[^/\s]+\/\S*$/.test(endpoint)) throw new Error('SOLTEX_LEADS_ENDPOINT must be an absolute http(s) URL');
  return { endpoint, attribution: endpoint !== '' && env.SOLTEX_ATTRIBUTION === 'true' };
}

declare const __SOLTEX_LEADS_ENDPOINT__: string | undefined;
declare const __SOLTEX_ATTRIBUTION__: boolean | undefined;

const fromNode = (): LeadFlags => leadFlagsFromEnv((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {});

/** Where the forms send leads; empty: the demo service (nothing is sent). */
export const LEADS_ENDPOINT: string = typeof __SOLTEX_LEADS_ENDPOINT__ === 'string' ? __SOLTEX_LEADS_ENDPOINT__ : fromNode().endpoint;
/** UTM attribution is recorded and sent with leads. */
export const ATTRIBUTION_ENABLED: boolean = typeof __SOLTEX_ATTRIBUTION__ === 'boolean' ? __SOLTEX_ATTRIBUTION__ : fromNode().attribution;
