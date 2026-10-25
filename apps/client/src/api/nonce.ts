import * as Crypto from 'expo-crypto';

/** Bytes as lower-case hex. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * A one-time value for Sign in with Apple. Apple signs the SHA-256 of it into
 * the identity token, and Supabase is handed the raw value and checks the
 * hash, so a token lifted from one sign-in can't be replayed in another.
 */
export async function appleNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(Crypto.getRandomBytes(32));
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
