import { createHash } from 'node:crypto';

import { appleNonce, toHex } from './nonce';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(count)),
  digestStringAsync: async (_algorithm: string, data: string) =>
    jest.requireActual<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(data).digest('hex'),
}));

describe('toHex', () => {
  it('writes each byte as two lower-case digits', () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
    expect(toHex(new Uint8Array([]))).toBe('');
  });
});

describe('appleNonce', () => {
  it('hands Apple the SHA-256 of the value Supabase checks', async () => {
    const { raw, hashed } = await appleNonce();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  it('is new every time', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) seen.add((await appleNonce()).raw);
    expect(seen.size).toBe(20);
  });
});
