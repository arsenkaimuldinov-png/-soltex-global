/**
 * API configuration from environment variables only (no secrets in code; see .env.example).
 * Values are validated at start-up; the process refuses to start with an invalid configuration.
 */
import { z } from 'zod';

export type AppEnv = 'development' | 'test' | 'production';
type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface ApiConfig {
  env: AppEnv;
  host: string;
  port: number;
  logLevel: LogLevel;
  /** Application database role (soltex_app). Empty only for unit runs without a database. */
  databaseUrl: string;
  /** Origin of the admin SPA and of /api/v1 (same origin, approved §10), e.g. https://admin.soltexglobal.co */
  adminOrigin: string;
  webauthn: { rpId: string; rpName: string; origin: string };
  /** AES-256-GCM keys for secrets at rest (TOTP), by key id; `currentKeyId` encrypts new values. */
  encryption: { keys: Map<string, Buffer>; currentKeyId: string };
  /** HMAC key for IP / e-mail hashes in sessions and the audit log. */
  hashSecret: Buffer;
  /** Secure (__Host-) cookies. Only `false` for plain-http development hosts other than localhost. */
  secureCookies: boolean;
  /** OpenAPI document: off in production; for signed-in users with system.read elsewhere (§10). */
  apiDocs: 'off' | 'authenticated';
  /** Client decision (approved §22 item 7): MFA also for roles without sensitive permissions. */
  mfaForAllRoles: boolean;
}

const ENVS = ['development', 'test', 'production'] as const;
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const base64Key = z
  .string()
  .transform((s) => Buffer.from(s, 'base64'))
  .refine((b) => b.length === 32, 'must be 32 bytes, base64-encoded');

/** "k1:<base64>,k2:<base64>" */
function parseKeys(value: string): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  for (const part of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(':');
    if (i <= 0) throw new Error('DATA_ENCRYPTION_KEYS: expected "<id>:<base64 key>[,…]"');
    const id = part.slice(0, i);
    if (!/^[a-z0-9_-]{1,16}$/i.test(id)) throw new Error(`DATA_ENCRYPTION_KEYS: invalid key id "${id}"`);
    map.set(id, base64Key.parse(part.slice(i + 1)));
  }
  return map;
}

export function loadConfig(source: Record<string, string | undefined> = process.env): ApiConfig {
  const env = (source.NODE_ENV ?? 'development') as AppEnv;
  if (!ENVS.includes(env)) throw new Error(`NODE_ENV must be one of ${ENVS.join(', ')}`);

  const port = Number(source.API_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be an integer 1–65535');

  const logLevel = (source.API_LOG_LEVEL ?? (env === 'test' ? 'silent' : 'info')) as LogLevel;
  if (!LEVELS.includes(logLevel)) throw new Error(`API_LOG_LEVEL must be one of ${LEVELS.join(', ')}`);

  const adminOrigin = (source.ADMIN_ORIGIN ?? (env === 'production' ? '' : 'http://localhost:3001')).replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(adminOrigin)) throw new Error('ADMIN_ORIGIN must be an origin, e.g. https://admin.soltexglobal.co');
  if (env === 'production' && !adminOrigin.startsWith('https://')) throw new Error('ADMIN_ORIGIN must use https in production');

  const rpId = source.WEBAUTHN_RP_ID ?? new URL(adminOrigin).hostname;
  if (!new URL(adminOrigin).hostname.endsWith(rpId)) throw new Error('WEBAUTHN_RP_ID must be the admin host or a parent domain of it');

  const keysRaw = source.DATA_ENCRYPTION_KEYS ?? '';
  const keys = keysRaw ? parseKeys(keysRaw) : new Map<string, Buffer>();
  const currentKeyId = source.DATA_ENCRYPTION_KEY_ID ?? [...keys.keys()][0] ?? '';
  const hashSecretRaw = source.HASH_SECRET ?? '';
  if (env !== 'test' || keysRaw || hashSecretRaw) {
    if (!keys.size || !keys.has(currentKeyId)) throw new Error('DATA_ENCRYPTION_KEYS / DATA_ENCRYPTION_KEY_ID are not set (see .env.example)');
    if (Buffer.from(hashSecretRaw, 'base64').length < 32) throw new Error('HASH_SECRET must be at least 32 random bytes, base64-encoded');
  }

  const secureCookies = (source.SESSION_COOKIE_SECURE ?? 'true') !== 'false';
  if (env === 'production' && !secureCookies) throw new Error('SESSION_COOKIE_SECURE=false is not allowed in production');

  const apiDocs = (source.API_DOCS ?? (env === 'production' ? 'off' : 'authenticated')) as ApiConfig['apiDocs'];
  if (apiDocs !== 'off' && apiDocs !== 'authenticated') throw new Error('API_DOCS must be "off" or "authenticated"');
  if (env === 'production' && apiDocs !== 'off') throw new Error('API_DOCS must be "off" in production');

  return {
    env,
    // The API listens on loopback only; nginx is the public entry point (approved architecture §10).
    host: source.API_HOST ?? '127.0.0.1',
    port,
    logLevel,
    databaseUrl: source.DATABASE_URL ?? '',
    adminOrigin,
    webauthn: { rpId, rpName: source.WEBAUTHN_RP_NAME ?? 'Soltex Global Admin', origin: adminOrigin },
    encryption: { keys, currentKeyId },
    hashSecret: Buffer.from(hashSecretRaw, 'base64'),
    secureCookies,
    apiDocs,
    mfaForAllRoles: source.MFA_FOR_ALL_ROLES === 'true',
  };
}
