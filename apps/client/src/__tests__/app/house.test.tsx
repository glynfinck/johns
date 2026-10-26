import { FOCUS_SHELL_COPY, HOUSE_COPY, MAKEUP_LABEL, ME_COPY, PAGE_TITLE, STAKE_COPY, TABLE_COPY, WALL_COPY } from '@app/core';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { signOut } from '@/api/auth';
import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { renameMe } from '@/api/profile';
import { removeMember } from '@/api/settings';
import { authStorage } from '@/api/storage';
import { loadTable } from '@/api/table';
import HouseScreen from '@/app/(house)/house';
import { assignment, snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/profile', () => ({ renameMe: jest.fn() }));
jest.mock('@/api/settings', () => ({ removeMember: jest.fn(), setRole: jest.fn() }));
jest.mock('@/api/table', () => ({ loadTable: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const mockMembership = { refresh: jest.fn() };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({
    session: { user: { id: 'priya' } },
    house: { id: 'h1', name: 'Flat 3' },
    refresh: mockMembership.refresh,
  }),
}));

/** House, with the pages it pushes standing in as their names. */
async function open() {
  await renderPages(
    {
      'house/index': HouseScreen,
      'house/stake': () => <Text>Stake page</Text>,
      'house/wall': () => <Text>Wall page</Text>,
      'house/johns': () => <Text>John list page</Text>,
      'house/people/[userId]': () => <Text>Person page</Text>,
    },
    '/house',
  );
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  authStorage!.clear();
  const members = snapshot().members.map((m) => (m.userId === 'sam' ? { ...m, streak: 5, swapTokens: 1 } : m));
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({
      members,
      assignments: [
        assignment({ id: 'a1', done_at: new Date(Date.now() - 3_600_000).toISOString(), points: 3 }),
        assignment({ id: 'a2', user_id: 'sam', points: 5 }),
      ],
    }),
  );
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadTable as jest.Mock).mockResolvedValue({
    month: '2026-10',
    monthTable: [
      { userId: 'sam', points: 12, done: 4, late: 1, missed: 0, rank: 1 },
      { userId: 'priya', points: 9, done: 3, late: 0, missed: 1, rank: 2 },
    ],
    balances: [
      { userId: 'priya', balance: -3, weeksToEven: 2 },
      { userId: 'sam', balance: 3, weeksToEven: 0 },
    ],
  });
  for (const move of [renameMe, signOut, removeMember]) (move as jest.Mock).mockResolvedValue(undefined);
});

it('names the house in the title bar, and how many live there', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
  expect(bar.getByText('2 housemates')).toBeOnTheScreen();
  // House is a tab's top: there's no way back from it.
  expect(bar.queryByRole('button', { name: FOCUS_SHELL_COPY.back })).toBeNull();
});

it('leads to the Stake and the Wall', async () => {
  await open();
  expect(screen.getByTestId('to-stake')).toHaveTextContent(new RegExp(`${STAKE_COPY.title}.*${STAKE_COPY.eyebrow('£20')}`));
  await fireEvent.press(screen.getByRole('link', { name: new RegExp(WALL_COPY.title) }));
  expect(screen).toHavePathname('/house/wall');
  expect(screen.getByText('Wall page')).toBeOnTheScreen();
});

it("leads to the house's setup pages", async () => {
  await open();
  for (const page of [PAGE_TITLE.johnList, PAGE_TITLE.rules, PAGE_TITLE.away, PAGE_TITLE.groups]) {
    expect(screen.getByRole('link', { name: page })).toBeOnTheScreen();
  }
  await fireEvent.press(screen.getByRole('link', { name: PAGE_TITLE.johnList }));
  expect(screen).toHavePathname('/house/johns');
});

it('names everyone and their role, you included, each a way to their page', async () => {
  await open();
  const [priya, sam] = screen.getAllByTestId('member');
  expect(priya).toHaveTextContent(/Priya \(you\).*Admin/);
  expect(sam).toHaveTextContent(/Sam.*Housemate/);
  await fireEvent.press(within(sam).getByRole('link'));
  expect(screen).toHavePathname('/house/people/sam');
});

it('reads the house again each time House comes into view', async () => {
  await renderPages(
    {
      '(tabs)/_layout': () => (
        <Tabs screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="house" />
          <Tabs.Screen name="week" />
        </Tabs>
      ),
      '(tabs)/house': HouseScreen,
      '(tabs)/week': () => <Text>Week screen</Text>,
    },
    '/house',
  );
  await untilRead();
  expect(screen.getByTestId('to-stake')).toHaveTextContent(new RegExp(STAKE_COPY.eyebrow('£20')));
  // Someone else changes the stake while you're on another tab.
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ rules: { ...snapshot().rules, stakeMinor: 2500 } }));
  await act(() => router.navigate('/week'));
  await act(() => router.navigate('/house'));
  await waitFor(() => expect(screen.getByTestId('to-stake')).toHaveTextContent(new RegExp(STAKE_COPY.eyebrow('£25'))));
});

