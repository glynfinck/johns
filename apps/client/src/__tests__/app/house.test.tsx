import {
  DEAL_COPY,
  HOUSE_COPY,
  JOHN_LIST_COPY,
  ME_COPY,
  MEMBERS_COPY,
  NEW_JOHN,
  RULES_COPY,
  type JohnDef,
} from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Slot } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { signOut } from '@/api/auth';
import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { renameMe } from '@/api/profile';
import { archiveJohn, dealThisWeek, loadJohnList, removeMember, saveJohn, setRole, updateHouse } from '@/api/settings';
import HouseScreen from '@/app/(house)/house';
import { snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/profile', () => ({ renameMe: jest.fn() }));
jest.mock('@/api/settings', () => ({
  loadJohnList: jest.fn(),
  saveJohn: jest.fn(),
  archiveJohn: jest.fn(),
  updateHouse: jest.fn(),
  setRole: jest.fn(),
  removeMember: jest.fn(),
  dealThisWeek: jest.fn(),
}));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'Europe/London' }));

const mockMembership = { userId: 'priya', refresh: jest.fn() };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({
    session: { user: { id: mockMembership.userId } },
    house: { id: 'h1', name: 'Flat 3' },
    refresh: mockMembership.refresh,
  }),
}));

const BINS: JohnDef = { ...NEW_JOHN, id: 'j1', name: 'Bins', category: 'bins', points: 1, dueDow: 4, dueTime: '07:00' };
const BATH: JohnDef = { ...NEW_JOHN, id: 'j2', name: 'Bathroom', category: 'bathroom', points: 4, everyWeeks: 2, needsPhoto: true };

async function open(as: 'priya' | 'sam' = 'priya') {
  mockMembership.userId = as;
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      house: HouseScreen,
    },
    { initialUrl: '/house' },
  );
  await screen.findByText(HOUSE_COPY.johns);
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS, BATH], groups: [] });
  for (const move of [saveJohn, archiveJohn, updateHouse, setRole, removeMember, dealThisWeek, renameMe, signOut]) {
    (move as jest.Mock).mockResolvedValue(undefined);
  }
});

it('reads the house again each time House comes into view', async () => {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="house" />
            <Tabs.Screen name="week" />
          </Tabs>
        </QueryClientProvider>
      ),
      house: HouseScreen,
      week: () => <Text>Week screen</Text>,
    },
    { initialUrl: '/house' },
  );
  await screen.findByText(HOUSE_COPY.johns);
  expect(loadJohnList).toHaveBeenCalledTimes(1);

  // Someone else changes the list and the rules while you're on another tab.
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS], groups: [] });
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ rules: { ...snapshot().rules, stakeMinor: 2500 } }));
  await act(() => router.navigate('/week'));
  await act(() => router.navigate('/house'));
  await waitFor(() => expect(screen.getAllByTestId('john-def')).toHaveLength(1));
  await waitFor(() => expect(screen.getByTestId('house-stake')).toHaveDisplayValue('25'));
});

