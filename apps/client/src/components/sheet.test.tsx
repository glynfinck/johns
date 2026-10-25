import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { Sheet } from './sheet';

// A Modal that, like react-native-web's, stays in the tree while it closes
// (it slides out first), so the test can see whether the sheet let it go.
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: unknown }) =>
      createElement(View, { testID: visible ? 'modal-open' : 'modal-closing' }, children),
  };
});

const sheet = (visible: boolean) => (
  <Sheet visible={visible} title="Make a group" onClose={jest.fn()}>
    <Text>The form</Text>
  </Sheet>
);

afterEach(() => jest.restoreAllMocks());

it('shows its title and its form while open', async () => {
  await render(sheet(true));
  expect(screen.getByTestId('modal-open')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Make a group' })).toBeOnTheScreen();
  expect(screen.getByText('The form')).toBeOnTheScreen();
});

it('on a phone, stays to slide out as it closes', async () => {
  const { rerender } = await render(sheet(true));
  await rerender(sheet(false));
  expect(screen.getByTestId('modal-closing')).toBeOnTheScreen();
});

it('on the web, is gone the moment it closes, so it holds on to no focus', async () => {
  // react-native-web keeps a closing Modal, and its hold on focus, until the
  // slide out ends: typing into the next sheet would land on this one instead.
  jest.replaceProperty(Platform, 'OS', 'web');
  const { rerender } = await render(sheet(true));
  expect(screen.getByTestId('modal-open')).toBeOnTheScreen();
  await rerender(sheet(false));
  expect(screen.queryByTestId('modal-closing')).toBeNull();
  expect(screen.queryByText('Make a group')).toBeNull();
});
