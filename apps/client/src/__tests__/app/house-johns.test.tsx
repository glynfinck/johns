import { DEAL_COPY, FOCUS_SHELL_COPY, JOHN_LIST_COPY, NEW_JOHN, NEXT_UP_COPY, PAGE_TITLE, SECTION_LABEL, SETUP_COPY } from '@app/core';
import { router, Slot } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { archiveJohn, dealThisWeek, loadJohnList, saveJohn } from '@/api/settings';
import JohnListScreen from '@/app/(house)/house/johns';
import { ToastProvider } from '@/components/toast';
import { assignment, snapshot } from '@/testing/house';
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

const UPSTAIRS = { id: 'g1', name: 'Upstairs bathroom', memberIds: ['priya', 'sam'] };

/** The house's toasts, as its layout mounts them. */
function HouseLayout() {
  return (
    <ToastProvider>
      <Slot />
    </ToastProvider>
  );
}

async function open(as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  await renderPages({ 'house/_layout': HouseLayout, 'house/johns': JohnListScreen }, '/house/johns');
  await untilRead();
}

/** A setting in the John sheet, opened: its row is named "Kind, Kitchen". */
async function pick(form: ReturnType<typeof within>, setting: string, choice: string) {
  await fireEvent.press(form.getByRole('button', { name: new RegExp(`^${setting}, `) }));
  await fireEvent.press(form.getByRole('radio', { name: choice }));
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

it('groups the Johns by kind, each with how often, when, the photo and its points', async () => {
  await open();
  // Kinds in the house's order, each counted.
  expect(within(screen.getByTestId('kind-bathroom')).getByText(SETUP_COPY.kind('Bathroom', 1))).toBeOnTheScreen();
  expect(within(screen.getByTestId('kind-bins')).getByText(SETUP_COPY.kind('Bins & recycling', 1))).toBeOnTheScreen();
  const [bath, bins] = screen.getAllByTestId('john-def');
  expect(bath).toHaveTextContent(/Bathroom.*Every 2 weeks · Sun 21:00 · photo.*4 pts/);
  expect(bins).toHaveTextContent(/Bins.*Every week · Thu 07:00.*1 pt/);
  expect(screen.getByText(JOHN_LIST_COPY.perWeek(3))).toBeOnTheScreen();
});

it('says which group shares a John', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [{ ...BATH, groupId: 'g1' }], groups: [UPSTAIRS] });
  await open();
  expect(screen.getByTestId('john-def')).toHaveTextContent(/photo · Upstairs bathroom/);
});

it('starts an empty house off with the Johns that cause arguments', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
  await open();
  expect(screen.getByText(SETUP_COPY.noJohns)).toBeOnTheScreen();
  expect(screen.getByText(SETUP_COPY.noJohnsBody)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
  // Nothing to hand out yet.
  expect(screen.queryByTestId('deal-week')).toBeNull();
});

it('tells a housemate who will add the Johns to an empty list, not how to', async () => {
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
  await open('sam');
  expect(screen.getByText(SETUP_COPY.noJohns)).toBeOnTheScreen();
  expect(screen.getByText(SETUP_COPY.johnsComing('Priya'))).toBeOnTheScreen();
  expect(screen.queryByText(SETUP_COPY.noJohnsBody)).toBeNull();
  expect(screen.queryByRole('button', { name: JOHN_LIST_COPY.add })).toBeNull();
});

it('reads the list again on the way back to it', async () => {
  mockMembership.userId = 'priya';
  await renderPages(
    { 'house/_layout': HouseLayout, 'house/johns': JohnListScreen, 'house/index': () => <Text>House</Text> },
    '/house/johns',
  );
  await screen.findAllByTestId('john-def');
  expect(loadJohnList).toHaveBeenCalledTimes(1);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS], groups: [] });
  await act(() => router.navigate('/house'));
  await act(() => router.navigate('/house/johns'));
  await waitFor(() => expect(screen.getAllByTestId('john-def')).toHaveLength(1));
});

