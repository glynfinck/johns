import { signInWithGoogle, signOutOfGoogle } from './google.web';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { auth: { signInWithOAuth: jest.fn() } } }));

const signInWithOAuth = supabase.auth.signInWithOAuth as jest.Mock;

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { location: { origin: 'http://localhost:8205' } },
    configurable: true,
  });
});

beforeEach(() => signInWithOAuth.mockReset());

describe('signInWithGoogle on the web', () => {
  it("leaves for Google through Supabase and comes back to this site's sign-in", async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    await expect(signInWithGoogle()).resolves.toBe('redirected');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:8205/signin' },
    });
  });

  it('fails when the redirect cannot start', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('provider is not enabled') });
    await expect(signInWithGoogle()).rejects.toThrow('provider is not enabled');
  });

  it('has no Google account of its own to forget', async () => {
    await expect(signOutOfGoogle()).resolves.toBeUndefined();
  });
});
