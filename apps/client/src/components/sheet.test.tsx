import { BIN_NIGHT, SHELL_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { measureAt, measureNowhere } from '@/testing/layout';
import { LookContext } from '@/theme';

import { Sheet, SheetAnchor } from './sheet';

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

describe('on a wide window', () => {
  it('dims the whole window behind it, not just the column above the sheet', async () => {
    await render(sheet(true));
    const [scrim] = screen.getAllByLabelText(SHELL_COPY.close);
    expect(scrim).toHaveStyle({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('keeps the sheet a capped column in the middle', async () => {
    await render(
      <Sheet visible title="Make a group" onClose={jest.fn()} testID="group-sheet">
        <Text>The form</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('group-sheet')).toHaveStyle({ width: '100%', maxWidth: 512, alignSelf: 'center' });
  });
});

it('marks its top edge in the dark, where the scrim and the sheet are nearly one colour', async () => {
  const at = (look: 'light' | 'dark') => (
    <LookContext.Provider value={look}>
      <Sheet visible title="Make a group" onClose={jest.fn()} testID="group-sheet">
        <Text>The form</Text>
      </Sheet>
    </LookContext.Provider>
  );
  const { rerender } = await render(at('dark'));
  expect(screen.getByTestId('group-sheet')).toHaveStyle({ borderTopWidth: StyleSheet.hairlineWidth, borderColor: BIN_NIGHT.dark.border });
  await rerender(at('light'));
  expect(screen.getByTestId('group-sheet')).not.toHaveStyle({ borderTopWidth: StyleSheet.hairlineWidth });
});

describe('opening at an anchor', () => {
  // Jest lays nothing out: say where the anchor is, and watch the scroll
  // (Jest's ScrollViews share one scrollTo mock, so it's cleared before each test).
  let scrollTo: jest.SpyInstance;
  beforeEach(() => {
    measureAt(600);
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    scrollTo.mockClear();
  });
  afterEach(measureNowhere);

  const anchored = (visible: boolean, openAt?: string) => (
    <Sheet visible={visible} title="Clean the bathroom" onClose={jest.fn()} openAt={openAt}>
      <Text>Mark done</Text>
      <SheetAnchor name="cant">
        <Text>If you can’t</Text>
      </SheetAnchor>
    </Sheet>
  );

  /** The sheet is 500 tall and its content 1200, and the anchor has been laid out. */
  async function layOut() {
    await fireEvent(screen.getByTestId('sheet-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 500 } } });
    await fireEvent(screen.getByTestId('sheet-scroll'), 'contentSizeChange', 390, 1200);
    await fireEvent(screen.getByTestId('sheet-anchor-cant'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } } });
  }

  it('scrolls the anchor it names into view, a little below the top, once', async () => {
    await render(anchored(true, 'cant'));
    await layOut();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 600 - 16, animated: false });
    // Laid out again (its content changed): the scroll is the reader's now.
    await layOut();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('never scrolls past the end of the content', async () => {
    measureAt(820);
    await render(anchored(true, 'cant'));
    await layOut();
    expect(scrollTo).toHaveBeenCalledWith({ y: 1200 - 500, animated: false });
  });

  it('stays at the top when it opens for nothing in particular', async () => {
    await render(anchored(true));
    await layOut();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls there again the next time it opens', async () => {
    const { rerender } = await render(anchored(true, 'cant'));
    await layOut();
    await rerender(anchored(false, 'cant'));
    await rerender(anchored(true, 'cant'));
    await layOut();
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});
