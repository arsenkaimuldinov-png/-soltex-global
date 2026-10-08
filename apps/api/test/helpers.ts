/**
 * Test helpers: configuration, a controllable clock, a recording notifier, a cookie-jar HTTP
 * client over `app.inject`, user factories and a software WebAuthn authenticator.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { generate as generateTotp } from 'otplib';
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import type { Role } from '@soltex/core/domain';
import { buildApp } from '../src/app.ts';
import { loadConfig, type ApiConfig } from '../src/config.ts';
import { connect } from '../src/db/client.ts';
import type { Deps } from '../src/deps.ts';
import type { NotifiedUser, Notifier, SecurityAlert } from '../src/notify/notifier.ts';
import { insertUser } from '../src/users/users.ts';

export const DB_ENABLED = !!process.env.DATABASE_URL && !!process.env.MIGRATION_DATABASE_URL;
export const ORIGIN = 'https://admin.soltex.test';

export function testConfig(env: Record<string, string> = {}): ApiConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    ADMIN_ORIGIN: ORIGIN,
    DATA_ENCRYPTION_KEYS: `t1:${crypto.randomBytes(32).toString('base64')}`,
    DATA_ENCRYPTION_KEY_ID: 't1',
    HASH_SECRET: crypto.randomBytes(32).toString('base64'),
    ...env,
  });
}

export class Clock {
  t = Date.now();
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

export class RecordingNotifier implements Notifier {
  resets: { userId: string; token: string }[] = [];
  alerts: { userId: string; alert: SecurityAlert }[] = [];
  async passwordReset(user: NotifiedUser, token: string) {
    this.resets.push({ userId: user.id, token });
  }
  async securityAlert(user: NotifiedUser, alert: SecurityAlert) {
    this.alerts.push({ userId: user.id, alert });
  }
}

/** Captures every log line the app writes. */
export class LogSink extends Writable {
  text = '';
  override _write(chunk: Buffer, _enc: string, done: () => void) {
    this.text += chunk.toString();
    done();
  }
}

let dbHandle: ReturnType<typeof connect> | null = null;
let migrated = false;

export async function testDb() {
  if (!DB_ENABLED) throw new Error('database tests need DATABASE_URL and MIGRATION_DATABASE_URL');
  if (!migrated) {
    const owner = connect(process.env.MIGRATION_DATABASE_URL!, 1);
    await migrate(owner.db, { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });
    await owner.close();
    migrated = true;
  }
  dbHandle ??= connect(process.env.DATABASE_URL!, 5);
  return dbHandle;
}

export async function closeTestDb() {
  await dbHandle?.close();
  dbHandle = null;
}

export interface TestApp {
  app: FastifyInstance;
  deps: Deps;
  clock: Clock;
  notifier: RecordingNotifier;
  logs: LogSink;
  config: ApiConfig;
}

export async function makeApp(env: Record<string, string> = {}): Promise<TestApp> {
  const { db } = await testDb();
  const config = testConfig({ API_LOG_LEVEL: 'info', ...env });
  const clock = new Clock();
  const notifier = new RecordingNotifier();
  const logs = new LogSink();
  const app = await buildApp({ config, db, now: clock.now, notifier, logStream: logs });
  await app.ready();
  return { app, clock, notifier, logs, config, deps: { config, db, now: clock.now, notifier } };
}

