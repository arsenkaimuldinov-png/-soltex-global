/**
 * Session and known-device cookies (approved §7):
 *   __Host-soltex_session  HttpOnly; Secure; SameSite=Strict; Path=/ (the __Host- prefix forbids
 *                          a Domain attribute and requires Path=/ and Secure, so the cookie is
 *                          bound to the admin host only)
 *   __Host-soltex_device   same flags, 180 days: marks a browser that completed a full login
 * Without Secure (development over plain http on another host) the prefix is dropped.
 * Tokens are never stored in localStorage and never appear in a response body.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Deps } from '../deps.ts';

export const DEVICE_COOKIE_MAX_AGE_S = 180 * 24 * 60 * 60;

const name = (deps: Deps, base: string) => (deps.config.secureCookies ? `__Host-${base}` : base);
export const sessionCookieName = (deps: Deps) => name(deps, 'soltex_session');
export const deviceCookieName = (deps: Deps) => name(deps, 'soltex_device');

const options = (deps: Deps) => ({ httpOnly: true, secure: deps.config.secureCookies, sameSite: 'strict' as const, path: '/' });

export function setSessionCookie(deps: Deps, reply: FastifyReply, token: string, expires: Date) {
  reply.setCookie(sessionCookieName(deps), token, { ...options(deps), expires });
}

export function clearSessionCookie(deps: Deps, reply: FastifyReply) {
  reply.clearCookie(sessionCookieName(deps), options(deps));
}

export function setDeviceCookie(deps: Deps, reply: FastifyReply, token: string) {
  reply.setCookie(deviceCookieName(deps), token, { ...options(deps), maxAge: DEVICE_COOKIE_MAX_AGE_S });
}

export const readSessionCookie = (request: FastifyRequest, deps: Deps): string | undefined => request.cookies[sessionCookieName(deps)];
export const readDeviceCookie = (request: FastifyRequest, deps: Deps): string | undefined => request.cookies[deviceCookieName(deps)];
