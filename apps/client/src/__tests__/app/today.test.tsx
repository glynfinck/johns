import { INVITE_COPY, JOHN_COPY, NOT_DEALT_COPY, SIGN_IN_COPY, TODAY_COPY } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { signOut } from '@/api/auth';
import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { markDone } from '@/api/johns';
import Today from '@/app/today';
import { assignment, snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/supabase', () => {
  const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  return {
    supabase: {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      realtime: { setAuth: jest.fn() },
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const read = loadHouse as jest.Mock;
const leave = signOut as jest.Mock;

async function show() {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      today: Today,
    },
    { initialUrl: '/today' },
  );
}

async function open() {
  await show();
  await screen.findByText(TODAY_COPY.title);
}

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (markDone as jest.Mock).mockResolvedValue(undefined);
});

it('names the house and who is signed in', async () => {
  await open();
  expect(screen.getByText('Flat 3')).toBeOnTheScreen();
  expect(screen.getByText('Signed in as Priya')).toBeOnTheScreen();
  expect(read).toHaveBeenCalledWith('h1', expect.any(Date));
});

it('shows only your Johns, how many are left, and your streak', async () => {
  await open();
  expect(screen.getByTestId('johns-left')).toHaveTextContent('2');
  expect(screen.getByText(TODAY_COPY.left(2))).toBeOnTheScreen();
  expect(screen.getByText(TODAY_COPY.streak(3))).toBeOnTheScreen();
  expect(screen.getAllByTestId('john-card').map((card) => card.props.accessibilityLabel)).toEqual([
    'Bins out, Bins & recycling',
    'Hoover the stairs, Floors & hoovering',
    'Wipe the hob, Kitchen',
  ]);
  expect(screen.queryByText('Clean the bath')).toBeNull();
});

it('ticks a John, and reads the house again', async () => {
  await open();
  read.mockResolvedValue(snapshot({ assignments: [assignment({ done_at: new Date().toISOString() })] }));
  await fireEvent.press(screen.getAllByRole('button', { name: JOHN_COPY.markDone })[0]);
  expect(markDone).toHaveBeenCalledWith('a1');
  await waitFor(() => expect(screen.getByTestId('johns-left')).toHaveTextContent('0'));
  expect(screen.getByText('Done, being checked')).toBeOnTheScreen();
});

it('says so when nothing on the list is yours this week', async () => {
  read.mockResolvedValue(snapshot({ assignments: [assignment({ user_id: 'sam' })] }));
  await open();
  expect(screen.getByText(TODAY_COPY.nothingYours)).toBeOnTheScreen();
});

it('asks the first housemate to invite the rest', async () => {
  read.mockResolvedValue(snapshot({ members: snapshot().members.slice(0, 1) }));
  await open();
  expect(screen.getByText(INVITE_COPY.heading)).toBeOnTheScreen();
});

it("shows how to start before the first week, with the invite", async () => {
  read.mockResolvedValue(snapshot({ week: null, assignments: [], house: { ...snapshot().house, everDealt: false } }));
  await open();
  expect(screen.getByRole('header', { name: NOT_DEALT_COPY.notYet })).toBeOnTheScreen();
  expect(screen.getByTestId('invite-url')).toHaveTextContent('https://johns.glyn.dev/join/AB3DEF7H');
  expect(screen.queryByTestId('john-card')).toBeNull();
});

describe('catching up', () => {
  it('catches the house up as it comes into view', async () => {
    await open();
    expect(catchUp).toHaveBeenCalledWith('h1');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads the house again when the server had something to do', async () => {
    (catchUp as jest.Mock).mockResolvedValue(true);
    await open();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  });

  it("doesn't mind when catching up fails", async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (catchUp as jest.Mock).mockRejectedValue(new Error('offline'));
    await open();
    expect(screen.getByText('Flat 3')).toBeOnTheScreen();
  });
});

it("says when it can't read the house, and tries again", async () => {
  read.mockRejectedValueOnce(new Error('offline'));
  await show();
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't read the house. Check the connection.");
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(TODAY_COPY.title)).toBeOnTheScreen();
});

it('signs out, and lets you try again when that fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  leave.mockRejectedValueOnce(new Error('offline'));
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(leave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: SIGN_IN_COPY.signOut })).toBeEnabled();
});
