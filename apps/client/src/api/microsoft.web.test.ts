import { signInWithMicrosoft } from './microsoft.web';
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

describe('signInWithMicrosoft on the web', () => {
  it("leaves for Microsoft through Supabase, asking for the email and the photo, and comes back to this site's sign-in", async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    await expect(signInWithMicrosoft()).resolves.toBe('redirected');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'azure',
      options: { redirectTo: 'http://localhost:8205/signin', scopes: 'email User.Read' },
    });
  });

  it('comes back to a join link when one asked', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    await signInWithMicrosoft('/join/AB3DEF7H');
    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe('http://localhost:8205/join/AB3DEF7H');
  });

  it('fails when the redirect cannot start', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('provider is not enabled') });
    await expect(signInWithMicrosoft()).rejects.toThrow('provider is not enabled');
  });
});
