import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LogOutIcon, PencilIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { BIN_NIGHT } from '@app/core';

import { ActionMenu } from './action-menu';

// A Modal that stays in the tree while it slides out, and hands the test its
// onDismiss, which iOS calls once the slide out has ended.
const mockSlide: { end?: () => void } = {};
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, onDismiss, children }: { visible: boolean; onDismiss?: () => void; children: unknown }) => {
      mockSlide.end = onDismiss;
      return createElement(View, { testID: visible ? 'modal-open' : 'modal-closing' }, visible ? children : null);
    },
  };
});

/** A screen that opens the menu, as TitleBar's MoreButton does. */
function Menu({ order }: { order: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <ActionMenu
      visible={open}
      onClose={() => {
        order.push('closed');
        setOpen(false);
      }}
      actions={[
        { label: 'Rename the house', icon: PencilIcon, onPress: () => order.push('rename') },
        { label: 'Leave the house', icon: LogOutIcon, tone: 'hazard', onPress: () => order.push('leave'), testID: 'leave' },
      ]}
    />
  );
}

afterEach(() => jest.restoreAllMocks());

it('on iOS, puts itself away and does what was chosen once it has gone', async () => {
  const order: string[] = [];
  await render(<Menu order={order} />);
  expect(screen.getByText('Leave the house')).toHaveStyle({ color: BIN_NIGHT.light.hazard });
  expect(screen.getByTestId('leave')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Rename the house' }));
  // Still sliding out: a sheet the action opens would not rise yet.
  expect(screen.getByTestId('modal-closing')).toBeOnTheScreen();
  expect(order).toEqual(['closed']);

  await act(() => mockSlide.end?.());
  expect(order).toEqual(['closed', 'rename']);
  // Only once, however often it says it has gone.
  await act(() => mockSlide.end?.());
  expect(order).toEqual(['closed', 'rename']);
});

it('elsewhere, does what was chosen as soon as it closes', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const order: string[] = [];
  await render(<Menu order={order} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Leave the house' }));
  expect(order).toEqual(['closed', 'leave']);
});

it('does nothing when put away without a choice', async () => {
  const order: string[] = [];
  const { rerender } = await render(<ActionMenu visible onClose={jest.fn()} actions={[{ label: 'Rename', onPress: () => order.push('rename') }]} />);
  await rerender(<ActionMenu visible={false} onClose={jest.fn()} actions={[{ label: 'Rename', onPress: () => order.push('rename') }]} />);
  await act(() => mockSlide.end?.());
  expect(order).toEqual([]);
});

it('shows nothing while shut', async () => {
  await render(<ActionMenu visible={false} onClose={jest.fn()} actions={[{ label: 'Rename', onPress: jest.fn() }]} />);
  expect(screen.queryByText('Rename')).toBeNull();
});
