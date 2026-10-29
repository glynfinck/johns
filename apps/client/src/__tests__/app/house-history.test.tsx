import { HISTORY_COPY, historyItems, type ActionRow } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { loadHistory, undoAction } from '@/api/history';
import { catchUp } from '@/api/house';
import HistoryScreen from '@/app/(house)/house/history';
import { snapshot } from '@/testing/house';
import { renderPages } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/history', () => ({ HISTORY_PAGE: 60, loadHistory: jest.fn(), undoAction: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

// Thursday 29 October 2026, 9pm in London.
const NOW = new Date('2026-10-29T21:00:00Z');

const row = (overrides: Partial<ActionRow>): ActionRow => ({
  id: 'x',
  kind: 'tick',
  actor: 'priya',
  subject: 'priya',
  assignment_id: 'a1',
  ref: null,
  data: { name: 'Bins out' },
  created_at: '2026-10-29T20:04:00Z',
  undone_at: null,
  undone_by: null,
  reach: 'own',
  ...overrides,
});

// Today: Priya's tick (hers to undo), Sam's flag (Priya's as an admin), and
// Sam's tick, already settled past reach. Yesterday: Priya made Sam an admin
// and then took it back.
const ROWS = [
  row({ id: 'h1' }),
  row({ id: 'h2', kind: 'flag', actor: 'sam', subject: 'priya', data: { name: 'Recycling' }, created_at: '2026-10-29T19:30:00Z', reach: 'admin' }),
  row({ id: 'h3', actor: 'sam', subject: 'sam', data: { name: 'Clean the bath' }, created_at: '2026-10-29T09:12:00Z', reach: null }),
  row({
    id: 'h4',
    kind: 'role',
    subject: 'sam',
    data: { from: 'member', to: 'admin' },
    created_at: '2026-10-28T18:00:00Z',
    undone_at: '2026-10-28T18:01:00Z',
    undone_by: 'priya',
    reach: null,
  }),
];

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadHistory as jest.Mock).mockResolvedValue(historyItems(ROWS));
  (undoAction as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

async function open() {
  await renderPages({ 'house/history': HistoryScreen }, '/house/history');
  await screen.findAllByTestId('history-day');
}

it('tells every move a day at a time, with Undo only where it still reaches', async () => {
  await open();
  expect(loadHistory).toHaveBeenCalledWith('h1', undefined);
  const [today, yesterday] = screen.getAllByTestId('history-day');
  expect(within(today).getByRole('header', { name: HISTORY_COPY.today })).toBeOnTheScreen();
  expect(within(yesterday).getByRole('header', { name: HISTORY_COPY.yesterday })).toBeOnTheScreen();

  const [mine, flag, settled] = within(today).getAllByTestId('history-row');
  expect(mine).toHaveTextContent(/You ticked Bins out.*20:04/);
  expect(within(mine).getByRole('button', { name: 'Undo: You ticked Bins out' })).toBeOnTheScreen();
  expect(flag).toHaveTextContent(/Sam flagged Recycling.*19:30/);
  expect(within(flag).getByTestId('history-undo')).toBeOnTheScreen();
  expect(settled).toHaveTextContent(/Sam ticked Clean the bath.*09:12 · Can’t be undone now/);
  expect(within(settled).queryByTestId('history-undo')).toBeNull();

  const [role] = within(yesterday).getAllByTestId('history-row');
  expect(role).toHaveTextContent(/You made Sam an admin.*18:00 · Undone/);
});

it('undoes one and reads History again', async () => {
  await open();
  const [, flag] = screen.getAllByTestId('history-row');
  (loadHistory as jest.Mock).mockClear();
  await fireEvent.press(within(flag).getByTestId('history-undo'));
  expect(undoAction).toHaveBeenCalledWith('h2');
  await waitFor(() => expect(loadHistory).toHaveBeenCalled());
});

it('says a refusal under the row it came from', async () => {
  (undoAction as jest.Mock).mockRejectedValue(new Error('That can’t be undone any more.'));
  await open();
  const [mine] = screen.getAllByTestId('history-row');
  await fireEvent.press(within(mine).getByTestId('history-undo'));
  expect(await screen.findByText('That can’t be undone any more.')).toBeOnTheScreen();
});

it('shows only yours under Mine', async () => {
  await open();
  await fireEvent.press(screen.getByRole('radio', { name: HISTORY_COPY.mine }));
  const rows = screen.getAllByTestId('history-row');
  expect(rows).toHaveLength(2);
  for (const r of rows) expect(r).toHaveTextContent(/You (ticked|made)/);
});

it('says what lands here when nothing has yet', async () => {
  (loadHistory as jest.Mock).mockResolvedValue([]);
  await renderPages({ 'house/history': HistoryScreen }, '/house/history');
  expect(await screen.findByTestId('history-empty')).toHaveTextContent(new RegExp(HISTORY_COPY.title));
});
