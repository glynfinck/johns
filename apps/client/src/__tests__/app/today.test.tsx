import { SIGN_IN_COPY } from '@app/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { signOut } from '@/api/auth';
import { catchUp } from '@/api/house';
import { getMyName } from '@/api/profile';
import Today from '@/app/today';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/profile', () => ({ getMyName: jest.fn() }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'user-1' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const leave = signOut as jest.Mock;

async function open() {
  await renderRouter({ today: Today }, { initialUrl: '/today' });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getMyName as jest.Mock).mockResolvedValue('Priya Shah');
  (catchUp as jest.Mock).mockResolvedValue(true);
});

it('names the house and who is signed in', async () => {
  await open();
  expect(screen.getByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
  expect(await screen.findByText('Signed in as Priya Shah')).toBeOnTheScreen();
  expect(getMyName).toHaveBeenCalledWith('user-1');
});

it('catches the house up as it comes into view', async () => {
  await open();
  expect(catchUp).toHaveBeenCalledWith('h1');
});

it("doesn't mind when catching up fails", async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (catchUp as jest.Mock).mockRejectedValue(new Error('offline'));
  await open();
  expect(screen.getByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
});

it('signs out, and lets you try again when that fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  leave.mockRejectedValueOnce(new Error('offline'));
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(leave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: SIGN_IN_COPY.signOut })).toBeEnabled();
});