let ipCounter = 1;
/** A distinct client IP per test client, so per-IP rate limits do not interfere between tests. */
export const nextIp = () => `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

/** HTTP client with a cookie jar, the CSRF header and a fixed client IP. */
export class Client {
  cookies = new Map<string, string>();
  constructor(
    readonly t: TestApp,
    readonly ip = nextIp()
  ) {}

  async req(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> {
    const res = await this.t.app.inject({
      method,
      url,
      remoteAddress: this.ip,
      headers: {
        ...(method !== 'GET' ? { 'x-requested-with': 'soltex-admin' } : {}),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    for (const c of res.cookies as { name: string; value: string; maxAge?: number; expires?: Date }[]) {
      const expired = c.maxAge === 0 || (c.expires && c.expires.getTime() <= Date.now() - 1000 && !c.value);
      if (expired || c.value === '') this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    return res;
  }

  get sessionToken() {
    return this.cookies.get('__Host-soltex_session');
  }
}

export const STRONG_PASSWORD = 'Correct-Horse-Battery-Staple-42';

export async function createUser(t: TestApp, role: Role, password = STRONG_PASSWORD, email?: string) {
  const user = await insertUser(t.deps, {
    email: email ?? `${role}.${crypto.randomUUID().slice(0, 8)}@soltex.test`,
    name: `Test ${role}`,
    role,
    password,
    createdBy: null,
  });
  return user;
}

export async function login(c: Client, email: string, password = STRONG_PASSWORD) {
  return c.req('POST', '/api/v1/auth/login', { email, password });
}

/** Enroll TOTP for the signed-in user; returns the secret (and recovery codes if first factor). */
export async function enrollTotp(c: Client) {
  const start = await c.req('POST', '/api/v1/auth/mfa/totp/enroll');
  if (start.statusCode !== 200) throw new Error(`enroll: ${start.statusCode} ${start.body}`);
  const { secret } = start.json() as { secret: string };
  const code = await totpCode(secret, c.t.clock);
  const confirm = await c.req('POST', '/api/v1/auth/mfa/totp/confirm', { code });
  if (confirm.statusCode !== 200) throw new Error(`confirm: ${confirm.statusCode} ${confirm.body}`);
  return { secret, recoveryCodes: (confirm.json() as { recoveryCodes?: string[] }).recoveryCodes ?? [] };
}

export const totpCode = (secret: string, clock: Clock, offsetSeconds = 0) =>
  generateTotp({ secret, epoch: Math.floor(clock.t / 1000) + offsetSeconds });

/** Move the clock to the start of the next 30-second TOTP step (a code can be used only once). */
export const nextTotpStep = (clock: Clock) => clock.advance(30_000 - (clock.t % 30_000) + 1000);

// ---------------------------------------------------------------------------
// Software WebAuthn authenticator (ES256, "none" attestation, user verification)
// ---------------------------------------------------------------------------

export class SoftAuthenticator {
  readonly credentialId = crypto.randomBytes(32);
  private readonly keys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  signCount = 0;

  constructor(
    readonly rpId: string,
    readonly origin: string
  ) {}

  get id() {
    return isoBase64URL.fromBuffer(this.credentialId);
  }

  private cosePublicKey(): Uint8Array {
    const jwk = this.keys.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(Buffer.from(jwk.x, 'base64url'))],
        [-3, new Uint8Array(Buffer.from(jwk.y, 'base64url'))],
      ])
    );
  }

  private authData(attested: boolean, userVerified = true): Buffer {
    const rpIdHash = crypto.createHash('sha256').update(this.rpId).digest();
    const flags = 0x01 | (userVerified ? 0x04 : 0) | (attested ? 0x40 : 0); // UP | UV | AT
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.signCount);
    if (!attested) return Buffer.concat([rpIdHash, Buffer.from([flags]), count]);
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([rpIdHash, Buffer.from([flags]), count, Buffer.alloc(16), idLen, this.credentialId, Buffer.from(this.cosePublicKey())]);
  }

  private clientData(type: string, challenge: string, origin = this.origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  register(options: { challenge: string }, overrides: { origin?: string; userVerified?: boolean } = {}) {
    const attestationObject = isoCBOR.encode(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', new Uint8Array(this.authData(true, overrides.userVerified))]]) as never);
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(new Uint8Array(this.clientData('webauthn.create', options.challenge, overrides.origin))),
        attestationObject: isoBase64URL.fromBuffer(attestationObject),
        transports: ['internal'],
      },
    };
  }

  authenticate(options: { challenge: string }, overrides: { origin?: string; userVerified?: boolean } = {}) {
    this.signCount += 1;
    const authData = this.authData(false, overrides.userVerified);
    const clientData = this.clientData('webauthn.get', options.challenge, overrides.origin);
    const signature = crypto.sign('sha256', Buffer.concat([authData, crypto.createHash('sha256').update(clientData).digest()]), this.keys.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(new Uint8Array(clientData)),
        authenticatorData: isoBase64URL.fromBuffer(new Uint8Array(authData)),
        signature: isoBase64URL.fromBuffer(new Uint8Array(signature)),
      },
    };
  }
}

/** Register a passkey for the signed-in client (step-up must be fresh if a factor exists). */
export async function enrollPasskey(c: Client, name = 'Test key') {
  const auth = new SoftAuthenticator(c.t.config.webauthn.rpId, c.t.config.webauthn.origin);
  const opts = await c.req('POST', '/api/v1/auth/passkeys/registration/options');
  if (opts.statusCode !== 200) throw new Error(`options: ${opts.statusCode} ${opts.body}`);
  const verify = await c.req('POST', '/api/v1/auth/passkeys/registration/verify', { name, response: auth.register(opts.json()) });
  if (verify.statusCode !== 200) throw new Error(`verify: ${verify.statusCode} ${verify.body}`);
  return { auth, recoveryCodes: (verify.json() as { recoveryCodes?: string[] }).recoveryCodes ?? [] };
}

/** Complete a passkey check (second factor or step-up). */
export async function passkeyCheck(c: Client, auth: SoftAuthenticator) {
  const opts = await c.req('POST', '/api/v1/auth/passkeys/authentication/options');
  if (opts.statusCode !== 200) throw new Error(`auth options: ${opts.statusCode} ${opts.body}`);
  return c.req('POST', '/api/v1/auth/passkeys/authentication/verify', { response: auth.authenticate(opts.json()) });
}

/** A fully signed-in client for a user of `role` (with the second factor their role needs). */
export async function signedIn(t: TestApp, role: Role) {
  const user = await createUser(t, role);
  const c = new Client(t);
  const res = await login(c, user.email);
  if (res.statusCode !== 200) throw new Error(`login: ${res.statusCode} ${res.body}`);
  let passkey: SoftAuthenticator | null = null;
  let totpSecret: string | null = null;
  const next = (res.json() as { next: string }).next;
  if (next === 'mfa_enrollment_required') {
    if (role === 'owner' || role === 'admin') passkey = (await enrollPasskey(c)).auth;
    else totpSecret = (await enrollTotp(c)).secret;
  }
  return { user, c, passkey, totpSecret };
}

/** Problem-details assertions. */
export function problem(res: LightMyRequestResponse) {
  return { status: res.statusCode, type: res.headers['content-type'], body: res.json() as { code: string; request_id: string; status: number; title: string } };
}
