/**
 * Rate limits (approved §19): layered, NAT-friendly, in process memory (single API process,
 * no Redis). Per-account login throttling and lockout live in the database (auth/login.ts).
 *
 *   global          600 requests / minute per session (or per IP without a session)
 *   login           30 / 15 min per IP
 *   reset request   5 / hour per IP; reset confirm 10 / 15 min per IP
 *   second factor   10 / 5 min per session (verify), 20 / 5 min per session (WebAuthn options)
 * A second-factor session is also revoked after 5 failed codes (auth/sessions.ts).
 */
import type { FastifyRequest } from 'fastify';
import type { RateLimitOptions } from '@fastify/rate-limit';
import type { Deps } from '../deps.ts';
import { sha256 } from '../auth/crypto.ts';
import { readSessionCookie } from '../http/cookies.ts';

export const GLOBAL_LIMIT = { max: 600, timeWindow: 60_000 };

export const byIp = (max: number, timeWindow: number): RateLimitOptions => ({
  max,
  timeWindow,
  keyGenerator: (request: FastifyRequest) => `ip:${request.ip}`,
});

export const bySessionOrIp = (deps: Deps, max: number, timeWindow: number): RateLimitOptions => ({
  max,
  timeWindow,
  keyGenerator: (request: FastifyRequest) => sessionOrIpKey(deps, request),
});

export function sessionOrIpKey(deps: Deps, request: FastifyRequest): string {
  const token = readSessionCookie(request, deps);
  return token ? `s:${sha256(token).slice(0, 32)}` : `ip:${request.ip}`;
}
