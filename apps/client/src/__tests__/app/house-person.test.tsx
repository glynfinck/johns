import { FOCUS_SHELL_COPY, MEMBERS_COPY, SECTION_LABEL } from '@app/core';
import { fireEvent, screen, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { removeMember, setRole } from '@/api/settings';
import PersonScreen from '@/app/(house)/house/people/[userId]';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/settings', () => ({ setRole: jest.fn(), removeMember: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const mockMembership = { userId: 'priya' };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMembership.userId } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

async function open(person: string, as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  await renderPages({ 'house/people/[userId]': PersonScreen }, `/house/people/${person}`);
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  for (const move of [setRole, removeMember]) (move as jest.Mock).mockResolvedValue(undefined);
});

it('names the housemate in the title bar, with the way back to House', async () => {
  await open('sam');
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: 'Sam' })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
  expect(screen.getByTestId('member')).toHaveTextContent(/Sam.*Housemate/);
});

it('lets an admin make them an admin', async () => {
  await open('sam');
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.makeAdmin }));
  expect(setRole).toHaveBeenCalledWith('h1', 'sam', 'admin');
});

it('asks twice before removing them', async () => {
  await open('sam');
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.remove }));
  expect(removeMember).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.cancel }));
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.remove }));
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.removeName('Sam') }));
  expect(removeMember).toHaveBeenCalledWith('h1', 'sam');
});

it('says why a change was refused', async () => {
  (setRole as jest.Mock).mockRejectedValue(new Error('Only the house admins can do that.'));
  await open('sam');
  await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.makeAdmin }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Only the house admins can do that.');
});

it('offers nothing to change on your own page, or to a housemate who is not an admin', async () => {
  await open('priya');
  expect(screen.getByTestId('member')).toHaveTextContent(/Priya \(you\).*Admin/);
  expect(screen.queryByRole('button', { name: MEMBERS_COPY.remove })).toBeNull();
  await screen.unmount();
  await open('priya', 'sam');
  expect(screen.queryByRole('button', { name: MEMBERS_COPY.makeAdmin })).toBeNull();
  expect(screen.queryByRole('button', { name: MEMBERS_COPY.remove })).toBeNull();
});

it("says so for someone who isn't in the house any more", async () => {
  await open('ben');
  expect(screen.getByText(FOCUS_SHELL_COPY.gone)).toBeOnTheScreen();
  expect(screen.queryByTestId('member')).toBeNull();
});
