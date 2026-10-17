/**
 * Baseline HTTP security for /api/v1 (approved §7, §10, §Q):
 *  - security headers (helmet): no sniffing, no framing, CSP "default-src 'none'" (JSON only),
 *    HSTS in production; every API response is `Cache-Control: no-store`;
 *  - CSRF: SameSite=Strict cookies, plus for every state-changing request (a) a required
 *    custom header `X-Requested-With: soltex-admin`, (b) `Origin`, when present, must be the
 *    admin origin, (c) `Sec-Fetch-Site`, when present, must be same-origin or none;
 *  - no CORS at all: no Access-Control-* header is ever sent.
 */
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { Problem } from './problem.ts';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'soltex-admin';
/** Header value the public site sends with lead forms (a simple request cannot set it cross-site). */
export const SITE_CSRF_VALUE = 'soltex-site';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function registerSecurity(app: FastifyInstance, deps: Deps) {
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: deps.config.env === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  });

  app.addHook('onRequest', async (request) => {
    if (SAFE.has(request.method) || !request.url.startsWith('/api/v1/')) return;
    // The public site (Phase K: lead forms) posts from its own origin, without cookies or sessions.
    if (request.url.startsWith('/api/v1/public/')) {
      if (request.headers[CSRF_HEADER] !== SITE_CSRF_VALUE) throw new Problem('csrf_rejected');
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== deps.config.publicSiteUrl) throw new Problem('csrf_rejected');
      return;
    }
    if (request.headers[CSRF_HEADER] !== CSRF_VALUE) throw new Problem('csrf_rejected');
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== deps.config.adminOrigin) throw new Problem('csrf_rejected');
    const site = request.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') throw new Problem('csrf_rejected');
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    // Every API answer is no-store, except the few that set their own policy (admin media previews).
    if (request.url.startsWith('/api/') && !reply.getHeader('cache-control')) reply.header('cache-control', 'no-store');
  });
}
