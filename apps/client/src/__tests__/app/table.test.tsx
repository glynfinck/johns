import { MAKEUP_LABEL, TABLE_COPY } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { renderRouter, screen, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { loadTable } from '@/api/table';
import TableScreen from '@/app/(house)/table';
import { assignment, snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/table', () => ({ loadTable: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

async function open() {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      table: TableScreen,
    },
    { initialUrl: '/table' },
  );
  await screen.findByText(TABLE_COPY.title);
}

beforeEach(() => {
  jest.clearAllMocks();
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
});

it("ranks the week and the month, with each person's record", async () => {
  await open();
  expect(await screen.findByText('October 2026')).toBeOnTheScreen();
  const standings = screen.getAllByTestId('standing');
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
