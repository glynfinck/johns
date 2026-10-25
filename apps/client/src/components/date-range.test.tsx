import { AWAY_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { DateRangePicker, type DateRange } from './date-range';

const changes: [DateRange, boolean][] = [];

/** The picker as a form holds it: the range lives with whoever books it. */
function Picker({ today = '2026-10-21' }: { today?: string }) {
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  return (
    <DateRangePicker
      today={today}
      weekStarts={1}
      value={range}
      onChange={(next, picking) => {
        changes.push([next, picking]);
        setRange(next);
      }}
    />
  );
}

beforeEach(() => {
  changes.length = 0;
});

it('takes the first tap as the first day, and the next as the last', async () => {
  await render(<Picker />);
  expect(screen.getByText('October 2026')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Monday 26 October' }));
  expect(changes.at(-1)).toEqual([{ from: '2026-10-26', to: '2026-10-26' }, true]);
  await fireEvent.press(screen.getByRole('button', { name: 'Wednesday 28 October' }));
  expect(changes.at(-1)).toEqual([{ from: '2026-10-26', to: '2026-10-28' }, false]);
  expect(screen.getByRole('button', { name: 'Tuesday 27 October' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Thursday 29 October' })).not.toBeSelected();
});

it('starts again from a day before the first, or after a finished range', async () => {
  await render(<Picker />);
  await fireEvent.press(screen.getByRole('button', { name: 'Monday 26 October' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Friday 23 October' }));
  expect(changes.at(-1)).toEqual([{ from: '2026-10-23', to: '2026-10-23' }, true]);
  await fireEvent.press(screen.getByRole('button', { name: 'Saturday 24 October' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Thursday 29 October' }));
  expect(changes.at(-1)).toEqual([{ from: '2026-10-29', to: '2026-10-29' }, true]);
});

it("won't pick a day that has gone, or go back before this month", async () => {
  await render(<Picker />);
  expect(screen.getByRole('button', { name: 'Tuesday 20 October' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Wednesday 21 October' })).toBeEnabled();
  expect(screen.getByRole('button', { name: AWAY_COPY.previousMonth })).toBeDisabled();
});

it('turns the months, over the year, and back', async () => {
  await render(<Picker today="2026-12-30" />);
  await fireEvent.press(screen.getByRole('button', { name: AWAY_COPY.nextMonth }));
  expect(screen.getByText('January 2027')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Saturday 2 January' }));
  expect(changes.at(-1)).toEqual([{ from: '2027-01-02', to: '2027-01-02' }, true]);
  await fireEvent.press(screen.getByRole('button', { name: AWAY_COPY.previousMonth }));
  expect(screen.getByText('December 2026')).toBeOnTheScreen();
});
