import { FOCUS_SHELL_COPY, NEW_JOHN, PAGE_TITLE, SECTION_LABEL, STEADY_COPY } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { saveMyPrefs } from '@/api/my-prefs';
import { loadJohnList } from '@/api/settings';
import PrefsScreen from '@/app/(house)/house/prefs';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/my-prefs', () => ({ saveMyPrefs: jest.fn() }));
jest.mock('@/api/settings', () => ({ loadJohnList: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const PRIYA = { days: [3, 4, 6] as (3 | 4 | 6)[], bestTime: 'morning' as const, rather: { mop: 1 as const } };

async function open() {
  await renderPages({ 'house/prefs': PrefsScreen }, '/house/prefs');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  const base = snapshot();
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({ members: base.members.map((m) => (m.userId === 'priya' ? { ...m, prefs: PRIYA } : m)) }),
  );
  (catchUp as jest.Mock).mockResolvedValue(false);
  (saveMyPrefs as jest.Mock).mockResolvedValue(undefined);
  (loadJohnList as jest.Mock).mockResolvedValue({
    johns: [
      { ...NEW_JOHN, id: 'mop', name: 'Mopping' },
      { ...NEW_JOHN, id: 'bins', name: 'Garbage' },
    ],
    groups: [],
  });
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.prefs })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('shows the days that suit you, your best time and your Johns as saved', async () => {
  await open();
  expect(screen.getByRole('checkbox', { name: 'Wednesday' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Monday' })).not.toBeChecked();
  expect(within(screen.getByTestId('prefs-time')).getByRole('radio', { name: STEADY_COPY.time.morning })).toBeChecked();
  const johns = screen.getAllByTestId('prefs-john');
  expect(johns[0]).toHaveTextContent(/Mopping.*Rather do/);
  expect(johns[1]).toHaveTextContent(/Garbage.*No preference/);
  expect(screen.getByText(STEADY_COPY.prefsNote)).toBeOnTheScreen();
});

it('saves each change as it is made', async () => {
  await open();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Monday' }));
  expect(saveMyPrefs).toHaveBeenLastCalledWith('h1', { ...PRIYA, days: [1, 3, 4, 6] });
  expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeChecked();

  await fireEvent.press(screen.getByRole('radio', { name: STEADY_COPY.anyTime }));
  expect(saveMyPrefs).toHaveBeenLastCalledWith('h1', { ...PRIYA, days: [1, 3, 4, 6], bestTime: null });

  await fireEvent.press(within(screen.getAllByTestId('prefs-john')[1]).getByRole('button'));
  await fireEvent.press(screen.getByRole('radio', { name: STEADY_COPY.rather['-1'] }));
  expect(saveMyPrefs).toHaveBeenLastCalledWith('h1', { days: [1, 3, 4, 6], bestTime: null, rather: { mop: 1, bins: -1 } });
});

it("says so when a save didn't go through", async () => {
  (saveMyPrefs as jest.Mock).mockRejectedValue(new Error('Those didn’t save.'));
  await open();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Friday' }));
  await waitFor(() => expect(screen.getByText('Those didn’t save.')).toBeOnTheScreen());
});
