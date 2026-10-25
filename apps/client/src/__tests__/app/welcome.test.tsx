import { NO_HOUSE_COPY, SIGN_IN_COPY } from '@app/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { signOut } from '@/api/auth';
import Welcome from '@/app/welcome';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));

async function open() {
  await renderRouter(
    { welcome: Welcome, 'house/new': () => <Text>New house</Text>, 'join/[joinCode]': () => <Text>Join</Text> },
    { initialUrl: '/welcome' },
  );
}

beforeEach(() => jest.clearAllMocks());

it('offers to start a house', async () => {
  await open();
  expect(screen.getByRole('header', { name: NO_HOUSE_COPY.heading })).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: NO_HOUSE_COPY.start })).toHaveProp('href', '/house/new');
});

it('opens the join screen for a code, however it was typed', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText(NO_HOUSE_COPY.code), 'ab3d-ef7h');
  await fireEvent.press(screen.getByRole('button', { name: NO_HOUSE_COPY.join }));
  expect(screen).toHavePathname('/join/AB3DEF7H');
});

it("says so when the code can't be one, until it's changed", async () => {
  await open();
  const field = screen.getByLabelText(NO_HOUSE_COPY.code);
  await fireEvent.changeText(field, 'nope');
  await fireEvent.press(screen.getByRole('button', { name: NO_HOUSE_COPY.join }));
  expect(screen.getByText(NO_HOUSE_COPY.badCode)).toBeOnTheScreen();
  expect(screen).toHavePathname('/welcome');
  await fireEvent.changeText(field, 'nopeX');
  expect(screen.queryByText(NO_HOUSE_COPY.badCode)).toBeNull();
});

it('lets whoever signed in with the wrong account out', async () => {
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(signOut).toHaveBeenCalled();
});
