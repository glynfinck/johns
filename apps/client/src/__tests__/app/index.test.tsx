import { FRONT_DOOR, SIGN_IN, TAGLINE } from '@app/core';
import { render, screen } from '@testing-library/react-native';

import FrontDoor from '@/app/index';
import { TAP } from '@/theme';

it('opens on the same front door as the web', async () => {
  await render(<FrontDoor />);
  expect(screen.getByRole('header', { name: FRONT_DOOR.headline })).toBeOnTheScreen();
  expect(screen.getByText(TAGLINE)).toBeOnTheScreen();
  for (const point of FRONT_DOOR.points) expect(screen.getByText(point.title)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'Privacy' })).toBeOnTheScreen();
});

it('leads every way in to sign-in, as the web does', async () => {
  await render(<FrontDoor />);
  for (const label of [FRONT_DOOR.signIn, FRONT_DOOR.start, FRONT_DOOR.join]) {
    expect(screen.getByRole('link', { name: label })).toHaveProp('href', SIGN_IN);
  }
});

it('gives every link a whole thumb to land on', async () => {
  await render(<FrontDoor />);
  expect(screen.getByTestId('privacy')).toHaveStyle({ minHeight: TAP });
  for (const label of [FRONT_DOOR.start, FRONT_DOOR.join]) {
    expect(screen.getByRole('link', { name: label })).toHaveStyle({ minHeight: TAP });
  }
});
