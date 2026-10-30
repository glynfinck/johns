import { HISTORY_COPY, STEADY_COPY } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { planJohn } from '@/api/johns';
import { ToastProvider } from '@/components/toast';
import { renderPages } from '@/testing/pages';

import { PlanIt } from './plan-it';

jest.mock('@/api/johns', () => ({ planJohn: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const ZONE = 'Europe/London';
// Wednesday 7 Oct 2026, 10:00 BST; due Saturday 11:00.
const now = new Date('2026-10-07T09:00:00Z');
const dueAt = new Date('2026-10-10T10:00:00Z');

async function show(plannedAt: Date | null, inline = false) {
  function Host() {
    return (
      <ToastProvider>
        <PlanIt houseId="h1" item={{ id: 'a1', dueAt, plannedAt }} zone={ZONE} now={now} bestTime="morning" inline={inline} />
      </ToastProvider>
    );
  }
  await renderPages({ index: Host }, '/');
}

beforeEach(() => {
  jest.clearAllMocks();
  (planJohn as jest.Mock).mockResolvedValue(undefined);
});

it('plans it in one tap for your best time on the latest day it fits, with Undo', async () => {
  await show(null);
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.plan }));
  // Saturday 09:00 BST.
  expect(planJohn).toHaveBeenCalledWith('a1', new Date('2026-10-10T08:00:00Z'));
  expect(screen.getByTestId('toast')).toHaveTextContent(STEADY_COPY.plannedToast('Sat 09:00'), { exact: false });
  await fireEvent.press(screen.getByTestId('toast-action'));
  expect(planJohn).toHaveBeenLastCalledWith('a1', null);
  await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent(HISTORY_COPY.wasUndone));
});

it('says when it is planned for, and changes it in a sheet of days and times', async () => {
  await show(new Date('2026-10-08T13:00:00Z'));
  expect(screen.getByTestId('plan-it-when')).toHaveTextContent('Tomorrow 14:00, reminder set');
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.change }));
  const sheet = within(screen.getByTestId('plan-sheet'));
  expect(sheet.getByText(STEADY_COPY.planBody('Sat 11:00'))).toBeOnTheScreen();
  // It opens on the plan as it is: Thursday 14:00.
  expect(sheet.getByRole('radio', { name: 'Thu' })).toBeChecked();
  expect(sheet.getByRole('radio', { name: /^14:00/ })).toBeChecked();
  await fireEvent.press(sheet.getByRole('radio', { name: 'Fri' }));
  // A new day starts on your best time.
  expect(sheet.getByRole('radio', { name: `09:00, ${STEADY_COPY.yourBest('Morning')}` })).toBeChecked();
  await fireEvent.press(sheet.getByRole('radio', { name: /^19:00/ }));
  await fireEvent.press(sheet.getByRole('button', { name: STEADY_COPY.planFor('Fri 19:00') }));
  expect(planJohn).toHaveBeenCalledWith('a1', new Date('2026-10-09T18:00:00Z'));
  // Undo puts back the plan it had.
  await fireEvent.press(screen.getByTestId('toast-action'));
  expect(planJohn).toHaveBeenLastCalledWith('a1', new Date('2026-10-08T13:00:00Z'));
});

it('clears a plan', async () => {
  await show(new Date('2026-10-08T13:00:00Z'));
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.change }));
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.unplan }));
  expect(planJohn).toHaveBeenCalledWith('a1', null);
  expect(screen.getByTestId('toast')).toHaveTextContent(STEADY_COPY.unplanned, { exact: false });
});

it('changes it in place inside another sheet, with Cancel back to the line', async () => {
  await show(new Date('2026-10-08T13:00:00Z'), true);
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.change }));
  expect(screen.queryByTestId('plan-sheet')).toBeNull();
  expect(screen.getByText(STEADY_COPY.planTitle)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByTestId('plan-it-when')).toBeOnTheScreen();
});

it('says a refusal', async () => {
  (planJohn as jest.Mock).mockRejectedValue(new Error('Pick a time from now until the end of this week.'));
  await show(null);
  await fireEvent.press(screen.getByRole('button', { name: STEADY_COPY.plan }));
  expect(await screen.findByText('Pick a time from now until the end of this week.')).toBeOnTheScreen();
});
