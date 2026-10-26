import {
  AWAY_COPY,
  buildStake,
  DISPUTE_COPY,
  FOCUS_SHELL_COPY,
  INVITE_COPY,
  JOHN_COPY,
  NOT_DEALT_COPY,
  PAGE_TITLE,
  STAKE_COPY,
  TABLE_COPY,
  TODAY_COPY,
} from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { loadAway } from '@/api/away';
import { loadHouse } from '@/api/board';
import { castVote } from '@/api/disputes';
import { catchUp } from '@/api/house';
import { markDone } from '@/api/johns';
import { loadStake } from '@/api/stake';
import { loadTable } from '@/api/table';
import Today from '@/app/(house)/today';
import { assignment, snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/away', () => ({ loadAway: jest.fn(), setAway: jest.fn(), cancelAway: jest.fn() }));
jest.mock('@/api/settings', () => ({ dealThisWeek: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/table', () => ({ loadTable: jest.fn() }));
jest.mock('@/api/stake', () => ({ loadStake: jest.fn(), confirmPayment: jest.fn() }));
jest.mock('@/api/disputes', () => ({ castVote: jest.fn(), raiseDispute: jest.fn() }));
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
  // The week's line under the title bar: the house has been read.
  await screen.findByText(/^This week/);
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [] });
  read.mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (markDone as jest.Mock).mockResolvedValue(undefined);
  (loadStake as jest.Mock).mockResolvedValue(
    buildStake({
      ledger: [{ id: 1, user_id: 'priya', kind: 'forfeit', amount_minor: -100, month: '2026-10', counterparty: null, created_at: '2026-10-10T12:00:00Z' }],
      closedMonths: [],
      memberIds: ['priya', 'sam'],
      stakeMinor: 2000,
      month: '2026-10',
    }),
  );
  (loadTable as jest.Mock).mockResolvedValue({
    month: '2026-10',
    monthTable: [],
    balances: [
      { userId: 'priya', balance: -4, weeksToEven: 2 },
      { userId: 'sam', balance: 4, weeksToEven: 0 },
    ],
  });
});

it("reads the house, and leaves signing out to House", async () => {
  await open();
  // Focus's title bar: TODAY, and the day it is in the house.
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.today })).toBeOnTheScreen();
  expect(bar.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}$/)).toBeOnTheScreen();
  expect(read).toHaveBeenCalledWith('h1', expect.any(Date));
  expect(screen.queryByTestId('sign-out')).toBeNull();
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

it('puts the votes waiting for you first, and casts yours', async () => {
  (castVote as jest.Mock).mockResolvedValue(undefined);
  const done = new Date(Date.now() - 3_600_000).toISOString();
  read.mockResolvedValue(
    snapshot({
      assignments: [...snapshot().assignments.slice(0, 3), assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath', done_at: done })],
      disputes: [
        {
          id: 'd1',
          assignment_id: 'a4',
          raised_by: 'cal',
          reason: 'Ring round the bath',
          closes_at: new Date(Date.now() + 3_600_000).toISOString(),
          dispute_votes: [{ user_id: 'cal', uphold: true }],
        },
      ],
    }),
  );
  await open();
  const toVote = screen.getByTestId('to-vote');
  expect(toVote).toHaveTextContent(new RegExp(TODAY_COPY.toVote));
  expect(screen.getByText('Disputed: “Ring round the bath”')).toBeOnTheScreen();
  expect(within(toVote).getByText('Sam')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: DISPUTE_COPY.notDone }));
  expect(castVote).toHaveBeenCalledWith('d1', true);
});

it("shows the week's Table and where you stand against your share", async () => {
  await open();
  expect(screen.getByText(TABLE_COPY.beside)).toBeOnTheScreen();
  expect(screen.getAllByTestId('standing')).toHaveLength(2);
  const share = await screen.findByTestId('my-share');
  expect(share).toHaveTextContent(new RegExp(TABLE_COPY.yourShare));
  expect(screen.getByText(TABLE_COPY.shareLine(-4, 2))).toBeOnTheScreen();
  expect(loadTable).toHaveBeenCalledWith('h1', expect.objectContaining({ timezone: 'Europe/London' }), ['priya', 'sam'], expect.any(Date));
});

it('shows your stake this month, and where you would stand if it ended now', async () => {
  await open();
  const card = await screen.findByTestId('my-stake');
  expect(card).toHaveTextContent(new RegExp(STAKE_COPY.yours));
  expect(screen.getByText('£20')).toBeOnTheScreen();
  expect(screen.getByText(`£1 forfeited so far. ${STAKE_COPY.ifNow} −£1.`)).toBeOnTheScreen();
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
    expect(screen.getByText(/^This week/)).toBeOnTheScreen();
  });
});

it("says when it can't read the house, and tries again", async () => {
  read.mockRejectedValueOnce(new Error('offline'));
  await show();
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/^This week/)).toBeOnTheScreen();
});


describe('your time away', () => {
  const trip = (startsOn: string, endsOn: string) => ({ id: 'p1', userId: 'priya', startsOn, endsOn, note: null });

  it('says when you go, and that your share still counts', async () => {
    (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip('2026-10-26', '2026-10-28')] });
    await open();
    const banner = await screen.findByTestId('away-banner');
    expect(banner).toHaveTextContent(/You're away 26–28 Oct\./);
    expect(within(banner).getByText(AWAY_COPY.bannerBody(100))).toBeOnTheScreen();
    expect(within(banner).getByRole('link', { name: AWAY_COPY.change })).toBeOnTheScreen();
  });

  it('says until when, once you have gone', async () => {
    (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip('2026-10-20', '2026-10-28')] });
    await open();
    expect(await screen.findByText(AWAY_COPY.banner('Wed 28 Oct', true))).toBeOnTheScreen();
  });

  it("stays quiet about a trip more than a fortnight off, or someone else's", async () => {
    (loadAway as jest.Mock).mockResolvedValue({
      today: '2026-10-21',
      periods: [trip('2026-11-05', '2026-11-08'), { ...trip('2026-10-22', '2026-10-23'), id: 'p2', userId: 'sam' }],
    });
    await open();
    await waitFor(() => expect(loadAway).toHaveBeenCalled());
    expect(screen.queryByTestId('away-banner')).toBeNull();
  });
});
