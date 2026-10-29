import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { BIN_NIGHT } from '@app/core';
import { FONT, SPACE, TAP, WIDE } from '@/theme';

import { PickMenu } from './pick-menu';

// Every host view's measureInWindow, as react-native's jest setup mocks it: one jest.fn they share.
const { measureInWindow } = jest.requireActual<{ default: { measureInWindow: jest.Mock } }>(
  '@react-native/jest-preset/jest/MockNativeMethods',
).default;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

/** The Table's menu, holding what's chosen as TableSection does. */
function Span({ onChange }: { onChange?: (span: string) => void }) {
  const [span, setSpan] = useState<'week' | 'month'>('week');
  return (
    <PickMenu
      options={[
        { value: 'week', label: 'This week' },
        { value: 'month', label: 'October' },
      ]}
      value={span}
      onChange={(next) => {
        onChange?.(next);
        setSpan(next);
      }}
      label="Show"
      testID="span"
    />
  );
}

it("says what's chosen as a header's bold words, a thumb tall, ending at the header's edge", async () => {
  await render(<Span />);
  const words = screen.getByRole('button', { name: 'This week' });
  expect(words).toHaveProp('aria-haspopup', 'menu');
  expect(words).not.toBeExpanded();
  expect(words).toHaveStyle({ minHeight: TAP, marginRight: -SPACE.md });
  expect(screen.getByText('This week')).toHaveStyle({ fontFamily: FONT.bold });
});

it('on a phone, opens the choices in a sheet, the chosen one ticked, and choosing one puts it away', async () => {
  const onChange = jest.fn();
  await render(<Span onChange={onChange} />);
  await fireEvent.press(screen.getByTestId('span'));
  expect(screen.getByTestId('span-sheet')).toBeOnTheScreen();
  expect(screen.getByTestId('span-choices')).toHaveProp('accessibilityRole', 'radiogroup');
  expect(screen.getByTestId('span-choices')).toHaveProp('accessibilityLabel', 'Show');
  expect(screen.getByRole('radio', { name: 'This week' })).toBeChecked();
  expect(screen.getByTestId('span-week')).toHaveStyle({ backgroundColor: BIN_NIGHT.light.secondary });
  await fireEvent.press(screen.getByRole('radio', { name: 'October' }));
  expect(onChange).toHaveBeenCalledWith('month');
  expect(screen.queryByTestId('span-sheet')).toBeNull();
  expect(screen.getByRole('button', { name: 'October' })).toBeOnTheScreen();
});

it("doesn't call back for the one already chosen", async () => {
  const onChange = jest.fn();
  await render(<Span onChange={onChange} />);
  await fireEvent.press(screen.getByTestId('span'));
  await fireEvent.press(screen.getByRole('radio', { name: 'This week' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByTestId('span-sheet')).toBeNull();
});

describe('beside the page', () => {
  beforeEach(() => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: WIDE + 416, height: 900, scale: 1, fontScale: 1 });
    // The words sit at 1200–1300 across, 300–348 down.
    measureInWindow.mockImplementation((place: (x: number, y: number, w: number, h: number) => void) =>
      place(1200, 300, 100, TAP),
    );
  });
  afterEach(() => measureInWindow.mockReset());

  it('drops the choices from the words, their right edges together', async () => {
    await render(<Span />);
    await fireEvent.press(screen.getByTestId('span'));
    expect(screen.queryByTestId('span-sheet')).toBeNull();
    expect(screen.getByTestId('span-menu')).toHaveStyle({ top: 300 + TAP + SPACE.xs, right: WIDE + 416 - 1300 });
    expect(screen.getByRole('button', { name: 'This week' })).toBeExpanded();
  });

  it('puts them away when a choice is made, or with a tap anywhere else', async () => {
    const onChange = jest.fn();
    await render(<Span onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('span'));
    await fireEvent.press(screen.getByRole('radio', { name: 'October' }));
    expect(onChange).toHaveBeenCalledWith('month');
    expect(screen.queryByTestId('span-menu')).toBeNull();
    await fireEvent.press(screen.getByTestId('span'));
    await fireEvent(screen.getByTestId('span-away', { includeHiddenElements: true }), 'responderRelease');
    expect(screen.queryByTestId('span-menu')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
