import { DEAL_COPY, FOCUS_SHELL_COPY, JOHN_LIST_COPY, NEW_JOHN, PAGE_TITLE, SECTION_LABEL } from '@app/core';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { archiveJohn, dealThisWeek, loadJohnList, saveJohn } from '@/api/settings';
import JohnListScreen from '@/app/(house)/house/johns';
import { snapshot } from '@/testing/house';
import { BATH, BINS, renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/settings', () => ({
  loadJohnList: jest.fn(),
  saveJohn: jest.fn(),
  archiveJohn: jest.fn(),
  dealThisWeek: jest.fn(),
}));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const mockMembership = { userId: 'priya' };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMembership.userId } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

async function open(as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  await renderPages({ 'house/johns': JohnListScreen }, '/house/johns');
  await untilRead();
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS, BATH], groups: [] });
  for (const move of [saveJohn, archiveJohn, dealThisWeek]) (move as jest.Mock).mockResolvedValue(undefined);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.johnList })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('shows each John: how often, when, its effort, and whether it needs a photo', async () => {
  await open();
  const [bins, bath] = screen.getAllByTestId('john-def');
  expect(bins).toHaveTextContent(/Bins.*Every week · due Thu 07:00.*1 pt/);
  expect(bath).toHaveTextContent(/Bathroom.*Every 2 weeks · due Sun 21:00.*4 pts/);
  expect(within(bath).getByLabelText(JOHN_LIST_COPY.needsPhoto)).toBeOnTheScreen();
  expect(screen.getByText(JOHN_LIST_COPY.perWeek(3))).toBeOnTheScreen();
});

it('says which group shares a John', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({
    johns: [{ ...BATH, groupId: 'g1' }],
    groups: [{ id: 'g1', name: 'Upstairs bathroom', memberIds: ['priya', 'sam'] }],
  });
  await open();
  expect(screen.getAllByTestId('john-def')[0]).toHaveTextContent(/· Upstairs bathroom/);
});

it('starts an empty house off with the Johns that cause arguments', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
  await open();
  expect(await screen.findByText(JOHN_LIST_COPY.empty)).toBeOnTheScreen();
  // Nothing to hand out yet.
  expect(screen.queryByTestId('deal-week')).toBeNull();
});

it('reads the list again on the way back to it', async () => {
  mockMembership.userId = 'priya';
  await renderPages({ 'house/johns': JohnListScreen, 'house/index': () => <Text>House</Text> }, '/house/johns');
  await screen.findAllByTestId('john-def');
  expect(loadJohnList).toHaveBeenCalledTimes(1);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS], groups: [] });
  await act(() => router.navigate('/house'));
  await act(() => router.navigate('/house/johns'));
  await waitFor(() => expect(screen.getAllByTestId('john-def')).toHaveLength(1));
});

describe('an admin', () => {
  it('adds a John', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('add-john'));
    expect(screen.getByRole('header', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('john-name'), 'Hob');
    await fireEvent.press(screen.getByRole('radio', { name: 'Kitchen' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    // The sheet's own day.
    const sheet = within(screen.getByTestId('john-form'));
    await fireEvent.press(sheet.getByRole('radio', { name: 'Monday' }));
    await fireEvent.press(screen.getByRole('radio', { name: JOHN_LIST_COPY.every[2] }));
    await fireEvent.changeText(screen.getByTestId('john-time'), '18:30');
    await fireEvent(screen.getByRole('switch', { name: JOHN_LIST_COPY.photo }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('save-john'));

    expect(saveJohn).toHaveBeenCalledWith(
      'h1',
      snapshot().rules,
      { ...NEW_JOHN, name: 'Hob', points: 5, dueDow: 1, everyWeeks: 2, dueTime: '18:30', needsPhoto: true },
      expect.any(Date),
    );
    await waitFor(() => expect(screen.queryByRole('header', { name: JOHN_LIST_COPY.add })).toBeNull());
    // The list is read again with the change.
    expect(loadJohnList).toHaveBeenCalledTimes(2);
  });

  it('keeps the sheet open, saying why, when the save is refused', async () => {
    (saveJohn as jest.Mock).mockRejectedValue(new Error('Only the house admins can do that.'));
    await open();
    await fireEvent.press(screen.getByTestId('add-john'));
    await fireEvent.changeText(screen.getByTestId('john-name'), 'Hob');
    await fireEvent.press(screen.getByTestId('save-john'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the house admins can do that.');
    expect(screen.getByRole('header', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
  });

  it("won't save a John without a name", async () => {
    await open();
    await fireEvent.press(screen.getByTestId('add-john'));
    expect(screen.getByTestId('save-john')).toBeDisabled();
  });

  it('edits a John, or takes it off the list', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.edit('Bins') }));
    expect(screen.getByTestId('john-name')).toHaveDisplayValue('Bins');
    expect(within(screen.getByTestId('john-form')).getByRole('radio', { name: 'Thursday' })).toBeChecked();
    await fireEvent.press(within(screen.getByTestId('john-form')).getByRole('button', { name: JOHN_LIST_COPY.remove }));
    expect(archiveJohn).toHaveBeenCalledWith('h1', 'j1', expect.any(Date));
  });

  it('offers a group as who shares a John', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({
      johns: [],
      groups: [{ id: 'g1', name: 'Upstairs bathroom', memberIds: ['priya', 'sam'] }],
    });
    await open();
    await fireEvent.press(screen.getByTestId('add-john'));
    const form = within(screen.getByTestId('john-form'));
    expect(form.getByText(JOHN_LIST_COPY.groupOnly)).toBeOnTheScreen();
    await fireEvent.changeText(form.getByTestId('john-name'), 'Bath');
    await fireEvent.press(form.getByRole('radio', { name: 'Upstairs bathroom' }));
    await fireEvent.press(form.getByTestId('save-john'));
    expect(saveJohn).toHaveBeenCalledWith('h1', snapshot().rules, { ...NEW_JOHN, name: 'Bath', groupId: 'g1' }, expect.any(Date));
  });
});

describe('the deal', () => {
  it('re-deals a week, once the house has started', async () => {
    await open();
    expect(screen.getByText(DEAL_COPY.againBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.again }));
    expect(dealThisWeek).toHaveBeenCalledWith('h1');
  });

  it("hands out the first week, and says when it can't", async () => {
    (loadHouse as jest.Mock).mockResolvedValue(snapshot({ house: { ...snapshot().house, everDealt: false } }));
    (dealThisWeek as jest.Mock).mockRejectedValue(new Error("Someone's already ticked a John this week, so it can't be re-dealt."));
    await open();
    expect(screen.getByText(DEAL_COPY.firstBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.first }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't be re-dealt/);
  });
});

it('is for a housemate who is not an admin to read, not change', async () => {
  await open('sam');
  expect(screen.getAllByTestId('john-def')).toHaveLength(2);
  expect(screen.queryByTestId('add-john')).toBeNull();
  expect(screen.queryByRole('button', { name: JOHN_LIST_COPY.edit('Bins') })).toBeNull();
  expect(screen.queryByTestId('deal-week')).toBeNull();
});

it("says when it can't read the list, and tries again", async () => {
  (loadJohnList as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  mockMembership.userId = 'priya';
  await renderPages({ 'house/johns': JohnListScreen }, '/house/johns');
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
  expect(await screen.findAllByTestId('john-def')).toHaveLength(2);
});
