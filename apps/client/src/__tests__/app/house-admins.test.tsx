import { ADMINS_COPY, HISTORY_COPY } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { setRole } from '@/api/settings';
import AdminsScreen from '@/app/(house)/house/admins';
import { ToastProvider } from '@/components/toast';
import { snapshot } from '@/testing/house';
import { renderPages } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/history', () => ({ undoAction: jest.fn(), undoLatest: jest.fn() }));
jest.mock('@/api/settings', () => ({ setRole: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
let mockMe = 'priya';
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMe } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const ADA = { userId: 'ada', name: 'Ada', photo: null, role: 'member' as const, streak: 0, immunityTokens: 0, swapTokens: 0 };

async function open() {
  await renderPages(
    {
      'house/admins': () => (
        <ToastProvider>
          <AdminsScreen />
        </ToastProvider>
      ),
    },
    '/house/admins',
  );
  return within(await screen.findByTestId('admins-list'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMe = 'priya';
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ members: [...snapshot().members, ADA] }));
  (setRole as jest.Mock).mockResolvedValue(undefined);
});

it('lists the admins, and the only one is told leaving hands over', async () => {
  const list = await open();
  expect(list.getAllByTestId('admin-row')).toHaveLength(1);
  expect(list.getByText(ADMINS_COPY.you('Priya'))).toBeOnTheScreen();
  // The only admin can't step themselves down here.
  expect(list.queryByTestId('remove-admin')).toBeNull();
  expect(screen.getByText(new RegExp(ADMINS_COPY.onlyAdmin))).toBeOnTheScreen();
});

it('adds an admin from the housemates who aren’t one, then offers Undo', async () => {
  const list = await open();
  await fireEvent.press(list.getByRole('button', { name: ADMINS_COPY.add }));
  const sheet = within(screen.getByTestId('add-admin-sheet'));
  expect(sheet.getAllByTestId('admin-pick')).toHaveLength(2);
  await fireEvent.press(sheet.getByRole('radio', { name: 'Ada' }));
  await fireEvent.press(sheet.getByRole('button', { name: ADMINS_COPY.make('Ada') }));
  await waitFor(() => expect(setRole).toHaveBeenCalledWith('h1', 'ada', 'admin'));
  expect(await screen.findByText(HISTORY_COPY.madeAdmin('Ada'))).toBeOnTheScreen();
});

it('lets an admin step another down, and shows housemates the list alone', async () => {
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ members: [...snapshot().members, { ...ADA, role: 'admin' }] }));
  const list = await open();
  await fireEvent.press(list.getByRole('button', { name: ADMINS_COPY.removeLabel('Ada') }));
  await waitFor(() => expect(setRole).toHaveBeenCalledWith('h1', 'ada', 'member'));

  mockMe = 'sam';
  const theirs = await open();
  expect(theirs.queryByTestId('add-admin')).toBeNull();
  expect(theirs.queryByTestId('remove-admin')).toBeNull();
});
