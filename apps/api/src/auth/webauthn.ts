/**
 * Passkeys / WebAuthn via @simplewebauthn/server (approved §7: preferred factor; required for
 * Owner and Admin).
 *
 *  - Only public data is stored: credential id, COSE public key, signature counter, transports.
 *  - Challenges are random, stored server-side, bound to ONE session, user and purpose, valid
 *    5 minutes and consumed atomically on first use: a replayed response is always rejected.
 *  - User verification (PIN / biometrics on the device) is required.
 *  - A credential is only ever used for the user who owns it.
 */
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { decodeClientDataJSON } from '@simplewebauthn/server/helpers';
import { webauthnChallenges, webauthnCredentials } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { Problem } from '../http/problem.ts';
import type { SessionRow, UserRow } from './sessions.ts';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Purpose = 'registration' | 'authentication';

/** Stable, non-identifying WebAuthn user handle: the 16 bytes of the user's UUID. */
const userHandle = (userId: string) => new Uint8Array(Buffer.from(userId.replace(/-/g, ''), 'hex'));

async function storeChallenge(deps: Deps, challenge: string, purpose: Purpose, session: SessionRow) {
  const now = deps.now();
  await requireDb(deps)
    .insert(webauthnChallenges)
    .values({ challenge, purpose, sessionId: session.id, userId: session.userId, createdAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) });
}

/** Consume the challenge named in the client data: exactly once, same session, same purpose, not expired. */
async function consumeChallenge(deps: Deps, clientDataJSON: string, purpose: Purpose, session: SessionRow): Promise<string> {
  let challenge: string;
  try {
    challenge = decodeClientDataJSON(clientDataJSON).challenge;
  } catch {
    throw new Problem('challenge_invalid');
  }
  const [row] = await requireDb(deps)
    .update(webauthnChallenges)
    .set({ usedAt: deps.now() })
    .where(
      and(
        eq(webauthnChallenges.challenge, challenge),
        eq(webauthnChallenges.sessionId, session.id),
        eq(webauthnChallenges.userId, session.userId),
        eq(webauthnChallenges.purpose, purpose),
        isNull(webauthnChallenges.usedAt),
        gt(webauthnChallenges.expiresAt, deps.now())
      )
    )
    .returning({ challenge: webauthnChallenges.challenge });
  if (!row) throw new Problem('challenge_invalid');
  return row.challenge;
}

export async function passkeyRegistrationOptions(deps: Deps, session: SessionRow, user: UserRow): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await requireDb(deps).select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
  const options = await generateRegistrationOptions({
    rpName: deps.config.webauthn.rpName,
    rpID: deps.config.webauthn.rpId,
    userName: user.email,
    userDisplayName: user.name,
    userID: userHandle(user.id),
    attestationType: 'none',
    timeout: CHALLENGE_TTL_MS,
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransport[] })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  });
  await storeChallenge(deps, options.challenge, 'registration', session);
  return options;
}

export async function verifyPasskeyRegistration(
  deps: Deps,
  session: SessionRow,
  user: UserRow,
  response: RegistrationResponseJSON,
  name: string
): Promise<{ id: string }> {
  const expectedChallenge = await consumeChallenge(deps, response.response.clientDataJSON, 'registration', session);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: deps.config.webauthn.origin,
      expectedRPID: deps.config.webauthn.rpId,
      requireUserVerification: true,
    });
  } catch {
    throw new Problem('mfa_invalid');
  }
  if (!verification.verified) throw new Problem('mfa_invalid');
  const info = verification.registrationInfo;
  const db = requireDb(deps);
  const [dupe] = await db.select({ id: webauthnCredentials.id }).from(webauthnCredentials).where(eq(webauthnCredentials.credentialId, info.credential.id));
  if (dupe) throw new Problem('conflict', 'Этот ключ уже зарегистрирован');
  const [row] = await db
    .insert(webauthnCredentials)
    .values({
      userId: user.id,
      credentialId: info.credential.id,
      publicKey: info.credential.publicKey,
      signCount: info.credential.counter,
      transports: info.credential.transports ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      name,
      createdAt: deps.now(),
    })
    .returning({ id: webauthnCredentials.id });
  return { id: row!.id };
}

export async function passkeyAuthenticationOptions(deps: Deps, session: SessionRow, user: UserRow): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const creds = await requireDb(deps).select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
  if (!creds.length) throw new Problem('conflict', 'У пользователя нет ключей доступа');
  const options = await generateAuthenticationOptions({
    rpID: deps.config.webauthn.rpId,
    timeout: CHALLENGE_TTL_MS,
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransport[] })),
  });
  await storeChallenge(deps, options.challenge, 'authentication', session);
  return options;
}

/** Verify a passkey assertion for the session's user. Returns false on any mismatch. */
export async function verifyPasskeyAuthentication(deps: Deps, session: SessionRow, user: UserRow, response: AuthenticationResponseJSON): Promise<boolean> {
  const expectedChallenge = await consumeChallenge(deps, response.response.clientDataJSON, 'authentication', session);
  const db = requireDb(deps);
  // Ownership: the credential must belong to THIS user.
  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(and(eq(webauthnCredentials.credentialId, response.id), eq(webauthnCredentials.userId, user.id)));
  if (!cred) return false;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: deps.config.webauthn.origin,
      expectedRPID: deps.config.webauthn.rpId,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: cred.signCount,
        transports: cred.transports as AuthenticatorTransport[],
      },
    });
    if (!result.verified) return false;
    await db
      .update(webauthnCredentials)
      .set({ signCount: result.authenticationInfo.newCounter, lastUsedAt: deps.now() })
      .where(eq(webauthnCredentials.id, cred.id));
    return true;
  } catch {
    return false;
  }
}

export async function listPasskeys(deps: Deps, userId: string) {
  return requireDb(deps)
    .select({
      id: webauthnCredentials.id,
      name: webauthnCredentials.name,
      deviceType: webauthnCredentials.deviceType,
      backedUp: webauthnCredentials.backedUp,
      createdAt: webauthnCredentials.createdAt,
      lastUsedAt: webauthnCredentials.lastUsedAt,
    })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .orderBy(webauthnCredentials.createdAt);
}

/** Remove one of the user's own passkeys (ownership enforced in the query). */
export async function removePasskey(deps: Deps, userId: string, id: string): Promise<boolean> {
  const r = await requireDb(deps)
    .delete(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, userId)))
    .returning({ id: webauthnCredentials.id });
  return r.length === 1;
}