describe('an admin', () => {
  it('adds a John from the foot of the list', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    expect(screen.getByRole('header', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
    const form = within(screen.getByTestId('john-form'));
    await fireEvent.changeText(form.getByTestId('john-name'), 'Shower');
    await pick(form, JOHN_LIST_COPY.kind, 'Bathroom');
    await pick(form, JOHN_LIST_COPY.effort, '5 pts');
    await pick(form, JOHN_LIST_COPY.often, JOHN_LIST_COPY.every[2]);
    await pick(form, JOHN_LIST_COPY.due, 'Monday');
    // A picked setting closes again and says what it's set to.
    expect(form.getByRole('button', { name: `${JOHN_LIST_COPY.due}, Monday` })).toBeCollapsed();
    expect(form.queryByRole('radio')).toBeNull();
    await fireEvent.changeText(form.getByTestId('john-time'), '18:30');
    const photo = form.getByRole('checkbox', { name: `${JOHN_LIST_COPY.photo}, ${SETUP_COPY.photoMeta}` });
    expect(photo).not.toBeChecked();
    await fireEvent.press(photo);
    expect(photo).toBeChecked();
    await fireEvent.press(form.getByTestId('save-john'));

    expect(saveJohn).toHaveBeenCalledWith(
      'h1',
      snapshot().rules,
      {
        ...NEW_JOHN,
        name: 'Shower',
        category: 'bathroom',
        points: 5,
        dueDow: 1,
        everyWeeks: 2,
        dueTime: '18:30',
        needsPhoto: true,
      },
      expect.any(Date),
    );
    await waitFor(() => expect(screen.queryByRole('header', { name: JOHN_LIST_COPY.add })).toBeNull());
    // The list is read again with the change.
    expect(loadJohnList).toHaveBeenCalledTimes(2);
  });

  it('adds the first John from the empty list', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    expect(screen.getByTestId('john-form')).toBeOnTheScreen();
  });

  it('keeps the sheet open, saying why, when the save is refused', async () => {
    (saveJohn as jest.Mock).mockRejectedValue(new Error('Only the house admins can do that.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    await fireEvent.changeText(screen.getByTestId('john-name'), 'Hob');
    await fireEvent.press(screen.getByTestId('save-john'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the house admins can do that.');
    expect(screen.getByRole('header', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
  });

  it("won't save a John without a name", async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    expect(screen.getByTestId('save-john')).toBeDisabled();
  });

  it('opens a John to edit it, or to take it off the list', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: /^Edit Bins, Every week · Thu 07:00, 1 pt$/ }));
    const form = within(screen.getByTestId('john-form'));
    expect(form.getByTestId('john-name')).toHaveDisplayValue('Bins');
    expect(form.getByRole('button', { name: `${JOHN_LIST_COPY.kind}, Bins & recycling` })).toBeOnTheScreen();
    expect(form.getByRole('button', { name: `${JOHN_LIST_COPY.due}, Thursday` })).toBeOnTheScreen();
    // An open setting ticks what it's set to.
    await fireEvent.press(form.getByRole('button', { name: `${JOHN_LIST_COPY.due}, Thursday` }));
    expect(form.getByRole('radio', { name: 'Thursday' })).toBeChecked();
    await fireEvent.press(form.getByRole('button', { name: JOHN_LIST_COPY.remove }));
    expect(archiveJohn).toHaveBeenCalledWith('h1', 'j1', expect.any(Date));
  });

  it('offers a group as who shares a John, and says what that means once one is picked', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [UPSTAIRS] });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    const form = within(screen.getByTestId('john-form'));
    // Everyone shares it to begin with, which needs no explaining.
    expect(form.queryByTestId('sharing-note')).toBeNull();
    await fireEvent.changeText(form.getByTestId('john-name'), 'Bath');
    await pick(form, JOHN_LIST_COPY.sharedBy, 'Upstairs bathroom');
    expect(form.getByTestId('sharing-note')).toHaveTextContent(JOHN_LIST_COPY.groupOnly);
    await fireEvent.press(form.getByTestId('save-john'));
    expect(saveJohn).toHaveBeenCalledWith('h1', snapshot().rules, { ...NEW_JOHN, name: 'Bath', groupId: 'g1' }, expect.any(Date));
  });

  it('says how to share a John with fewer when the house has no groups', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    expect(within(screen.getByTestId('john-form')).getByTestId('sharing-note')).toHaveTextContent(JOHN_LIST_COPY.noGroups);
  });

  it('shows the kinds by name alone, with no lid colours to pick from', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.add }));
    const form = within(screen.getByTestId('john-form'));
    await fireEvent.press(form.getByRole('button', { name: new RegExp(`^${JOHN_LIST_COPY.kind}, `) }));
    expect(form.getAllByRole('radio')).toHaveLength(6);
    expect(form.queryAllByTestId('lid-dot', { includeHiddenElements: true })).toHaveLength(0);
  });
});

