import { FRONT_DOOR, TAGLINE } from '@app/core';
import { render, screen } from '@testing-library/react-native';

import { TAP } from '@/theme';

import FrontDoor from './index';

it('opens on the same front door as the web', async () => {
  await render(<FrontDoor />);
  expect(screen.getByRole('header', { name: FRONT_DOOR.headline })).toBeOnTheScreen();
  expect(screen.getByText(TAGLINE)).toBeOnTheScreen();
  for (const point of FRONT_DOOR.points) expect(screen.getByText(point.title)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'Privacy' })).toBeOnTheScreen();
});

it('gives the privacy link a whole thumb to land on', async () => {
  await render(<FrontDoor />);
  expect(screen.getByTestId('privacy')).toHaveStyle({ minHeight: TAP });
});
