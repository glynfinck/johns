import { AWAY_COPY, DEAL_COPY, DISPUTE_COPY, FOCUS_SHELL_COPY, JOHN_COPY, NOT_DEALT_COPY, PAGE_TITLE, SWAP_COPY, WEEK_COPY } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { useWindowDimensions } from 'react-native';

import { loadAway } from '@/api/away';
import { loadHouse } from '@/api/board';
import { castVote } from '@/api/disputes';
import { catchUp } from '@/api/house';
import { spendSwap } from '@/api/johns';
import { dealThisWeek } from '@/api/settings';
import Week from '@/app/(house)/week';
import { assignment, snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/away', () => ({ loadAway: jest.fn(), setAway: jest.fn(), cancelAway: jest.fn() }));
jest.mock('@/api/settings', () => ({ dealThisWeek: jest.fn() }));
jest.mock('@/api/disputes', () => ({ castVote: jest.fn(), raiseDispute: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn(), spendSwap: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));
// A phone unless a test says otherwise.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 915, scale: 1, fontScale: 1 })),
}));

const read = loadHouse as jest.Mock;
const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

/** Priya's two open Johns and one done; Sam's tick being checked, and his other disputed. */
function busyWeek(overrides: Parameters<typeof snapshot>[0] = {}) {
  return snapshot({
    assignments: [
      ...snapshot().assignments.slice(0, 3),
      assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath', category: 'bathroom', done_at: at(-1) }),
      assignment({ id: 'a5', user_id: 'sam', name: 'Mop the floor', category: 'floors', done_at: at(-2) }),
    ],
    disputes: [
      {
        id: 'd1',
        assignment_id: 'a5',
        raised_by: 'cal',
        reason: 'Still sticky',
        closes_at: at(5),
        dispute_votes: [{ user_id: 'cal', uphold: true }],
      },
    ],
    ...overrides,
  });
}

async function open() {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      week: Week,
    },
    { initialUrl: '/week' },
  );
  // The house has been read once the spinner goes.
  await waitFor(() => expect(screen.queryByLabelText(FOCUS_SHELL_COPY.reading)).toBeNull());
  expect(within(screen.getByTestId('title-bar')).getByRole('header', { name: PAGE_TITLE.week })).toBeOnTheScreen();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [] });
  read.mockResolvedValue(busyWeek());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (castVote as jest.Mock).mockResolvedValue(undefined);
  (spendSwap as jest.Mock).mockResolvedValue(undefined);
});

it('counts the week: done (ticks being checked count), being checked, overdue and disputed', async () => {
  await open();
  expect(screen.getByTestId(`stat-${WEEK_COPY.done}`)).toHaveTextContent('3 of 5');
  expect(screen.getByTestId(`stat-${WEEK_COPY.checking}`)).toHaveTextContent('1');
  expect(screen.getByTestId(`stat-${WEEK_COPY.overdue}`)).toHaveTextContent('0');
  expect(screen.getByTestId(`stat-${WEEK_COPY.disputed}`)).toHaveTextContent('1');
});

describe('on a phone', () => {
  it("shows each housemate's Johns under their name, you first", async () => {
    await open();
    const you = screen.getByTestId('person-priya');
    expect(within(you).getByText(WEEK_COPY.you)).toBeOnTheScreen();
    expect(within(you).getAllByTestId('john-card')).toHaveLength(3);
    expect(within(you).getAllByRole('button', { name: JOHN_COPY.markDone })).toHaveLength(2);

    const sam = screen.getByTestId('person-sam');
    expect(within(sam).getByText('Sam')).toBeOnTheScreen();
    expect(within(sam).queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();
    expect(within(sam).getByRole('button', { name: DISPUTE_COPY.open })).toBeOnTheScreen();
    await fireEvent.press(within(sam).getByRole('button', { name: DISPUTE_COPY.notDone }));
    expect(castVote).toHaveBeenCalledWith('d1', true);
  });
});

describe('on a laptop', () => {
  beforeEach(() => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
  });

  it('puts the whole house in one table, and the disputes beside it', async () => {
    await open();
    expect(screen.getAllByTestId('week-row')).toHaveLength(5);
    expect(screen.queryByTestId('person-priya')).toBeNull();
    expect(screen.getByText("Sam's Mop the floor: “Still sticky”")).toBeOnTheScreen();
    expect(screen.getByText(WEEK_COPY.tally(1, 0, 'in 5h'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: DISPUTE_COPY.fine }));
    expect(castVote).toHaveBeenCalledWith('d1', false);
  });

  it('gives the table the width when nothing is disputed', async () => {
    read.mockResolvedValue(busyWeek({ disputes: [] }));
    await open();
    expect(screen.queryByText(WEEK_COPY.disputes)).toBeNull();
  });
});

