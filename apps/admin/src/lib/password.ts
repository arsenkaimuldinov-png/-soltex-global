/**
 * A random initial password for a new user: 24 characters from a 56-character alphabet without
 * look-alikes (≈ 139 bits), grouped by 6 for dictation. Generated in the browser with the Web
 * Crypto API (rejection sampling, no modulo bias); it goes only into the create-user request.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length = 24, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const b of random(length * 2)) {
      if (b >= limit) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out.match(/.{1,6}/g)!.join('-');
}
