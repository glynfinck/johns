import { BIN_NIGHT } from '@app/core';
import { renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';

import { ASIDE, CONTENT_MAX, GUTTER, MAIN_MAX } from '@/theme';

import { Columns, Screen } from './screen';
import { TitleBar } from './title-bar';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

const LAPTOP = { width: 1440, height: 900, scale: 1, fontScale: 1 };

const routes = {
  rules: () => (
    <Screen bar={<TitleBar title="House rules" />}>
      <Text>One column</Text>
    </Screen>
  ),
  today: () => (
    <Screen bar={<TitleBar title="Today" />} spreads>
      <Columns main={<Text>Next up</Text>} side={<Text>This week</Text>} />
    </Screen>
  ),
};

/** The scrolling page's content, as one style. */
function page() {
  return StyleSheet.flatten(screen.getByTestId('page-scroll').props.contentContainerStyle);
}

/** The title bar's line of words and buttons, as one style. */
function bar() {
  const inner = screen.getByTestId('title-bar').children[0];
  return StyleSheet.flatten(typeof inner === 'string' ? undefined : inner.props.style);
}

it('on a phone, centres the page and lines the title bar up with it', async () => {
  await renderRouter(routes, { initialUrl: '/rules' });
  expect(page()).toMatchObject({ alignSelf: 'center', maxWidth: CONTENT_MAX });
  expect(bar()).toMatchObject({ maxWidth: CONTENT_MAX });
});

it("from a laptop's width, starts a page in one column at its leading edge, under a bar across the page", async () => {
  (useWindowDimensions as jest.Mock).mockReturnValue(LAPTOP);
  await renderRouter(routes, { initialUrl: '/rules' });
  expect(page()).toMatchObject({ alignSelf: 'flex-start', maxWidth: CONTENT_MAX });
  expect(bar().maxWidth).toBeUndefined();
});

it('fills the page with two columns, the side a panel docked to the right edge', async () => {
  (useWindowDimensions as jest.Mock).mockReturnValue(LAPTOP);
  await renderRouter(routes, { initialUrl: '/today' });
  expect(page().maxWidth).toBeUndefined();
  expect(page()).toMatchObject({ paddingRight: 0, paddingBottom: 0 });
  expect(screen.getByTestId('column-main')).toHaveStyle({ flex: 1, maxWidth: MAIN_MAX });
  expect(screen.getByTestId('column-side')).toHaveStyle({
    width: ASIDE + 2 * GUTTER,
    marginTop: -GUTTER,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BIN_NIGHT.light.border,
  });
  expect(bar().maxWidth).toBeUndefined();
});
