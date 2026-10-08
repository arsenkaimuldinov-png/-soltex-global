/**
 * Services shared by every route: configuration, database, clock and notifications.
 * Tests pass a controllable clock and a recording notifier.
 */
import type { FastifyRequest } from 'fastify';
import type { ApiConfig } from './config.ts';
import type { Db } from './db/client.ts';
import { keyedHash } from './auth/crypto.ts';
import type { Notifier } from './notify/notifier.ts';

export interface Deps {
  config: ApiConfig;
  /** null only in unit runs without a database (health, docs, error handling). */
  db: Db | null;
  now: () => Date;
  notifier: Notifier;
}

export function requireDb(deps: Deps): Db {
  if (!deps.db) throw new Error('database is not configured (DATABASE_URL)');
  return deps.db;
}

/** Client information for sessions and the audit log: the IP is stored only as a keyed hash. */
export interface ClientInfo {
  requestId: string;
  ipHash: string;
  userAgent: string | null;
}

export function clientInfo(deps: Deps, request: FastifyRequest): ClientInfo {
  const ua = request.headers['user-agent'];
  return {
    requestId: request.id,
    ipHash: keyedHash(deps.config.hashSecret, request.ip),
    userAgent: typeof ua === 'string' ? ua.slice(0, 200) : null,
  };
}
