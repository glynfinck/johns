import { NEW_HOUSE_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createHouse } from '@/api/house';
import NewHouse from '@/app/house/new';

const mockRefresh = jest.fn();
jest.mock('@/api/house', () => ({ createHouse: jest.fn() }));
jest.mock('@/hooks/use-membership', () => ({ useMembership: () => ({ refresh: mockRefresh }) }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'America/Toronto', deviceCurrency: () => 'CAD' }));

const create = createHouse as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it("starts from the phone's time zone and currency, and Monday", async () => {
  await render(<NewHouse />);
  expect(screen.getByText('America/Toronto')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '$ CAD' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Monday' })).toBeChecked();
  expect(screen.getByRole('button', { name: NEW_HOUSE_COPY.submit })).toBeDisabled();
});

it('sets the house up with what was chosen, then reads the house again', async () => {
  create.mockResolvedValue('h1');
  await render(<NewHouse />);
  await fireEvent.changeText(screen.getByLabelText(NEW_HOUSE_COPY.name), 'Flat 3');
  await fireEvent.press(screen.getByRole('radio', { name: '€ EUR' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Sunday' }));
  await fireEvent.press(screen.getByRole('button', { name: NEW_HOUSE_COPY.submit }));
  expect(create).toHaveBeenCalledWith({ name: 'Flat 3', timezone: 'America/Toronto', currency: 'EUR', weekStarts: 7 });
  expect(mockRefresh).toHaveBeenCalled();
});

it("says what the database refused, and lets you try again", async () => {
  create.mockRejectedValue(new Error("You're already in a house. Leave it first to join another."));
  await render(<NewHouse />);
  await fireEvent.changeText(screen.getByLabelText(NEW_HOUSE_COPY.name), 'Flat 3');
  await fireEvent.press(screen.getByRole('button', { name: NEW_HOUSE_COPY.submit }));
  expect(screen.getByRole('alert')).toHaveTextContent("You're already in a house. Leave it first to join another.");
  expect(screen.getByRole('button', { name: NEW_HOUSE_COPY.submit })).toBeEnabled();
  expect(mockRefresh).not.toHaveBeenCalled();
});
