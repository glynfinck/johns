import { buildStake, STAKE_COPY } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { confirmPayment, loadStake } from '@/api/stake';
import StakeScreen from '@/app/(house)/stake';
import { snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/stake', () => ({ loadStake: jest.fn(), confirmPayment: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const entry = (id: number, user_id: string, kind: string, amount_minor: number, month: string, counterparty: string | null = null) => ({
  id,
  user_id,
  kind,
  amount_minor,
  month,
  counterparty,
  created_at: '2026-10-10T12:00:00Z',
});

function stake(ledger: ReturnType<typeof entry>[], closedMonths: string[] = []) {
  return buildStake({ ledger, closedMonths, memberIds: ['priya', 'sam'], stakeMinor: 2000, month: '2026-10' });
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
      stake: StakeScreen,
    },
    { initialUrl: '/stake' },
  );
  await screen.findByText(STAKE_COPY.title);
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (confirmPayment as jest.Mock).mockResolvedValue(undefined);
});

it('shows the month so far, with what each would gain or lose', async () => {
  (loadStake as jest.Mock).mockResolvedValue(stake([entry(1, 'sam', 'forfeit', -300, '2026-10')]));
  await open();
  expect(await screen.findByText(STAKE_COPY.eyebrow('£20'))).toBeOnTheScreen();
  const [you, sam] = await screen.findAllByTestId('projection');
  expect(you).toHaveTextContent(/You.*–.*£3.*\+£3/);
  expect(sam).toHaveTextContent(/Sam.*£3.*–.*−£3/);
  expect(screen.getByText(STAKE_COPY.soFarBody('£1', '£3'))).toBeOnTheScreen();
});

it("is square with nothing owed, and says the ledger's empty", async () => {
  (loadStake as jest.Mock).mockResolvedValue(stake([]));
  await open();
  expect(await screen.findByText(STAKE_COPY.square)).toBeOnTheScreen();
  expect(screen.getByText(STAKE_COPY.ledgerEmpty)).toBeOnTheScreen();
});

it('lets the person paid mark it received, and nobody else', async () => {
  (loadStake as jest.Mock).mockResolvedValue(
    stake([entry(2, 'sam', 'forfeit', -400, '2026-09'), entry(1, 'priya', 'share', 400, '2026-09')], ['2026-09']),
  );
  await open();
  const transfer = await screen.findByTestId('transfer');
  expect(transfer).toHaveTextContent(/Sam.*You.*£4/);
  await fireEvent.press(within(transfer).getByRole('button', { name: STAKE_COPY.markReceived }));
  expect(confirmPayment).toHaveBeenCalledWith('h1', 'sam', 400);
});

it("doesn't offer it to the one paying", async () => {
  (loadStake as jest.Mock).mockResolvedValue(
    stake([entry(2, 'priya', 'forfeit', -400, '2026-09'), entry(1, 'sam', 'share', 400, '2026-09')], ['2026-09']),
  );
  await open();
  const transfer = await screen.findByTestId('transfer');
  expect(transfer).toHaveTextContent(/You.*Sam.*£4/);
  expect(within(transfer).queryByRole('button', { name: STAKE_COPY.markReceived })).toBeNull();
});

it('lists the ledger, with each payment\'s other side', async () => {
  (loadStake as jest.Mock).mockResolvedValue(
    stake([entry(3, 'sam', 'payment', 400, '2026-10', 'priya'), entry(2, 'sam', 'forfeit', -400, '2026-09')], ['2026-09']),
  );
  await open();
  const [payment, forfeit] = await screen.findAllByTestId('ledger-entry');
  expect(payment).toHaveTextContent(/Payment to You.*Sam · 2026-10.*\+£4/);
  expect(forfeit).toHaveTextContent(/Forfeit.*Sam · 2026-09.*−£4/);
});
