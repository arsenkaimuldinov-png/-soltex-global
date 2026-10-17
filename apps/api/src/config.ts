/**
 * API configuration from environment variables only (no secrets in code; see .env.example).
 * Values are validated at start-up; the process refuses to start with an invalid configuration.
 */
import path from 'node:path';
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
  /** Phase G publishing (docs/admin-publishing.md §5). */
  publishing: {
    /** Root of releases/, current, build/, blobs/ (production: /srv/soltex). Never inside apps/web. */
    releasesDir: string;
    /** Origin of the preview server, e.g. https://preview.soltexglobal.co */
    previewOrigin: string;
  };
  /** Public site origin used for redirect `Location` headers (Phase I-2, approved §11.3). */
  publicSiteUrl: string;
  /** Leads and e-mail (Phase K, approved §13, §19). */
  leads: {
    /** Recipients of new-lead notices; empty = notices wait in the outbox. */
    notifyTo: string[];
    /** Leads older than this are anonymized (client decision §22.4; proposal 24). */
    retentionMonths: number;
    /** Version of the privacy notice the forms display (approved §13.2); null until the text exists. */
    privacyNoticeVersion: string | null;
  };
  /** SMTP for all e-mail; null = not configured (mail waits in the outbox, nothing is lost). */
  mail: { smtpUrl: string; from: string } | null;
  /**
   * Switches of the public site's forms (Phase K-2), applied by the next site build. Both stay off
   * until the client approves the privacy texts (approved §13.2–§13.3, client decisions B3 / §22.6).
   */
  site: {
    /** The forms send leads to POST /api/v1/public/leads on PUBLIC_SITE_URL; off = demo service. */
    leadsEnabled: boolean;
    /** UTM attribution is recorded on the site and stored with leads; needs leadsEnabled. */
    attributionEnabled: boolean;
  };
  /** Media library (Phase J, review §I). */
  media: {
    /** Uploaded files: originals/<yyyy>/<uuid>.<ext> (served by nginx as /media/originals/…), previews/, tmp/. */
    dir: string;
    /** Where files imported "as is" (/images/…, /videos/…) are read for admin previews: the active release. */
    legacyDir: string;
  };
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

/**
 * Media directories alone (also used by `npm run media:variants`, which needs no keys or origins).
 * Production requires MEDIA_DIR; legacy files default to the active release.
 */
export function mediaConfig(source: Record<string, string | undefined>, env: AppEnv, releasesDir: string): ApiConfig['media'] {
  const dir = path.resolve(source.MEDIA_DIR ?? (env === 'production' ? '' : path.resolve(import.meta.dirname, '../../../.media')));
  if (env === 'production' && !source.MEDIA_DIR) throw new Error('MEDIA_DIR must be set in production (e.g. /srv/soltex/media)');
  const legacyDir = path.resolve(source.MEDIA_LEGACY_DIR ?? (env === 'production' ? path.join(releasesDir, 'current') : path.resolve(import.meta.dirname, '../../web/public')));
  return { dir, legacyDir };
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

  const releasesDir = path.resolve(source.RELEASES_DIR ?? (env === 'production' ? '' : path.resolve(import.meta.dirname, '../../../.releases')));
  if (env === 'production' && !source.RELEASES_DIR) throw new Error('RELEASES_DIR must be set in production (e.g. /srv/soltex)');
  const previewOrigin = (source.PREVIEW_ORIGIN ?? (env === 'production' ? '' : 'http://localhost:4176')).replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(previewOrigin)) throw new Error('PREVIEW_ORIGIN must be an origin, e.g. https://preview.soltexglobal.co');
  if (env === 'production' && !previewOrigin.startsWith('https://')) throw new Error('PREVIEW_ORIGIN must use https in production');
  if (previewOrigin === adminOrigin) throw new Error('PREVIEW_ORIGIN must differ from ADMIN_ORIGIN (approved §10)');

  const publicSiteUrl = (source.PUBLIC_SITE_URL ?? 'https://soltexglobal.co').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(publicSiteUrl)) throw new Error('PUBLIC_SITE_URL must be an origin, e.g. https://soltexglobal.co');
  if (env === 'production' && !publicSiteUrl.startsWith('https://')) throw new Error('PUBLIC_SITE_URL must use https in production');

  const { dir: mediaDir, legacyDir } = mediaConfig(source, env, releasesDir);

  const notifyTo = (source.LEAD_NOTIFY_TO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  for (const a of notifyTo) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) throw new Error('LEAD_NOTIFY_TO must be a comma-separated list of e-mail addresses');
  const retentionMonths = Number(source.LEAD_RETENTION_MONTHS ?? 24);
  if (!Number.isInteger(retentionMonths) || retentionMonths < 1 || retentionMonths > 120) throw new Error('LEAD_RETENTION_MONTHS must be an integer 1–120');
  const smtpUrl = source.SMTP_URL ?? '';
  if (smtpUrl && !/^smtps?:\/\/[^\s]+$/.test(smtpUrl)) throw new Error('SMTP_URL must be smtp://… or smtps://…');
  if (smtpUrl && !source.MAIL_FROM) throw new Error('MAIL_FROM must be set together with SMTP_URL');
  const flag = (name: string) => {
    const v = source[name];
    if (v === undefined || v === '' || v === 'false') return false;
    if (v === 'true') return true;
    throw new Error(`${name} must be true or false`);
  };
  const leadsEnabled = flag('SITE_LEADS_ENABLED');
  const attributionEnabled = flag('ATTRIBUTION_ENABLED');
  if (attributionEnabled && !leadsEnabled) throw new Error('ATTRIBUTION_ENABLED needs SITE_LEADS_ENABLED=true (attribution is sent with leads)');

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
    publishing: { releasesDir, previewOrigin },
    publicSiteUrl,
    media: { dir: mediaDir, legacyDir },
    leads: { notifyTo, retentionMonths, privacyNoticeVersion: source.PRIVACY_NOTICE_VERSION?.trim() || null },
    mail: smtpUrl ? { smtpUrl, from: source.MAIL_FROM! } : null,
    site: { leadsEnabled, attributionEnabled },
  };
}
