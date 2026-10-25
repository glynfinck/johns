import type { Session } from '@supabase/supabase-js';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useMembership } from '@/hooks/use-membership';

// The real root layout and its guard, with stand-in screens.
jest.mock('@/hooks/use-membership', () => ({
  MembershipProvider: ({ children }: { children: React.ReactNode }) => children,
  useMembership: jest.fn(),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const routes = {
  _layout: RootLayout,
  index: () => <Text>Front door</Text>,
  signin: () => <Text>Sign in</Text>,
  welcome: () => <Text>Welcome</Text>,
  'house/new': () => <Text>New house</Text>,
  '(house)/_layout': () => <Slot />,
  '(house)/today': () => <Text>Today</Text>,
  '(house)/week': () => <Text>Week</Text>,
  'join/[joinCode]': () => <Text>Join</Text>,
};

const SESSION = { user: { id: 'user-1' } } as Session;
const FLAT = { id: 'h1', name: 'Flat 3' };
const refresh = jest.fn();

function as(session: Session | null, house: typeof FLAT | null = null, state: { loading?: boolean; failed?: boolean } = {}) {
  (useMembership as jest.Mock).mockReturnValue({ session, house, loading: false, failed: false, refresh, ...state });
}

async function open(url: string) {
  await renderRouter(routes, { initialUrl: url });
}

describe('signed out', () => {
  beforeEach(() => as(null));

  it('opens on the front door', async () => {
    await open('/');
    expect(screen.getByText('Front door')).toBeOnTheScreen();
  });

  it('sends every signed-in screen to sign-in', async () => {
    for (const url of ['/today', '/week', '/welcome', '/house/new']) {
      await open(url);
      expect(screen).toHavePathname('/signin');
    }
  });

  it('still opens a join link, which signs you in itself', async () => {
    await open('/join/AB3DEF7H');
    expect(screen.getByText('Join')).toBeOnTheScreen();
  });
});

describe('signed in, in no house', () => {
  beforeEach(() => as(SESSION));

  it('goes to starting or joining a house, from anywhere else', async () => {
    for (const url of ['/', '/signin', '/today', '/week']) {
      await open(url);
      expect(screen).toHavePathname('/welcome');
    }
  });

  it('can start a house', async () => {
    await open('/house/new');
    expect(screen.getByText('New house')).toBeOnTheScreen();
  });
});

describe('in a house', () => {
  beforeEach(() => as(SESSION, FLAT));

  it('goes to Today, from anywhere else', async () => {
    for (const url of ['/', '/signin', '/welcome', '/house/new']) {
      await open(url);
      expect(screen).toHavePathname('/today');
    }
  });

  it("opens the house's other screens", async () => {
    await open('/week');
    expect(screen).toHavePathname('/week');
    expect(screen.getByText('Week')).toBeOnTheScreen();
  });

  it('still opens a join link, which says you are in a house already', async () => {
    await open('/join/AB3DEF7H');
    expect(screen.getByText('Join')).toBeOnTheScreen();
  });
});

it('shows nothing until the session and its house have been read', async () => {
  as(null, null, { loading: true });
  await open('/today');
  for (const text of ['Front door', 'Sign in', 'Welcome', 'Today']) expect(screen.queryByText(text)).toBeNull();
});

it("offers to try again when the house can't be read", async () => {
  as(SESSION, null, { failed: true });
  await open('/today');
  expect(screen.queryByText('Welcome')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refresh).toHaveBeenCalled();
});
