import { AWAY_COPY, FOCUS_SHELL_COPY, PAGE_TITLE, SECTION_LABEL, SETUP_COPY } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

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
  // A Wednesday: the house's week started on Monday the 19th.
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

it("shows who else is away, by first name, in words as well as squares", async () => {
  const members = snapshot().members;
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({ members: [members[0], { ...members[1], name: 'Sam Carter' }, { ...members[1], userId: 'tom', name: 'Tom Reilly' }] }),
  );
  (loadAway as jest.Mock).mockResolvedValue({
    today: '2026-10-21',
    periods: [
      trip(),
      trip({ id: 'p3', userId: 'tom', startsOn: '2026-10-20', endsOn: '2026-10-22', note: null }),
      trip({ id: 'p2', userId: 'priya', startsOn: '2026-11-02', endsOn: '2026-11-03', note: null }),
    ],
  });
  await open();
  const panel = within(screen.getByTestId('away-panel'));
  expect(panel.getByText(SETUP_COPY.whosAway)).toBeOnTheScreen();
  expect(panel.getByText(SETUP_COPY.nextWeeks('21 Oct–17 Nov'))).toBeOnTheScreen();
  // Soonest first; your own trip is under Your time away, not here again.
  const [tom, sam] = panel.getAllByTestId('away-period');
  expect(panel.getAllByTestId('away-period')).toHaveLength(2);
  // The avatar's initials, then the first name alone.
  expect(tom).toHaveTextContent(new RegExp(`^TRTom20–22 Oct.*${SETUP_COPY.awayNow}`));
  expect(sam).toHaveTextContent(/^SCSam26–28 Oct · Lisbon$/);
  expect(within(sam).queryByText(SETUP_COPY.awayNow)).toBeNull();
  expect(within(screen.getByTestId('my-trips')).getByTestId('my-trip')).toHaveTextContent(/2–3 Nov/);
});

it('says nobody else is away when only you are', async () => {
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip({ userId: 'priya' })] });
  await open();
  const panel = within(screen.getByTestId('away-panel'));
  expect(panel.getByText(SETUP_COPY.nobodyElse)).toBeOnTheScreen();
  expect(panel.queryByTestId('away-period')).toBeNull();
});

it("says when nobody's away, and has no trips of yours to show", async () => {
  await open();
  expect(within(screen.getByTestId('away-panel')).getByText(AWAY_COPY.nobody)).toBeOnTheScreen();
  expect(screen.queryByTestId('my-trips')).toBeNull();
});

describe('your own trips', () => {
  it('cancels one that has not started', async () => {
    (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip({ userId: 'priya' })] });
    await open();
    const mine = within(screen.getByTestId('my-trips'));
    expect(mine.getByText(AWAY_COPY.yours)).toBeOnTheScreen();
    expect(mine.getByTestId('my-trip')).toHaveTextContent(/26–28 Oct.*Lisbon/);
    await fireEvent.press(mine.getByRole('button', { name: `${AWAY_COPY.cancel}, 26–28 Oct` }));
    expect(cancelAway).toHaveBeenCalledWith('p1');
  });

  it("ends one you're on with I'm back", async () => {
    (loadAway as jest.Mock).mockResolvedValue({
      today: '2026-10-21',
      periods: [trip({ userId: 'priya', startsOn: '2026-10-20', endsOn: '2026-10-24', note: 'Cork' })],
    });
    await open();
    const mine = within(screen.getByTestId('my-trip'));
    expect(screen.getByTestId('my-trip')).toHaveTextContent(new RegExp(`20–24 Oct.*${SETUP_COPY.awayNow} · Cork`));
    await fireEvent.press(mine.getByRole('button', { name: `${AWAY_COPY.back}, 20–24 Oct` }));
    expect(cancelAway).toHaveBeenCalledWith('p1');
  });

  it("says why a cancel didn't take", async () => {
    (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip({ userId: 'priya' })] });
    (cancelAway as jest.Mock).mockRejectedValue(new Error('That trip has already ended.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: `${AWAY_COPY.cancel}, 26–28 Oct` }));
    expect(await within(screen.getByTestId('my-trips')).findByRole('alert')).toHaveTextContent('That trip has already ended.');
  });

  it('leaves out trips that are over', async () => {
    (loadAway as jest.Mock).mockResolvedValue({
      today: '2026-10-21',
      periods: [trip({ userId: 'priya', startsOn: '2026-10-10', endsOn: '2026-10-12' })],
    });
    await open();
    expect(screen.queryByTestId('my-trips')).toBeNull();
    expect(screen.queryByTestId('away-period')).toBeNull();
  });
});

