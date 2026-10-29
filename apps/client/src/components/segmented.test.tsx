import { fireEvent, render, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { FONT, NARROW, SPACE, TAP } from '@/theme';

import { Segmented } from './segmented';

// focus.test.tsx covers the switch itself; this is how it fits a small phone.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

const look = (
  <Segmented
    label="Look"
    options={[
      { value: 'light', label: 'Day' },
      { value: 'dark', label: 'Night' },
      { value: 'system', label: 'Auto' },
    ]}
    value="system"
    onChange={jest.fn()}
  />
);

it('pads its words on a phone', async () => {
  await render(look);
  expect(screen.getByRole('radio', { name: 'Night' })).toHaveStyle({ paddingHorizontal: SPACE.md });
});

it('pads them less on a small phone, so the row beside it keeps its name, still a thumb wide and tall', async () => {
  (useWindowDimensions as jest.Mock).mockReturnValue({ width: NARROW - 40, height: 640, scale: 2, fontScale: 1 });
  await render(look);
  for (const name of ['Day', 'Night', 'Auto']) {
    expect(screen.getByRole('radio', { name })).toHaveStyle({ paddingHorizontal: SPACE.xs, minWidth: TAP, minHeight: TAP });
  }
});

it('in a section header, is its words alone: a thumb tall, the chosen one bold and the switch still a radio group', async () => {
  const onChange = jest.fn();
  await render(
    <Segmented
      label="Show"
      options={[
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Oct', spoken: 'October' },
      ]}
      value="week"
      onChange={onChange}
      quiet
      testID="span"
    />,
  );
  expect(screen.getByTestId('span')).toHaveProp('accessibilityRole', 'radiogroup');
  expect(screen.getByTestId('span')).toHaveProp('accessibilityLabel', 'Show');
  expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'October' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'October' })).toHaveStyle({ minHeight: TAP });
  expect(screen.getByText('Week')).toHaveStyle({ fontFamily: FONT.bold });
  await fireEvent.press(screen.getByRole('radio', { name: 'October' }));
  expect(onChange).toHaveBeenCalledWith('month');
});
