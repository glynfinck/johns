import { FOCUS_SHELL_COPY, GROUPS_COPY, PAGE_TITLE, SECTION_LABEL, SETUP_COPY } from '@app/core';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { deleteGroup, loadJohnList, saveGroup } from '@/api/settings';
import GroupsScreen from '@/app/(house)/house/groups';
import { snapshot } from '@/testing/house';
import { BATH, renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/settings', () => ({ loadJohnList: jest.fn(), saveGroup: jest.fn(), deleteGroup: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const mockMembership = { userId: 'priya' };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMembership.userId } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const UPSTAIRS = { id: 'g1', name: 'Upstairs bathroom', memberIds: ['priya', 'sam'] };

async function open(as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  await renderPages({ 'house/groups': GroupsScreen }, '/house/groups');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
  for (const move of [saveGroup, deleteGroup]) (move as jest.Mock).mockResolvedValue(undefined);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.groups })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('names each group and who is in it, and says when nobody is', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({
    johns: [{ ...BATH, groupId: 'g1' }],
    groups: [UPSTAIRS, { id: 'g2', name: 'Attic', memberIds: [] }],
  });
  await open();
  const [upstairs, attic] = screen.getAllByTestId('group');
  expect(upstairs).toHaveTextContent(/Upstairs bathroom.*You and Sam/);
  expect(attic).toHaveTextContent(`Attic${GROUPS_COPY.nobody}`);
  expect(screen.getByText(SETUP_COPY.groupsNote)).toBeOnTheScreen();
});

it('explains what a group is before there are any', async () => {
  await open('sam');
  expect(screen.getByText(SETUP_COPY.noGroups)).toBeOnTheScreen();
  expect(screen.getByText(GROUPS_COPY.empty)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: SETUP_COPY.addGroup })).toBeNull();
});

describe('an admin', () => {
  it('makes a group of the people who share something, each named by first name', async () => {
    const members = snapshot().members;
    (loadHouse as jest.Mock).mockResolvedValue(snapshot({ members: [members[0], { ...members[1], name: 'Sam Carter' }] }));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.addGroup }));
    expect(screen.getByRole('header', { name: SETUP_COPY.addGroup })).toBeOnTheScreen();
    const form = within(screen.getByTestId('group-form'));
    expect(form.getByTestId('save-group')).toBeDisabled();
    await fireEvent.changeText(form.getByTestId('group-name'), 'Upstairs bathroom');
    await fireEvent.press(form.getByRole('checkbox', { name: SETUP_COPY.you }));
    await fireEvent.press(form.getByRole('checkbox', { name: 'Sam' }));
    expect(form.getByRole('checkbox', { name: 'Sam' })).toBeChecked();
    await fireEvent.press(form.getByRole('checkbox', { name: 'Sam' }));
    expect(form.getByRole('checkbox', { name: 'Sam' })).not.toBeChecked();
    await fireEvent.press(form.getByTestId('save-group'));
    expect(saveGroup).toHaveBeenCalledWith('h1', { id: undefined, name: 'Upstairs bathroom', members: ['priya'] });
    await waitFor(() => expect(screen.queryByTestId('group-form')).toBeNull());
  });

  it("won't make a group with nobody in it", async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.addGroup }));
    await fireEvent.changeText(screen.getByTestId('group-name'), 'Attic');
    expect(screen.getByTestId('save-group')).toBeDisabled();
  });

  it('adds another group from the foot of the list', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [UPSTAIRS] });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.addGroup }));
    expect(screen.getByTestId('group-name')).toHaveDisplayValue('');
  });

  it('opens a group to change it, or to delete it', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [UPSTAIRS] });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: `${GROUPS_COPY.edit('Upstairs bathroom')}, You and Sam` }));
    const form = within(screen.getByTestId('group-form'));
    expect(form.getByTestId('group-name')).toHaveDisplayValue('Upstairs bathroom');
    expect(form.getByRole('checkbox', { name: 'Sam' })).toBeChecked();
    await fireEvent.press(form.getByRole('button', { name: GROUPS_COPY.remove }));
    expect(deleteGroup).toHaveBeenCalledWith('g1');
  });

  it('keeps the sheet open, saying why, when the save is refused', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [UPSTAIRS] });
    (saveGroup as jest.Mock).mockRejectedValue(new Error('Only the house admins can do that.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: `${GROUPS_COPY.edit('Upstairs bathroom')}, You and Sam` }));
    await fireEvent.changeText(screen.getByTestId('group-name'), 'Bathroom');
    await fireEvent.press(screen.getByTestId('save-group'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the house admins can do that.');
    expect(screen.getByTestId('group-form')).toBeOnTheScreen();
  });
});

it('is for admins to change', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [UPSTAIRS] });
  await open('sam');
  expect(screen.getByTestId('group')).toHaveTextContent(/Upstairs bathroom.*You and Priya/);
  expect(screen.queryByRole('button', { name: SETUP_COPY.addGroup })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
});
