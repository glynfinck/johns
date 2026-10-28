import { BIN_NIGHT, FRONT_DOOR_COPY, NO_HOUSE_COPY, SIGN_IN_COPY } from '@app/core';
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

async function paste(text: string) {
  await fireEvent.changeText(screen.getByLabelText(FRONT_DOOR_COPY.paste), text);
  await fireEvent.press(screen.getByRole('button', { name: FRONT_DOOR_COPY.open }));
}

beforeEach(() => jest.clearAllMocks());

it('asks for the invite in one field, with one amber button', async () => {
  await open();
  expect(screen.getByRole('header', { name: NO_HOUSE_COPY.heading })).toBeOnTheScreen();
  expect(screen.getByText(FRONT_DOOR_COPY.pasteHint)).toBeOnTheScreen();
  const button = screen.getByRole('button', { name: FRONT_DOOR_COPY.open });
  expect(button).toBeDisabled();
  expect(button).toHaveStyle({ backgroundColor: BIN_NIGHT.light.hivis });
});

it('offers to start a house instead', async () => {
  await open();
  expect(screen.getByRole('link', { name: FRONT_DOOR_COPY.startInstead })).toHaveProp('href', '/house/new');
});

it('opens the join screen for a code, however it was typed', async () => {
  await open();
  await paste('ab3d-ef7h');
  expect(screen).toHavePathname('/join/AB3DEF7H');
});

it('opens the join screen for a whole link pasted in', async () => {
  await open();
  await paste('https://jonz.app/join/AB3DEF7H');
  expect(screen).toHavePathname('/join/AB3DEF7H');
});

it("says so when it can't be an invite, until it's changed", async () => {
  await open();
  await paste('nope');
  expect(screen.getByRole('alert')).toHaveTextContent(FRONT_DOOR_COPY.badInvite);
  expect(screen).toHavePathname('/welcome');
  await fireEvent.changeText(screen.getByLabelText(FRONT_DOOR_COPY.paste), 'nopeX');
  expect(screen.queryByText(FRONT_DOOR_COPY.badInvite)).not.toBeOnTheScreen();
});

it('lets whoever signed in with the wrong account out', async () => {
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(signOut).toHaveBeenCalled();
});
