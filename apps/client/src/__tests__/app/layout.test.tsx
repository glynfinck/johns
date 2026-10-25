import type { Session } from '@supabase/supabase-js';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSession } from '@/hooks/use-session';

// The real root layout and its guard, with stand-in screens.
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const routes = {
  _layout: RootLayout,
  index: () => <Text>Front door</Text>,
  signin: () => <Text>Sign in</Text>,
  today: () => <Text>Today</Text>,
};

const SESSION = { user: { id: 'user-1' } } as Session;

function as(session: Session | null, loading = false) {
  (useSession as jest.Mock).mockReturnValue({ session, loading });
}

describe('signed out', () => {
  beforeEach(() => as(null));

  it('opens on the front door and sign-in', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen).toHavePathname('/');
    expect(screen.getByText('Front door')).toBeOnTheScreen();
  });

  it('sends a signed-in screen to sign-in', async () => {
    await renderRouter(routes, { initialUrl: '/today' });
    expect(screen).toHavePathname('/signin');
  });
});

describe('signed in', () => {
  beforeEach(() => as(SESSION));

  it('skips the front door and sign-in', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen).toHavePathname('/today');
    await renderRouter(routes, { initialUrl: '/signin' });
    expect(screen).toHavePathname('/today');
  });

  it('opens Today', async () => {
    await renderRouter(routes, { initialUrl: '/today' });
    expect(screen.getByText('Today')).toBeOnTheScreen();
  });
});

it('shows nothing until the saved session has been read', async () => {
  as(null, true);
  await renderRouter(routes, { initialUrl: '/today' });
  expect(screen.queryByText('Today')).toBeNull();
  expect(screen.queryByText('Front door')).toBeNull();
  expect(screen.queryByText('Sign in')).toBeNull();
});