describe('the deal', () => {
  /** This week dealt, and nothing in it ticked yet. */
  const unticked = () => snapshot({ assignments: [assignment(), assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath' })] });

  it('re-deals a week nobody has ticked in, once asked whether to', async () => {
    (loadHouse as jest.Mock).mockResolvedValue(unticked());
    await open();
    const deal = within(screen.getByTestId('deal'));
    expect(deal.getByText(DEAL_COPY.againBody)).toBeOnTheScreen();
    await fireEvent.press(deal.getByRole('button', { name: DEAL_COPY.again }));
    expect(dealThisWeek).not.toHaveBeenCalled();
    const confirm = within(screen.getByTestId('redeal-confirm'));
    expect(confirm.getByRole('header', { name: SETUP_COPY.redealTitle })).toBeOnTheScreen();
    await fireEvent.press(confirm.getByTestId('confirm'));
    expect(dealThisWeek).toHaveBeenCalledWith('h1');
    expect(await within(screen.getByTestId('toast')).findByText(SETUP_COPY.redealt)).toBeOnTheScreen();
  });

  it('keeps the confirm open, saying why, when the re-deal is refused', async () => {
    (loadHouse as jest.Mock).mockResolvedValue(unticked());
    (dealThisWeek as jest.Mock).mockRejectedValue(new Error("Someone’s already ticked a John this week, so it can’t be re-dealt."));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: DEAL_COPY.again }));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(await within(screen.getByTestId('redeal-confirm')).findByRole('alert')).toHaveTextContent(/can’t be re-dealt/);
  });

  it('offers no re-deal once something this week is ticked', async () => {
    await open();
    expect(screen.queryByTestId('deal')).toBeNull();
    expect(screen.queryByRole('button', { name: DEAL_COPY.again })).toBeNull();
  });

  it("hands out the first week, and says when it can't", async () => {
    (loadHouse as jest.Mock).mockResolvedValue(snapshot({ house: { ...snapshot().house, everDealt: false } }));
    (dealThisWeek as jest.Mock).mockRejectedValue(new Error("Someone’s already ticked a John this week, so it can’t be re-dealt."));
    await open();
    expect(screen.getByText(DEAL_COPY.firstBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: NEXT_UP_COPY.dealWeek1 }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/can’t be re-dealt/);
  });
});

describe('a housemate who is not an admin', () => {
  it('reads the list, but has nothing to change', async () => {
    await open('sam');
    expect(screen.getAllByTestId('john-def')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: JOHN_LIST_COPY.add })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByTestId('deal')).toBeNull();
  });

  it('opens a John to read what it is, with nothing to edit', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [{ ...BATH, groupId: 'g1' }], groups: [UPSTAIRS] });
    await open('sam');
    await fireEvent.press(screen.getByRole('button', { name: /^Bathroom/ }));
    const sheet = within(screen.getByTestId('john-facts'));
    expect(sheet.getByRole('header', { name: 'Bathroom' })).toBeOnTheScreen();
    const facts = sheet.getAllByTestId('john-fact');
    [
      [SETUP_COPY.kindLabel, 'Bathroom'],
      [JOHN_LIST_COPY.sharedBy, 'Upstairs bathroom'],
      [JOHN_LIST_COPY.effort, '4 pts'],
      [JOHN_LIST_COPY.often, 'Every 2 weeks'],
      [JOHN_LIST_COPY.due, 'Sunday 21:00'],
      [SETUP_COPY.photoLabel, SETUP_COPY.photoNeeded],
    ].forEach(([label, value], i) => expect(facts[i]).toHaveTextContent(`${label}${value}`));
    expect(screen.queryByTestId('john-form')).toBeNull();
    expect(screen.queryByTestId('save-john')).toBeNull();
  });
});

it("says when it can't read the list, and tries again", async () => {
  (loadJohnList as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  mockMembership.userId = 'priya';
  await renderPages({ 'house/_layout': HouseLayout, 'house/johns': JohnListScreen }, '/house/johns');
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
  expect(await screen.findAllByTestId('john-def')).toHaveLength(2);
});
