/**
 * Browser side of passkeys (@simplewebauthn/browser). The API issues single-use challenges bound
 * to the session (admin-auth.md §4); this module only runs the browser ceremony and maps
 * browser errors to Russian messages.
 */
import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import { api } from './api/client';

export class PasskeyError extends Error {
  constructor(
    message: string,
    readonly cancelled = false
  ) {
    super(message);
    this.name = 'PasskeyError';
  }
}

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();

function translate(e: unknown): PasskeyError {
  if (e instanceof PasskeyError) return e;
  const name = e instanceof WebAuthnError ? (e.cause as Error | undefined)?.name ?? e.name : (e as Error | undefined)?.name;
  const code = e instanceof WebAuthnError ? e.code : undefined;
  if (name === 'NotAllowedError' || code === 'ERROR_CEREMONY_ABORTED')
    return new PasskeyError('Подтверждение отменено или время ожидания истекло.', true);
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError')
    return new PasskeyError('Этот ключ доступа уже добавлен в вашу учётную запись.');
  if (name === 'SecurityError') return new PasskeyError('Браузер не разрешил использовать ключ доступа на этом адресе.');
  return new PasskeyError('Не удалось использовать ключ доступа. Попробуйте ещё раз или выберите другой способ.');
}

/** Sign-in or step-up with a passkey. Returns the API response (session view). */
export async function authenticateWithPasskey() {
  if (!passkeysSupported()) throw new PasskeyError('Этот браузер не поддерживает ключи доступа.');
  const options = await api('POST /api/v1/auth/passkeys/authentication/options');
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options as never });
  } catch (e) {
    throw translate(e);
  }
  return api('POST /api/v1/auth/passkeys/authentication/verify', { body: { response: response as never } });
}

/** Register a new passkey for the signed-in user. */
export async function registerPasskey(name: string) {
  if (!passkeysSupported()) throw new PasskeyError('Этот браузер не поддерживает ключи доступа.');
  const options = await api('POST /api/v1/auth/passkeys/registration/options');
  let response;
  try {
    response = await startRegistration({ optionsJSON: options as never });
  } catch (e) {
    throw translate(e);
  }
  return api('POST /api/v1/auth/passkeys/registration/verify', { body: { name, response: response as never } });
}

/** A sensible default name for a new passkey ("Ключ — Chrome на macOS"). */
export function defaultPasskeyName(device: string): string {
  return `Ключ — ${device}`.slice(0, 60);
}
