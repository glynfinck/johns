import { FOCUS_SHELL_COPY, SECTION_LABEL } from '@app/core';
import { Link } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { View } from 'react-native';

import { TAP } from '@/theme';

import { MoreButton, TitleBar } from './title-bar';

const more = jest.fn();

const routes = {
  'house/index': () => (
    <View>
      <TitleBar title="Flat 3" sub="2 housemates" right={<MoreButton onPress={more} />} />
      <Link href="/house/wall">To the Wall</Link>
    </View>
  ),
  'house/wall': () => <TitleBar title="The Wall" back="/house" />,
  today: () => <TitleBar title="Today" right="Thu 8 Oct" />,
};

it("is the screen's one heading, with its line beneath and the date beside", async () => {
  await renderRouter(routes, { initialUrl: '/today' });
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getAllByRole('header')).toHaveLength(1);
  expect(bar.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(bar.getByText('Thu 8 Oct')).toBeOnTheScreen();
  expect(bar.queryByRole('button', { name: FOCUS_SHELL_COPY.back })).toBeNull();
});

it('carries a sub line and the screen menu', async () => {
  await renderRouter(routes, { initialUrl: '/house' });
  expect(screen.getByText('2 housemates')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.more }));
  expect(more).toHaveBeenCalledTimes(1);
});

it('goes back where you came from', async () => {
  await renderRouter(routes, { initialUrl: '/house' });
  await fireEvent.press(screen.getByRole('link', { name: 'To the Wall' }));
  expect(screen).toHavePathname('/house/wall');
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.back }));
  expect(screen).toHavePathname('/house');
});

it('goes to its fallback from a page opened cold', async () => {
  await renderRouter(routes, { initialUrl: '/house/wall' });
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.back }));
  expect(screen).toHavePathname('/house');
  expect(screen.getByText('Flat 3')).toBeOnTheScreen();
});

it('names the place back goes to, above the title, a thumb tall', async () => {
  await renderRouter(
    { 'house/stake': () => <TitleBar title="The Stake" back="/house" backLabel={SECTION_LABEL.house} /> },
    { initialUrl: '/house/stake' },
  );
  const bar = within(screen.getByTestId('title-bar'));
  const back = bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) });
  expect(back).toHaveStyle({ minHeight: TAP });
  expect(within(back).getByText(SECTION_LABEL.house)).toBeOnTheScreen();
  // The title is still the bar's one heading, on its own line.
  expect(bar.getAllByRole('header')).toHaveLength(1);
  expect(within(back).queryByRole('header')).toBeNull();
  expect(bar.getByRole('header', { name: 'The Stake' })).toBeOnTheScreen();
});
