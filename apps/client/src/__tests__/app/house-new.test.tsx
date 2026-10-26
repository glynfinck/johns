import { BIN_NIGHT, FRONT_DOOR_COPY, NEW_HOUSE_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createHouse } from '@/api/house';
import NewHouse from '@/app/house/new';

const mockRefresh = jest.fn();
jest.mock('@/api/house', () => ({ createHouse: jest.fn() }));
jest.mock('@/hooks/use-membership', () => ({ useMembership: () => ({ refresh: mockRefresh }) }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'America/St_Johns', deviceCurrency: () => 'CAD' }));

const create = createHouse as jest.Mock;
/** The defaults line as it's drawn: its parts between middle dots, as every Meta line's are. */
const line = (...parts: string[]) => parts.join(' · ');

beforeEach(() => jest.clearAllMocks());

it('asks for one thing, the name, with the defaults in one line', async () => {
  await render(<NewHouse />);
  expect(screen.getByRole('header', { name: NEW_HOUSE_COPY.heading })).toBeOnTheScreen();
  expect(screen.getByLabelText(FRONT_DOOR_COPY.name)).toBeOnTheScreen();
  // The phone's currency and time zone, and Monday, on one line that truncates.
  const defaults = screen.getByTestId('house-defaults');
  expect(defaults).toHaveTextContent(line('CAD 20 a month each', 'weeks start Monday', 'America/St Johns'));
  expect(defaults).toHaveProp('numberOfLines', 1);
  expect(screen.getByTestId('change-defaults')).toHaveTextContent(FRONT_DOOR_COPY.change, { exact: false });
  expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
  const submit = screen.getByRole('button', { name: FRONT_DOOR_COPY.submit });
  expect(submit).toBeDisabled();
  expect(submit).toHaveStyle({ backgroundColor: BIN_NIGHT.light.hivis });
});

it('starts the house with the defaults, then reads the house again', async () => {
  create.mockResolvedValue('h1');
  await render(<NewHouse />);
  await fireEvent.changeText(screen.getByLabelText(FRONT_DOOR_COPY.name), 'Flat 3');
  await fireEvent.press(screen.getByRole('button', { name: FRONT_DOOR_COPY.submit }));
  expect(create).toHaveBeenCalledWith({ name: 'Flat 3', timezone: 'America/St_Johns', currency: 'CAD', weekStarts: 1 });
  expect(mockRefresh).toHaveBeenCalled();
});

it('opens the currency and the first day under Change, and the line follows them', async () => {
  create.mockResolvedValue('h1');
  await render(<NewHouse />);
  const change = screen.getByTestId('change-defaults');
  expect(change).toBeCollapsed();
  expect(change).toHaveAccessibleName(`${FRONT_DOOR_COPY.change}: CAD 20 a month each, weeks start Monday, America/St Johns`);
  await fireEvent.press(change);
  // The same control, now open, says Done.
  expect(screen.getByTestId('change-defaults')).toBeExpanded();
  expect(screen.getByTestId('change-defaults')).toHaveTextContent(FRONT_DOOR_COPY.done, { exact: false });
  expect(screen.getByLabelText(NEW_HOUSE_COPY.currency)).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'CAD' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Monday' })).toBeChecked();
  // Seven days share the sign's width, so they fit across a phone.
  for (const day of ['Monday', 'Wednesday', 'Sunday']) expect(screen.getByRole('radio', { name: day })).toHaveStyle({ flex: 1 });
  expect(screen.getByText(FRONT_DOOR_COPY.zoneNote('America/St Johns'))).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Sunday' }));
  expect(screen.getByRole('radio', { name: 'Sunday' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Monday' })).not.toBeChecked();
  expect(screen.getByTestId('house-defaults')).toHaveTextContent(
    line('EUR 20 a month each', 'weeks start Sunday', 'America/St Johns'),
  );

  // Done folds them away again, keeping what was chosen.
  await fireEvent.press(screen.getByTestId('change-defaults'));
  expect(screen.getByTestId('change-defaults')).toBeCollapsed();
  expect(screen.queryByRole('radio')).not.toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText(FRONT_DOOR_COPY.name), 'Flat 3');
  await fireEvent.press(screen.getByRole('button', { name: FRONT_DOOR_COPY.submit }));
  expect(create).toHaveBeenCalledWith({ name: 'Flat 3', timezone: 'America/St_Johns', currency: 'EUR', weekStarts: 7 });
});

it('says what the database refused, and lets you try again', async () => {
  create.mockRejectedValue(new Error("You're already in a house. Leave it first to join another."));
  await render(<NewHouse />);
  await fireEvent.changeText(screen.getByLabelText(FRONT_DOOR_COPY.name), 'Flat 3');
  await fireEvent.press(screen.getByRole('button', { name: FRONT_DOOR_COPY.submit }));
  expect(screen.getByRole('alert')).toHaveTextContent("You're already in a house. Leave it first to join another.");
  expect(screen.getByRole('button', { name: FRONT_DOOR_COPY.submit })).toBeEnabled();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it('offers the way in for someone with an invite', async () => {
  await render(<NewHouse />);
  expect(screen.getByRole('link', { name: FRONT_DOOR_COPY.invite })).toHaveProp('href', '/welcome');
});