describe('booking', () => {
  it('opens the calendar on this week, the first you can book', async () => {
    await open();
    const calendar = within(screen.getByTestId('date-range'));
    expect(calendar.getByText('October–November 2026')).toBeOnTheScreen();
    // The week began on Monday; the days already gone can't be picked.
    expect(calendar.getByRole('button', { name: 'Monday 19 October' })).toBeDisabled();
    expect(calendar.getByRole('button', { name: 'Wednesday 21 October' })).toBeEnabled();
    expect(calendar.getByRole('button', { name: SETUP_COPY.earlier })).toBeDisabled();
    expect(calendar.queryByRole('button', { name: 'Monday 23 November' })).toBeNull();
    await fireEvent.press(calendar.getByRole('button', { name: SETUP_COPY.later }));
    // On four weeks, keeping the last in view.
    expect(calendar.getByRole('button', { name: 'Monday 16 November' })).toBeOnTheScreen();
    expect(calendar.getByRole('button', { name: 'Monday 14 December' })).toBeOnTheScreen();
    expect(calendar.queryByRole('button', { name: 'Wednesday 21 October' })).toBeNull();
    await fireEvent.press(calendar.getByRole('button', { name: SETUP_COPY.earlier }));
    expect(calendar.getByRole('button', { name: 'Wednesday 21 October' })).toBeOnTheScreen();
  });

  it('books your time away from the calendar, and says what it moved', async () => {
    (setAway as jest.Mock).mockResolvedValue(2);
    await open();
    const form = within(screen.getByTestId('away-form'));
    expect(form.getByText(AWAY_COPY.howItWorks)).toBeOnTheScreen();
    expect(form.getByRole('button', { name: SETUP_COPY.book })).toBeDisabled();
    expect(form.getByText(AWAY_COPY.pickFrom)).toBeOnTheScreen();
    await fireEvent.press(form.getByRole('button', { name: 'Monday 26 October' }));
    expect(form.getByText(AWAY_COPY.pickTo)).toBeOnTheScreen();
    await fireEvent.press(form.getByRole('button', { name: 'Wednesday 28 October' }));
    expect(form.getByText(AWAY_COPY.picked('26–28 Oct'))).toBeOnTheScreen();
    expect(form.getByRole('button', { name: 'Tuesday 27 October' })).toBeSelected();
    await fireEvent.changeText(form.getByTestId('away-note'), 'Lisbon');
    await fireEvent.press(form.getByRole('button', { name: SETUP_COPY.book }));
    expect(setAway).toHaveBeenCalledWith({ from: '2026-10-26', to: '2026-10-28', note: 'Lisbon' });
    expect(await screen.findByText(AWAY_COPY.moved(2))).toBeOnTheScreen();
    // Ready for the next one.
    await waitFor(() => expect(form.getByTestId('book-away')).toBeDisabled());
    expect(form.getByTestId('away-note')).toHaveDisplayValue('');
  });

  it('books a single day with one tap', async () => {
    await open();
    const form = within(screen.getByTestId('away-form'));
    await fireEvent.press(form.getByRole('button', { name: 'Thursday 22 October' }));
    await fireEvent.press(form.getByTestId('book-away'));
    expect(setAway).toHaveBeenCalledWith({ from: '2026-10-22', to: '2026-10-22', note: '' });
  });

  it("says why a booking didn't take", async () => {
    (setAway as jest.Mock).mockRejectedValue(new Error("You’re already away for some of those days."));
    await open();
    const form = within(screen.getByTestId('away-form'));
    await fireEvent.press(form.getByRole('button', { name: 'Thursday 22 October' }));
    await fireEvent.press(form.getByTestId('book-away'));
    expect(await form.findByRole('alert')).toHaveTextContent("You’re already away for some of those days.");
  });
});