it('offers your swap, and trades the two you pick', async () => {
  const members = snapshot().members.map((m) => (m.userId === 'priya' ? { ...m, swapTokens: 1 } : m));
  read.mockResolvedValue(busyWeek({ members, assignments: [...busyWeek().assignments, assignment({ id: 'a6', user_id: 'sam', name: 'Descale the kettle' })] }));
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SWAP_COPY.open }));
  const swap = screen.getByRole('button', { name: SWAP_COPY.swap });
  expect(swap).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: "Descale the kettle, Sam's" }));
  await fireEvent.press(swap);
  expect(spendSwap).toHaveBeenCalledWith('a1', 'a6');
});

it("hides the swap without a token", async () => {
  await open();
  expect(screen.queryByRole('button', { name: SWAP_COPY.open })).toBeNull();
});

it('says why the board is empty before the first deal', async () => {
  read.mockResolvedValue(snapshot({ week: null, assignments: [], house: { ...snapshot().house, everDealt: false } }));
  await open();
  expect(screen.getByRole('header', { name: NOT_DEALT_COPY.notYet })).toBeOnTheScreen();
});

describe('re-dealing', () => {
  it('lets an admin deal again while nobody has ticked anything', async () => {
    read.mockResolvedValue(snapshot({ assignments: snapshot().assignments.map((a) => ({ ...a, done_at: null, outcome: null })) }));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.again }));
    expect(dealThisWeek).toHaveBeenCalledWith('h1');
  });

  it('is gone once a John is ticked', async () => {
    await open();
    expect(screen.queryByRole('button', { name: DEAL_COPY.again })).toBeNull();
  });
});

describe('time away', () => {
  const away = (userId: string, startsOn: string, endsOn: string) => ({ id: `p-${userId}`, userId, startsOn, endsOn, note: null });

  it("says under each person which days they're away, and shows someone away with no Johns", async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 412, height: 915, scale: 1, fontScale: 1 });
    read.mockResolvedValue(
      busyWeek({
        members: [...snapshot().members, { userId: 'cal', name: 'Cal', role: 'member', streak: 0, immunityTokens: 0, swapTokens: 0 }],
      }),
    );
    (loadAway as jest.Mock).mockResolvedValue({
      today: '2026-10-21',
      periods: [away('sam', '2026-10-21', '2026-10-23'), away('cal', '2026-10-01', '2026-11-30')],
    });
    await open();
    expect(await within(screen.getByTestId('person-sam')).findByText('Away 21–23 Oct')).toBeOnTheScreen();
    expect(within(screen.getByTestId('person-cal')).getByText('Away all week')).toBeOnTheScreen();
    expect(within(screen.getByTestId('person-priya')).queryByText(/^Away/)).toBeNull();
  });

  it('lists who is away beside the laptop board', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
    (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [away('sam', '2026-10-21', '2026-10-23')] });
    await open();
    expect(await screen.findByText(AWAY_COPY.thisWeek)).toBeOnTheScreen();
    expect(screen.getByTestId('away-this-week')).toHaveTextContent(/Sam.*21–23 Oct/);
  });

  it('leaves the list out when nobody is', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
    await open();
    await waitFor(() => expect(loadAway).toHaveBeenCalled());
    expect(screen.queryByText(AWAY_COPY.thisWeek)).toBeNull();
  });
});