describe('the John list', () => {
  it('shows each John: how often, when, its effort, and whether it needs a photo', async () => {
    await open();
    expect(screen.getByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
    const [bins, bath] = screen.getAllByTestId('john-def');
    expect(bins).toHaveTextContent(/Bins.*Every week · due Thu 07:00.*1 pt/);
    expect(bath).toHaveTextContent(/Bathroom.*Every 2 weeks · due Sun 21:00.*4 pts/);
    expect(within(bath).getByLabelText(JOHN_LIST_COPY.needsPhoto)).toBeOnTheScreen();
    expect(screen.getByText(JOHN_LIST_COPY.perWeek(3))).toBeOnTheScreen();
  });

  it('starts an empty house off with the Johns that cause arguments', async () => {
    (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
    await open();
    expect(await screen.findByText(JOHN_LIST_COPY.empty)).toBeOnTheScreen();
    // Nothing to hand out yet.
    expect(screen.queryByTestId('deal-week')).toBeNull();
  });

  it('lets an admin add a John', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('add-john'));
    expect(screen.getByRole('header', { name: JOHN_LIST_COPY.add })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('john-name'), 'Hob');
    await fireEvent.press(screen.getByRole('radio', { name: 'Kitchen' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    // The sheet's own day, not the house's first day of the week behind it.
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

  it("keeps the sheet open, saying why, when the save is refused", async () => {
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

  it('lets an admin edit a John, or take it off the list', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_LIST_COPY.edit('Bins') }));
    expect(screen.getByTestId('john-name')).toHaveDisplayValue('Bins');
    expect(within(screen.getByTestId('john-form')).getByRole('radio', { name: 'Thursday' })).toBeChecked();
    await fireEvent.press(within(screen.getByTestId('john-form')).getByRole('button', { name: JOHN_LIST_COPY.remove }));
    expect(archiveJohn).toHaveBeenCalledWith('h1', 'j1', expect.any(Date));
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

describe('the house rules', () => {
  it('saves what an admin changed, the money in minor units', async () => {
    await open();
    expect(screen.getByTestId('house-stake')).toHaveDisplayValue('20');
    await fireEvent.changeText(screen.getByTestId('house-stake'), '25.50');
    await fireEvent.press(screen.getByRole('radio', { name: RULES_COPY.disputeHours(48) }));
    await fireEvent.press(screen.getByRole('radio', { name: '€ EUR' }));
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(updateHouse).toHaveBeenCalledWith('h1', {
      name: 'Flat 3',
      timezone: 'Europe/London',
      currency: 'EUR',
      weekStarts: 1,
      stakeMinor: 2550,
      lateForfeitMinor: 100,
      missedForfeitMinor: 300,
      disputeHours: 48,
      awayMakeup: 100,
    });
    expect(await screen.findByText(RULES_COPY.saved)).toBeOnTheScreen();
  });

  it('still says saved once the house is read again with the new rules', async () => {
    await open();
    (loadHouse as jest.Mock).mockResolvedValue(
      snapshot({ house: { ...snapshot().house, name: 'Flat 3B' }, rules: { ...snapshot().rules, stakeMinor: 2500 } }),
    );
    await fireEvent.changeText(screen.getByTestId('rules-name'), 'Flat 3B');
    await fireEvent.changeText(screen.getByTestId('house-stake'), '25');
    await fireEvent.press(screen.getByTestId('save-rules'));
    // The screen, and the form, start afresh from what the database now says...
    expect(await screen.findByRole('header', { name: 'Flat 3B' })).toBeOnTheScreen();
    expect(screen.getByTestId('house-stake')).toHaveDisplayValue('25');
    // ...and the note that the save landed survives that.
    expect(screen.getByText(RULES_COPY.saved)).toBeOnTheScreen();
  });

  it("names the amounts in the house's currency", async () => {
    await open();
    expect(screen.getByText(RULES_COPY.missed('£'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '$ CAD' }));
    expect(screen.getByText(RULES_COPY.missed('$'))).toBeOnTheScreen();
  });

  it("won't save an amount that isn't money", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId('house-late'), 'a quid');
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(await screen.findByRole('alert')).toHaveTextContent(RULES_COPY.badAmount);
    expect(updateHouse).not.toHaveBeenCalled();
  });

  it('explains what time away still owes, at each rate', async () => {
    await open();
    expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[100]}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Not at all' }));
    expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[0]}`)).toBeOnTheScreen();
  });
});

describe('a housemate who is not an admin', () => {
  it('reads the list and the rules, and changes neither', async () => {
    await open('sam');
    expect(screen.getAllByTestId('john-def')).toHaveLength(2);
    expect(screen.queryByTestId('add-john')).toBeNull();
    expect(screen.queryByRole('button', { name: JOHN_LIST_COPY.edit('Bins') })).toBeNull();
    expect(screen.queryByTestId('deal-week')).toBeNull();
    expect(screen.getByText(RULES_COPY.adminsOnly)).toBeOnTheScreen();
    expect(screen.queryByTestId('save-rules')).toBeNull();
    expect(screen.getByTestId('house-stake').props.editable).toBe(false);
    expect(screen.getByRole('radio', { name: 'Tuesday' })).toBeDisabled();
    // Nor anyone's role.
    expect(screen.queryByRole('button', { name: MEMBERS_COPY.makeAdmin })).toBeNull();
  });
});

describe('who lives here', () => {
  it('names everyone and their role, you included', async () => {
    await open();
    const [priya, sam] = screen.getAllByTestId('member');
    expect(priya).toHaveTextContent(/Priya \(you\).*Admin/);
    expect(sam).toHaveTextContent(/Sam.*Housemate/);
  });

  it('lets an admin make someone an admin', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.makeAdmin }));
    expect(setRole).toHaveBeenCalledWith('h1', 'sam', 'admin');
  });

  it('asks twice before removing someone', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.remove }));
    expect(removeMember).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.cancel }));
    await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.remove }));
    await fireEvent.press(screen.getByRole('button', { name: MEMBERS_COPY.removeName('Sam') }));
    expect(removeMember).toHaveBeenCalledWith('h1', 'sam');
  });
});

describe('you', () => {
  it('renames you', async () => {
    await open();
    expect(screen.getByTestId('save-name')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('my-name'), 'Priya P');
    await fireEvent.press(screen.getByTestId('save-name'));
    expect(renameMe).toHaveBeenCalledWith('priya', 'Priya P');
    expect(await screen.findByText(ME_COPY.saved)).toBeOnTheScreen();
  });

  it('still says your name saved once the house is read again with it', async () => {
    await open();
    const renamed = snapshot().members.map((m) => (m.userId === 'priya' ? { ...m, name: 'Priya P' } : m));
    (loadHouse as jest.Mock).mockResolvedValue(snapshot({ members: renamed }));
    await fireEvent.changeText(screen.getByTestId('my-name'), 'Priya P');
    await fireEvent.press(screen.getByTestId('save-name'));
    await waitFor(() => expect(screen.getAllByTestId('member')[0]).toHaveTextContent(/Priya P/));
    expect(screen.getByText(ME_COPY.saved)).toBeOnTheScreen();
    expect(screen.getByTestId('save-name')).toBeDisabled();
  });

  it('signs you out, and lets you try again when that fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await open();
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sign-out')).toBeEnabled();
  });

  it('asks twice before you leave, then lets the guard move you on', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.stay }));
    expect(removeMember).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByTestId('leave-house'));
    expect(removeMember).toHaveBeenCalledWith('h1', 'priya');
    expect(mockMembership.refresh).toHaveBeenCalled();
  });

  it("says why you can't leave", async () => {
    (removeMember as jest.Mock).mockRejectedValue(new Error('Make someone else an admin first. A house needs at least one.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: ME_COPY.leave }));
    await fireEvent.press(screen.getByTestId('leave-house'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Make someone else an admin first/);
    expect(mockMembership.refresh).not.toHaveBeenCalled();
  });
});
