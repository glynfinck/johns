import { render, screen } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { NARROW, SPACE, TAP } from '@/theme';

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
