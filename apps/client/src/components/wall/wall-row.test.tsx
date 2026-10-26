import { REACTION_LABEL, WALL_FEED_COPY } from '@app/core';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { NiceToggle, ReactButton, ReactionTally } from './wall-row';

afterEach(() => jest.restoreAllMocks());

it('says how many gave a Nice one, and is pressed in a browser once it is yours', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const onPress = jest.fn();
  await render(<NiceToggle count={2} mine onPress={onPress} />);
  const toggle = screen.getByRole('button', { name: WALL_FEED_COPY.tally(REACTION_LABEL.nice, 2) });
  expect(toggle).toHaveProp('aria-pressed', true);
  expect(toggle).not.toHaveProp('aria-selected');
  await fireEvent.press(toggle);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('is selected on a phone, which has no pressed, and says just its name before anyone gives it', async () => {
  await render(<NiceToggle count={0} mine={false} onPress={jest.fn()} />);
  const toggle = screen.getByRole('button', { name: REACTION_LABEL.nice });
  expect(toggle).not.toBeSelected();
  // Only the room for a count, unseen and unheard, so the thumbs down a group line up.
  expect(within(toggle).queryByText(/\d/)).toBeNull();
  expect(within(toggle).getByText('0', { includeHiddenElements: true })).toBeTruthy();
});

it('shows all four when held down, as the row does', async () => {
  const onLongPress = jest.fn();
  await render(<NiceToggle count={1} mine={false} onPress={jest.fn()} onLongPress={onLongPress} />);
  await fireEvent(screen.getByTestId('nice-one'), 'longPress');
  expect(onLongPress).toHaveBeenCalledTimes(1);
});

it('says what the house gave most, and opens all four reactions', async () => {
  const onPress = jest.fn();
  await render(<ReactionTally kind="fire" count={3} onPress={onPress} />);
  const tally = screen.getByRole('button', { name: WALL_FEED_COPY.tally(REACTION_LABEL.fire, 3) });
  expect(tally).toHaveTextContent('3');
  await fireEvent.press(tally);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('offers a way to react where there are none yet', async () => {
  const onPress = jest.fn();
  await render(<ReactButton onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: WALL_FEED_COPY.react }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
