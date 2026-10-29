import * as WebBrowser from 'expo-web-browser';

import { sessionFromReturn, signInWithMicrosoft } from './microsoft';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { auth: { signInWithOAuth: jest.fn(), setSession: jest.fn() } } }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `jonz://${path}` }));

const signInWithOAuth = supabase.auth.signInWithOAuth as jest.Mock;
const setSession = supabase.auth.setSession as jest.Mock;
const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ data: { url: 'https://example.supabase.co/auth/v1/authorize?provider=azure' }, error: null });
  setSession.mockResolvedValue({ data: {}, error: null });
});

describe('sessionFromReturn', () => {
  it('reads the session from the fragment', () => {
    expect(sessionFromReturn('jonz://signin#access_token=at&refresh_token=rt&expires_in=3600')).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it("reads Microsoft's or Supabase's refusal, from the fragment or the query", () => {
    expect(sessionFromReturn('jonz://signin#error=access_denied&error_description=User+cancelled')).toEqual({ error: 'User cancelled' });
    expect(sessionFromReturn('jonz://signin?error=server_error')).toEqual({ error: 'server_error' });
    expect(sessionFromReturn('jonz://signin')).toEqual({ error: 'Microsoft sent no session.' });
  });
});

describe('signInWithMicrosoft on a phone', () => {
  it("opens Microsoft in the system's sign-in browser and keeps the session it comes back with", async () => {
    openAuthSession.mockResolvedValue({ type: 'success', url: 'jonz://signin#access_token=at&refresh_token=rt' });
    await expect(signInWithMicrosoft()).resolves.toBe('signed-in');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'azure',
      options: { redirectTo: 'jonz://signin', scopes: 'email', skipBrowserRedirect: true },
    });
    expect(openAuthSession).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/authorize?provider=azure', 'jonz://signin');
    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it('counts closing the browser as cancelled, not a failure', async () => {
    openAuthSession.mockResolvedValue({ type: 'cancel' });
    await expect(signInWithMicrosoft()).resolves.toBe('cancelled');
    expect(setSession).not.toHaveBeenCalled();
  });

  it('fails when Microsoft refuses, or Supabase cannot start', async () => {
    openAuthSession.mockResolvedValue({ type: 'success', url: 'jonz://signin#error=access_denied' });
    await expect(signInWithMicrosoft()).rejects.toThrow('access_denied');
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error('provider is not enabled') });
    await expect(signInWithMicrosoft()).rejects.toThrow('provider is not enabled');
  });
});
