import { FOCUS_SHELL_COPY, PAGE_TITLE, RULES_COPY, SECTION_LABEL } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { updateHouse } from '@/api/settings';
import RulesScreen from '@/app/(house)/house/rules';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/settings', () => ({ updateHouse: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'Europe/London' }));

const mockMembership = { userId: 'priya' };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMembership.userId } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

async function open(as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  await renderPages({ 'house/rules': RulesScreen }, '/house/rules');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (updateHouse as jest.Mock).mockResolvedValue(undefined);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.rules })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('saves what an admin changed, the money in minor units', async () => {
  await open();
  expect(screen.getByTestId('house-stake')).toHaveDisplayValue('20');
  await fireEvent.changeText(screen.getByTestId('house-stake'), '25.50');
  await fireEvent.press(screen.getByRole('radio', { name: RULES_COPY.disputeHours(48) }));
  await fireEvent.press(screen.getByRole('radio', { name: '€ EUR' }));
  await fireEvent.press(screen.getByTestId('save-rules'));
  expect(updateHouse).toHaveBeenCalledWith('h1', {
    name: 'Flat 3',
    timezone: 'Europe/London',
    currency: 'EUR',
    weekStarts: 1,
    stakeMinor: 2550,
    lateForfeitMinor: 100,
    missedForfeitMinor: 300,
    disputeHours: 48,
    awayMakeup: 100,
  });
  expect(await screen.findByText(RULES_COPY.saved)).toBeOnTheScreen();
});

it('still says saved once the house is read again with the new rules', async () => {
  await open();
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({ house: { ...snapshot().house, name: 'Flat 3B' }, rules: { ...snapshot().rules, stakeMinor: 2500 } }),
  );
  await fireEvent.changeText(screen.getByTestId('rules-name'), 'Flat 3B');
  await fireEvent.changeText(screen.getByTestId('house-stake'), '25');
  const reads = (loadHouse as jest.Mock).mock.calls.length;
  await fireEvent.press(screen.getByTestId('save-rules'));
  // The form starts afresh from what the database now says...
  await waitFor(() => expect((loadHouse as jest.Mock).mock.calls.length).toBeGreaterThan(reads));
  await waitFor(() => expect(screen.getByTestId('house-stake')).toHaveDisplayValue('25'));
  expect(screen.getByTestId('rules-name')).toHaveDisplayValue('Flat 3B');
  // ...and the note that the save landed survives that.
  expect(screen.getByText(RULES_COPY.saved)).toBeOnTheScreen();
});

it("names the amounts in the house's currency", async () => {
  await open();
  expect(screen.getByText(RULES_COPY.missed('£'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: '$ CAD' }));
  expect(screen.getByText(RULES_COPY.missed('$'))).toBeOnTheScreen();
});

it("won't save an amount that isn't money", async () => {
  await open();
  await fireEvent.changeText(screen.getByTestId('house-late'), 'a quid');
  await fireEvent.press(screen.getByTestId('save-rules'));
  expect(await screen.findByRole('alert')).toHaveTextContent(RULES_COPY.badAmount);
  expect(updateHouse).not.toHaveBeenCalled();
});

it('explains what time away still owes, at each rate', async () => {
  await open();
  expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[100]}`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Not at all' }));
  expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[0]}`)).toBeOnTheScreen();
});

it('is for a housemate who is not an admin to read, not change', async () => {
  await open('sam');
  expect(screen.getByText(RULES_COPY.adminsOnly)).toBeOnTheScreen();
  expect(screen.queryByTestId('save-rules')).toBeNull();
  expect(screen.getByTestId('house-stake').props.editable).toBe(false);
  expect(screen.getByRole('radio', { name: 'Tuesday' })).toBeDisabled();
});
