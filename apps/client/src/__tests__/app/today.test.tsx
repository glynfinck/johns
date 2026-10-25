import { SIGN_IN_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { signOut } from '@/api/auth';
import { getMyName } from '@/api/profile';
import Today from '@/app/today';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/profile', () => ({ getMyName: jest.fn() }));
jest.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } }, loading: false }),
}));

const leave = signOut as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (getMyName as jest.Mock).mockResolvedValue('Priya Shah');
});

it('says who is signed in', async () => {
  await render(<Today />);
  expect(await screen.findByRole('header', { name: 'Priya Shah' })).toBeOnTheScreen();
  expect(getMyName).toHaveBeenCalledWith('user-1');
});

it('signs out', async () => {
  leave.mockResolvedValue(undefined);
  await render(<Today />);
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(leave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: SIGN_IN_COPY.signOut })).toBeDisabled();
});

it('lets you try again when signing out fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  leave.mockRejectedValue(new Error('offline'));
  await render(<Today />);
  await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.signOut }));
  expect(screen.getByRole('button', { name: SIGN_IN_COPY.signOut })).toBeEnabled();
});
