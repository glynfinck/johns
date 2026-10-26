import { AWAY_COPY, FOCUS_SHELL_COPY, PAGE_TITLE, SECTION_LABEL } from '@app/core';
import { fireEvent, screen, within } from 'expo-router/testing-library';

import { cancelAway, loadAway, setAway } from '@/api/away';
import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import AwayScreen from '@/app/(house)/house/away';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/away', () => ({ loadAway: jest.fn(), setAway: jest.fn(), cancelAway: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const trip = (overrides: object = {}) => ({
  id: 'p1',
  userId: 'sam',
  startsOn: '2026-10-26',
  endsOn: '2026-10-28',
  note: 'Lisbon',
  ...overrides,
});

async function open() {
  await renderPages({ 'house/away': AwayScreen }, '/house/away');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [] });
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (cancelAway as jest.Mock).mockResolvedValue(undefined);
  (setAway as jest.Mock).mockResolvedValue(0);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.away })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it("shows who's away, in words as well as squares", async () => {
  (loadAway as jest.Mock).mockResolvedValue({
    today: '2026-10-21',
    periods: [trip(), trip({ id: 'p2', userId: 'priya', startsOn: '2026-10-20', endsOn: '2026-10-22', note: null })],
  });
  await open();
  const [sam, priya] = screen.getAllByTestId('away-period');
  expect(sam).toHaveTextContent(/Sam.*26–28 Oct.*Lisbon/);
  expect(priya).toHaveTextContent(new RegExp(`You.*20–22 Oct.*${AWAY_COPY.awayNow}`));
  // Your own trip, already begun, ends with "I'm back".
  expect(within(screen.getByTestId('my-trip')).getByRole('button', { name: AWAY_COPY.back })).toBeOnTheScreen();
});

it("says when nobody's away", async () => {
  await open();
  expect(screen.getByText(AWAY_COPY.nobody)).toBeOnTheScreen();
  expect(screen.queryByTestId('my-trip')).toBeNull();
});

it('books your time away from the calendar, and says what it moved', async () => {
  (setAway as jest.Mock).mockResolvedValue(2);
  await open();
  const form = within(screen.getByTestId('away-form'));
  expect(form.getByTestId('book-away')).toBeDisabled();
  expect(form.getByText(AWAY_COPY.pickFrom)).toBeOnTheScreen();
  await fireEvent.press(form.getByRole('button', { name: 'Monday 26 October' }));
  expect(form.getByText(AWAY_COPY.pickTo)).toBeOnTheScreen();
  await fireEvent.press(form.getByRole('button', { name: 'Wednesday 28 October' }));
  expect(form.getByText(AWAY_COPY.picked('26–28 Oct'))).toBeOnTheScreen();
  await fireEvent.changeText(form.getByTestId('away-note'), 'Lisbon');
  await fireEvent.press(form.getByTestId('book-away'));
  expect(setAway).toHaveBeenCalledWith({ from: '2026-10-26', to: '2026-10-28', note: 'Lisbon' });
  expect(await screen.findByText(AWAY_COPY.moved(2))).toBeOnTheScreen();
  expect(form.getByTestId('book-away')).toBeDisabled();
});

it("says why a booking didn't take", async () => {
  (setAway as jest.Mock).mockRejectedValue(new Error("You're already away for some of those days."));
  await open();
  const form = within(screen.getByTestId('away-form'));
  await fireEvent.press(form.getByRole('button', { name: 'Thursday 22 October' }));
  await fireEvent.press(form.getByTestId('book-away'));
  expect(await form.findByRole('alert')).toHaveTextContent("You're already away for some of those days.");
});

it('cancels a trip that has not started', async () => {
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip({ userId: 'priya' })] });
  await open();
  await fireEvent.press(within(screen.getByTestId('my-trip')).getByRole('button', { name: AWAY_COPY.cancel }));
  expect(cancelAway).toHaveBeenCalledWith('p1');
});
