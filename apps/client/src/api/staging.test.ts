import { authStorage } from './storage';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() } } }));

const signInWithPassword = supabase.auth.signInWithPassword as unknown as jest.Mock;

jest.mock('./google', () => ({ signOutOfGoogle: jest.fn() }));

/** Sign-in and the staging module as a build with this EXPO_PUBLIC_STAGE would have them. */
function load(stage: string | undefined) {
  const saved = process.env.EXPO_PUBLIC_STAGE;
  process.env.EXPO_PUBLIC_STAGE = stage;
  try {
    let mod!: typeof import('./staging') & Pick<typeof import('./auth'), 'signInAsDemo'>;
    jest.isolateModules(() => {
      mod = { ...require('./staging'), signInAsDemo: require('./auth').signInAsDemo };
    });
    return mod;
  } finally {
    process.env.EXPO_PUBLIC_STAGE = saved;
  }
}

beforeEach(() => {
  signInWithPassword.mockReset();
  authStorage!.clear();
});

describe('demo sign-in', () => {
  it('is staging only', async () => {
    const prod = load(undefined);
    expect(prod.ON_STAGING).toBe(false);
    await expect(prod.signInAsDemo('alex@demo.jonz.app', 'password1')).rejects.toThrow(/staging/);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with the password, and remembers it only once it worked', async () => {
    const staging = load('staging');
    expect(staging.ON_STAGING).toBe(true);

    signInWithPassword.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    await expect(staging.signInAsDemo('alex@demo.jonz.app', 'wrong-one')).rejects.toThrow();
    expect(staging.savedStagingPassword()).toBe('');

    signInWithPassword.mockResolvedValueOnce({ error: null });
    await staging.signInAsDemo('sam@demo.jonz.app', 'right-one');
    expect(signInWithPassword).toHaveBeenLastCalledWith({ email: 'sam@demo.jonz.app', password: 'right-one' });
    expect(staging.savedStagingPassword()).toBe('right-one');
  });
});