it("says when it can't read the house, and tries again", async () => {
  (loadHouse as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await renderPages({ 'house/index': HouseScreen }, '/house');
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
  expect(await screen.findByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
});

describe('you', () => {
  it('renames you', async () => {
    await open();
    expect(screen.getByRole('header', { name: HOUSE_COPY.you })).toBeOnTheScreen();
    expect(screen.getByTestId('save-name')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('my-name'), 'Priya P');
    await fireEvent.press(screen.getByTestId('save-name'));
    expect(renameMe).toHaveBeenCalledWith('priya', 'Priya P');
    expect(await screen.findByText(ME_COPY.saved)).toBeOnTheScreen();
  });

  it('still says your name saved once the house is read again with it', async () => {
    await open();
    const renamed = snapshot().members.map((m) => (m.userId === 'priya' ? { ...m, name: 'Priya P' } : m));
    (loadHouse as jest.Mock).mockResolvedValue(snapshot({ members: renamed }));
    await fireEvent.changeText(screen.getByTestId('my-name'), 'Priya P');
    await fireEvent.press(screen.getByTestId('save-name'));
    await waitFor(() => expect(screen.getAllByTestId('member')[0]).toHaveTextContent(/Priya P/));
    expect(screen.getByText(ME_COPY.saved)).toBeOnTheScreen();
    expect(screen.getByTestId('save-name')).toBeDisabled();
  });

  it('chooses the look for this device', async () => {
    await open();
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Night' }));
    expect(screen.getByRole('radio', { name: 'Night' })).toBeChecked();
    expect(authStorage!.getItem('theme')).toBe('dark');
  });

  it('signs you out, and lets you try again when that fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await open();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sign-out')).toBeEnabled();
  });

  it('asks twice before you leave, then lets the guard move you on', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.stay }));
    expect(removeMember).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByTestId('leave-house'));
    expect(removeMember).toHaveBeenCalledWith('h1', 'priya');
    expect(mockMembership.refresh).toHaveBeenCalled();
  });

  it("says why you can't leave", async () => {
    (removeMember as jest.Mock).mockRejectedValue(new Error('Make someone else an admin first. A house needs at least one.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByTestId('leave-house'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Make someone else an admin first/);
    expect(mockMembership.refresh).not.toHaveBeenCalled();
  });
});

// The old Table, parked at the foot of House until the House track rebuilds it.
describe('the Table, for now', () => {
  it("ranks the week and the month, with each person's record", async () => {
    await open();
    const table = within(screen.getByTestId('house-table'));
    expect(await table.findByText('October 2026')).toBeOnTheScreen();
    const standings = table.getAllByTestId('standing');
    expect(standings).toHaveLength(4);
    // This week: Priya's tick being checked counts; Sam's open John doesn't yet.
    expect(standings[0]).toHaveTextContent(/^1.*You.*1 done.*3$/);
    expect(standings[2]).toHaveTextContent(/^1.*Sam.*4 done · 1 late.*12$/);
    expect(standings[3]).toHaveTextContent(/You.*3 done · 1 missed.*9$/);
  });

  it('shows fair shares either side of zero, with how time away is made up', async () => {
    await open();
    const shares = await screen.findAllByTestId('fair-share');
    expect(shares[0]).toHaveTextContent(/You.*−3/);
    expect(shares[1]).toHaveTextContent(/Sam.*\+3/);
    expect(screen.getByText(TABLE_COPY.sharesBody)).toBeOnTheScreen();
    expect(screen.getByText(MAKEUP_LABEL[100].toLowerCase())).toBeOnTheScreen();
  });

  it('lists streaks and perks, longest streak first, and how they work', async () => {
    await open();
    const [sam, you] = await screen.findAllByTestId('streak');
    expect(within(sam).getByText('Sam')).toBeOnTheScreen();
    expect(within(sam).getByText(TABLE_COPY.weeks(5))).toBeOnTheScreen();
    expect(within(sam).getByText(TABLE_COPY.swap)).toBeOnTheScreen();
    expect(within(you).getByText('You')).toBeOnTheScreen();
    for (const rule of TABLE_COPY.rules) expect(screen.getByText(rule.body)).toBeOnTheScreen();
  });
});
