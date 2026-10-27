import { FOCUS_SHELL_COPY, PAGE_TITLE, RULES_COPY, SECTION_LABEL, SETUP_COPY } from '@app/core';
import { Slot } from 'expo-router';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { updateHouse } from '@/api/settings';
import RulesScreen from '@/app/(house)/house/rules';
import { ToastProvider } from '@/components/toast';
import { snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/settings', () => ({ updateHouse: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/locale', () => ({ deviceTimeZone: () => 'Europe/London' }));

const mockMembership = { userId: 'priya' };
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: mockMembership.userId } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

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
  await renderPages({ 'house/_layout': HouseLayout, 'house/rules': RulesScreen }, '/house/rules');
  await untilRead();
}

async function edit() {
  await open();
  await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.edit }));
}

/** A setting in the form, opened, and one of its choices picked. */
async function pick(setting: string, choice: string) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${setting}, `) }));
  await fireEvent.press(screen.getByRole('radio', { name: choice }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (updateHouse as jest.Mock).mockResolvedValue(undefined);
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.rules })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});

it('reads the rules out in plain words, with who can change them under', async () => {
  await open('sam');
  const panel = within(screen.getByTestId('rules-panel'));
  expect(panel.getByText(SETUP_COPY.rules)).toBeOnTheScreen();
  expect(screen.getByTestId('rules-admins')).toHaveTextContent(SETUP_COPY.canChange('Priya', 1));
  const rules = panel.getAllByTestId('rule');
  [
    [SETUP_COPY.stake, '£20 a month'],
    [SETUP_COPY.late, '−£1'],
    [SETUP_COPY.missed, '−£3'],
    [SETUP_COPY.disputes, 'within 24 hours'],
    [SETUP_COPY.away, 'made up in full'],
    [SETUP_COPY.weekStarts, 'Monday, London time'],
  ].forEach(([label, value], i) => expect(rules[i]).toHaveTextContent(`${label}${value}`));
});

it('names every admin in full, however many there are', async () => {
  const members = snapshot().members;
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({
      members: [
        ...members,
        { ...members[1], userId: 'tom', name: 'Tom Reilly', role: 'admin' },
        { ...members[1], userId: 'megan', name: 'Megan Doyle', role: 'admin' },
      ],
    }),
  );
  await open('sam');
  // A sentence of its own, under the rules, so nothing in it is cut off.
  expect(screen.getByTestId('rules-admins')).toHaveTextContent(SETUP_COPY.canChange('Priya, Tom and Megan', 3));
});

it('never shows a housemate who is not an admin a form, locked or not', async () => {
  await open('sam');
  expect(screen.queryByRole('button', { name: SETUP_COPY.edit })).toBeNull();
  expect(screen.queryByTestId('house-stake')).toBeNull();
  expect(screen.queryByTestId('save-rules')).toBeNull();
});

describe('an admin', () => {
  it('is told they can change the rules, and opens the form with Edit', async () => {
    await open();
    expect(screen.getByText(SETUP_COPY.youCanChange)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.edit }));
    expect(screen.queryByTestId('rules-panel')).toBeNull();
    expect(within(screen.getByTestId('rules-money')).getByText(SETUP_COPY.money)).toBeOnTheScreen();
    expect(within(screen.getByTestId('rules-fairness')).getByText(SETUP_COPY.fairness)).toBeOnTheScreen();
    expect(within(screen.getByTestId('rules-house')).getByText(SETUP_COPY.house)).toBeOnTheScreen();
    expect(screen.getByTestId('house-stake')).toHaveDisplayValue('20');
  });

  it('keeps Save and Cancel pinned under the page, out of the part that scrolls', async () => {
    await edit();
    const foot = within(screen.getByTestId('rules-foot'));
    expect(foot.getByTestId('save-rules')).toBeOnTheScreen();
    expect(foot.getByRole('button', { name: SETUP_COPY.cancel })).toBeOnTheScreen();
    expect(within(screen.getByTestId('rules-editing')).queryByTestId('save-rules')).toBeNull();
  });

  it('can save only once something has changed', async () => {
    await edit();
    expect(screen.getByTestId('save-rules')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('house-stake'), '20.00');
    // The same money, written differently, is no change.
    expect(screen.getByTestId('save-rules')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('house-stake'), '21');
    expect(screen.getByTestId('save-rules')).toBeEnabled();
  });

  it('saves what changed, the money in minor units, then reads the new rules out', async () => {
    await edit();
    await fireEvent.changeText(screen.getByTestId('house-stake'), '25.50');
    await pick(SETUP_COPY.disputes, RULES_COPY.disputeHours(48));
    await pick(RULES_COPY.currency, '€ EUR');
    // The picked value shows on its row, briefly.
    expect(screen.getByRole('button', { name: `${SETUP_COPY.disputes}, ${SETUP_COPY.disputeShort(48)}` })).toBeOnTheScreen();
    (loadHouse as jest.Mock).mockResolvedValue(
      snapshot({ rules: { ...snapshot().rules, currency: 'EUR', stakeMinor: 2550, disputeHours: 48 } }),
    );
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
    expect(await screen.findByTestId('rules-panel')).toBeOnTheScreen();
    expect(within(screen.getByTestId('toast')).getByText(SETUP_COPY.saved)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByTestId('rule')[0]).toHaveTextContent(/€25\.50 a month/));
    expect(screen.getAllByTestId('rule')[3]).toHaveTextContent(/within 48 hours/);
  });

  it('puts the form away unsaved with Cancel', async () => {
    await edit();
    await fireEvent.changeText(screen.getByTestId('house-stake'), '99');
    await fireEvent.press(screen.getByRole('button', { name: SETUP_COPY.cancel }));
    expect(screen.getByTestId('rules-panel')).toBeOnTheScreen();
    expect(screen.getAllByTestId('rule')[0]).toHaveTextContent(/£20 a month/);
    expect(updateHouse).not.toHaveBeenCalled();
  });

  it("names the amounts in the house's currency", async () => {
    await edit();
    expect(screen.getByText(RULES_COPY.missed('£'))).toBeOnTheScreen();
    await pick(RULES_COPY.currency, '$ CAD');
    expect(screen.getByText(RULES_COPY.missed('$'))).toBeOnTheScreen();
  });

  it("says under the amount that isn't money what's wrong, and saves nothing", async () => {
    await edit();
    await fireEvent.changeText(screen.getByTestId('house-late'), 'a quid');
    await fireEvent.press(screen.getByTestId('save-rules'));
    const money = within(screen.getByTestId('rules-money'));
    expect(money.getByRole('alert')).toHaveTextContent(RULES_COPY.badAmount);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(updateHouse).not.toHaveBeenCalled();
    // Fixing it takes the problem away.
    await fireEvent.changeText(screen.getByTestId('house-late'), '1.50');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says under an amount below zero that it is wrong, and saves nothing', async () => {
    await edit();
    await fireEvent.changeText(screen.getByTestId('house-missed'), '-3');
    // Minus three pounds isn't three pounds: Save is there to say so.
    expect(screen.getByTestId('save-rules')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(within(screen.getByTestId('rules-money')).getByRole('alert')).toHaveTextContent(RULES_COPY.badAmount);
    expect(updateHouse).not.toHaveBeenCalled();
  });

  it('says under the name when it is empty', async () => {
    await edit();
    await fireEvent.changeText(screen.getByTestId('rules-name'), ' ');
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(within(screen.getByTestId('rules-house')).getByRole('alert')).toBeOnTheScreen();
    expect(updateHouse).not.toHaveBeenCalled();
  });

  it('shows the database refusing by Save, and keeps the form', async () => {
    (updateHouse as jest.Mock).mockRejectedValue(new Error('Only the house admins can do that.'));
    await edit();
    await fireEvent.changeText(screen.getByTestId('house-stake'), '30');
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(await within(screen.getByTestId('rules-foot')).findByRole('alert')).toHaveTextContent('Only the house admins can do that.');
    expect(screen.getByTestId('house-stake')).toHaveDisplayValue('30');
  });

  it('shows a time zone the database refuses under Time zone', async () => {
    (updateHouse as jest.Mock).mockRejectedValue(new Error("That time zone isn’t one we recognise."));
    await edit();
    await fireEvent.changeText(screen.getByTestId('rules-timezone'), 'Europe/Londn');
    await fireEvent.press(screen.getByTestId('save-rules'));
    expect(await within(screen.getByTestId('rules-house')).findByRole('alert')).toHaveTextContent("That time zone isn’t one we recognise.");
    expect(within(screen.getByTestId('rules-foot')).queryByRole('alert')).toBeNull();
    // Fixing it takes the problem away.
    await fireEvent.changeText(screen.getByTestId('rules-timezone'), 'Europe/London');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains what time away still owes, at each rate', async () => {
    await edit();
    expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[100]}`)).toBeOnTheScreen();
    await pick(SETUP_COPY.away, 'Not at all');
    expect(screen.getByText(`${RULES_COPY.awayNote} ${RULES_COPY.makeupHint[0]}`)).toBeOnTheScreen();
  });
});
