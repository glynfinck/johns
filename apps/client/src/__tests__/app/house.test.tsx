import {
  BIN_NIGHT,
  buildStake,
  FOCUS_SHELL_COPY,
  HOUSE_PAGE_COPY,
  type HistoryRow,
  INVITE_COPY,
  PASS_COPY,
  stakeRules,
} from '@app/core';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Platform, Share, Text, useWindowDimensions } from 'react-native';

import { loadAway } from '@/api/away';
import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { confirmPayment, loadStake, type StakeRead } from '@/api/stake';
import { loadTable } from '@/api/table';
import HouseScreen from '@/app/(house)/house';
import { assignment, snapshot } from '@/testing/house';
import { renderPages, untilRead } from '@/testing/pages';

jest.mock('@/api/away', () => ({ loadAway: jest.fn() }));
jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/stake', () => ({ loadStake: jest.fn(), confirmPayment: jest.fn() }));
jest.mock('@/api/table', () => ({ loadTable: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

// The lower half of the page is the lower House track's, with its own tests:
// here it only has to be mounted, in its order, under the money and the Table.
const standIn = (name: string) => {
  const { Text: RNText } = jest.requireActual<typeof import('react-native')>('react-native');
  function StandIn() {
    return <RNText testID="lower">{name}</RNText>;
  }
  return StandIn;
};
jest.mock('@/components/house-page/wall-section', () => ({ WallSection: standIn('the Wall') }));
jest.mock('@/components/house-page/setup-section', () => ({ SetupSection: standIn('House setup') }));
jest.mock('@/components/house-page/you-section', () => ({ YouSection: standIn('You') }));
jest.mock('@/components/house-page/leave-section', () => ({ LeaveSection: standIn('Leaving') }));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' }, refresh: jest.fn() }),
}));

const entry = (id: number, userId: string, kind: string, amountMinor: number, month: string): HistoryRow => ({
  id,
  user_id: userId,
  kind,
  amount_minor: amountMinor,
  month,
  counterparty: null,
  created_at: '2026-10-10T12:00:00Z',
  john: null,
});

/** The Stake as House reads it: what buildStake makes of the ledger, and the ledger itself. */
function stakeRead(ledger: HistoryRow[], closedMonths: string[] = []): StakeRead {
  const built = buildStake({ ledger, closedMonths, memberIds: ['priya', 'sam'], stakeMinor: 2000, month: '2026-10' });
  return { ...built, ledger, closedMonths };
}

/** September closed with Sam £4 down, so Sam owes you £4; this month Sam is £3 down too. */
const OWED_TO_YOU = stakeRead(
  [
    entry(3, 'sam', 'forfeit', -300, '2026-10'),
    entry(2, 'sam', 'forfeit', -400, '2026-09'),
    entry(1, 'priya', 'share', 400, '2026-09'),
  ],
  ['2026-09'],
);

/** House, with the pages it pushes standing in as their names. */
async function open() {
  await renderPages(
    {
      'house/index': HouseScreen,
      'house/stake': () => <Text>Stake page</Text>,
      'house/wall': () => <Text>Wall page</Text>,
      'house/people/[userId]': () => <Text>Person page</Text>,
    },
    '/house',
  );
  await untilRead();
  // The Stake, the Table and time away are read after the house itself.
  await waitFor(() => expect(screen.queryByLabelText(HOUSE_PAGE_COPY.readingStake)).toBeNull());
  await waitFor(() => expect(screen.queryByLabelText(HOUSE_PAGE_COPY.readingTable)).toBeNull());
}

beforeEach(() => {
  jest.clearAllMocks();
  // The narrowest phone unless a test says otherwise.
  (useWindowDimensions as jest.Mock).mockReturnValue({ width: 360, height: 780, scale: 2, fontScale: 1 });
  const members = snapshot().members.map((m) => (m.userId === 'sam' ? { ...m, streak: 5, swapTokens: 1 } : m));
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({
      members,
      assignments: [
        assignment({ id: 'a1', done_at: new Date(Date.now() - 3_600_000).toISOString(), points: 3 }),
        assignment({ id: 'a2', user_id: 'sam', points: 5 }),
      ],
    }),
  );
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadTable as jest.Mock).mockResolvedValue({
    month: '2026-10',
    monthTable: [
      { userId: 'sam', points: 12, done: 4, late: 1, missed: 0, rank: 1 },
      { userId: 'priya', points: 9, done: 3, late: 0, missed: 0, rank: 2 },
    ],
    balances: [
      { userId: 'priya', balance: -3, weeksToEven: 2 },
      { userId: 'sam', balance: 3, weeksToEven: 0 },
    ],
  });
  (loadStake as jest.Mock).mockResolvedValue(OWED_TO_YOU);
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-26', periods: [] });
  (confirmPayment as jest.Mock).mockResolvedValue(undefined);
});

// Undoes the web's Platform.OS and Share's stand-in.
afterEach(() => jest.restoreAllMocks());

it('names the house in the title bar, with how many live there and the stake first on the page', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
  // Not a second line in the bar: every tab's bar is the same height.
  expect(bar.queryByText(HOUSE_PAGE_COPY.sub(2, '£20'))).toBeNull();
  expect(within(screen.getByTestId('top-line')).getByText(HOUSE_PAGE_COPY.sub(2, '£20'))).toBeOnTheScreen();
  // House is a tab's top: there's no way back from it.
  expect(bar.queryByRole('button', { name: FOCUS_SHELL_COPY.back })).toBeNull();
});

it('keeps the lower sections under the money and the Table, in their order', async () => {
  await open();
  expect(screen.getAllByTestId('lower').map((node) => node.props.children)).toEqual([
    'the Wall',
    'House setup',
    'You',
    'Leaving',
  ]);
});

it('shows where the house stands on the House Pass, with the way to its page', async () => {
  await open();
  const row = screen.getByTestId('to-pass');
  expect(within(row).getByText(PASS_COPY.title)).toBeOnTheScreen();
  expect(within(row).getByText(PASS_COPY.founding)).toBeOnTheScreen();
  // The Pass isn't enforced yet, so every house keeps the money and the Table.
  expect(screen.getByTestId('month-card')).toBeOnTheScreen();
  expect(screen.queryByTestId('stake-locked')).toBeNull();
});

describe('the month card', () => {
  it('leads with your month so far, the figure green while you are up', async () => {
    await open();
    const lead = screen.getByTestId('month-lead');
    expect(lead).toHaveTextContent(`${HOUSE_PAGE_COPY.up} £3`);
    expect(within(lead).getByText('£3')).toHaveStyle({ color: BIN_NIGHT.light.good });
    expect(screen.getByText(`${HOUSE_PAGE_COPY.nothingForfeited} · ${HOUSE_PAGE_COPY.sharedOut('1 Nov')}`)).toBeOnTheScreen();
  });

  it('says what you are down in plain ink, with what it cost you', async () => {
    (loadStake as jest.Mock).mockResolvedValue(stakeRead([entry(1, 'priya', 'forfeit', -300, '2026-10')]));
    await open();
    const lead = screen.getByTestId('month-lead');
    expect(lead).toHaveTextContent(`${HOUSE_PAGE_COPY.down} £3`);
    // Green is for what you're up only: money lost is said in words, not in colour.
    expect(within(lead).getByText('£3')).not.toHaveStyle({ color: BIN_NIGHT.light.good });
    expect(screen.getByText(`${HOUSE_PAGE_COPY.forfeited('£3')} · ${HOUSE_PAGE_COPY.sharedOut('1 Nov')}`)).toBeOnTheScreen();
  });

  it('says when nothing has been forfeited at all', async () => {
    (loadStake as jest.Mock).mockResolvedValue(stakeRead([]));
    await open();
    expect(screen.getByTestId('month-lead')).toHaveTextContent(HOUSE_PAGE_COPY.nothingYet);
    expect(screen.getByText(HOUSE_PAGE_COPY.sharedOutAlone('1 Nov'))).toBeOnTheScreen();
  });

  it('marks what is owed to you received, from the month it is from', async () => {
    await open();
    const transfer = screen.getByTestId('transfer');
    expect(transfer).toHaveTextContent(
      new RegExp(`${HOUSE_PAGE_COPY.owesYou('Sam', '£4', 'September')}${HOUSE_PAGE_COPY.paidHowYouLike}`),
    );
    // It shows the amount beside the row, and names who paid to a screen reader.
    expect(within(transfer).getByText(HOUSE_PAGE_COPY.markReceived('£4'))).toBeOnTheScreen();
    await fireEvent.press(within(transfer).getByRole('button', { name: HOUSE_PAGE_COPY.markReceivedFrom('Sam', '£4') }));
    expect(confirmPayment).toHaveBeenCalledWith('h1', 'sam', 400);
  });

  it('says why marking it received was refused', async () => {
    (confirmPayment as jest.Mock).mockRejectedValue(new Error('Only the one who was paid can mark it received.'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: HOUSE_PAGE_COPY.markReceivedFrom('Sam', '£4') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the one who was paid can mark it received.');
  });

  it('what you owe waits on them, with nothing to press', async () => {
    (loadStake as jest.Mock).mockResolvedValue(
      stakeRead([entry(2, 'priya', 'forfeit', -400, '2026-09'), entry(1, 'sam', 'share', 400, '2026-09')], ['2026-09']),
    );
    await open();
    const transfer = screen.getByTestId('transfer');
    expect(transfer).toHaveTextContent(
      new RegExp(`${HOUSE_PAGE_COPY.youOwe('Sam', '£4', 'September')}${HOUSE_PAGE_COPY.waitingFor('Sam')}`),
    );
    expect(within(transfer).queryByRole('button')).toBeNull();
  });

  it('offers no button for what someone who has left owes, and makes the next one amber', async () => {
    (loadStake as jest.Mock).mockResolvedValue(
      stakeRead(
        [
          entry(3, 'ben', 'forfeit', -200, '2026-09'),
          entry(2, 'sam', 'forfeit', -400, '2026-09'),
          entry(1, 'priya', 'share', 600, '2026-09'),
        ],
        ['2026-09'],
      ),
    );
    await open();
    const transfers = screen.getAllByTestId('transfer');
    const gone = transfers.find((t) => within(t).queryByText(HOUSE_PAGE_COPY.gone))!;
    expect(gone).toHaveTextContent(new RegExp(HOUSE_PAGE_COPY.owesYou(FOCUS_SHELL_COPY.formerHousemate, '£2')));
    expect(within(gone).queryByRole('button')).toBeNull();
    // The one amber button is Sam's, the only one the database would take.
    expect(screen.getAllByRole('button', { name: /^Mark/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: HOUSE_PAGE_COPY.markReceivedFrom('Sam', '£4') })).toHaveStyle({
      backgroundColor: BIN_NIGHT.light.hivis,
    });
  });

  it('leads to Stake history', async () => {
    await open();
    await fireEvent.press(within(screen.getByTestId('to-stake')).getByRole('link'));
    expect(screen).toHavePathname('/house/stake');
    expect(screen.getByText('Stake page')).toBeOnTheScreen();
  });

  it("says when it can't read the Stake, and tries again", async () => {
    (loadStake as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await open();
    expect(await screen.findByRole('alert')).toHaveTextContent(HOUSE_PAGE_COPY.stakeUnreadable);
    await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
    expect(await screen.findByTestId('month-lead')).toHaveTextContent(new RegExp(HOUSE_PAGE_COPY.up));
  });
});

describe('the Table', () => {
  it('ranks the week, you first with what you hold and the month money', async () => {
    await open();
    const standings = screen.getAllByTestId('standing');
    expect(standings).toHaveLength(2);
    expect(standings[0]).toHaveTextContent(new RegExp(`${HOUSE_PAGE_COPY.you}3 pts · ${HOUSE_PAGE_COPY.streak(3)}\\+£3`));
    // Sam's late John in the month comes before his streak, and leaves no room for it.
    expect(standings[1]).toHaveTextContent(new RegExp(`Sam0 pts ·${HOUSE_PAGE_COPY.lateMissed(1, 0)} in Oct−£3`));
    expect(within(standings[1]).getByText(HOUSE_PAGE_COPY.lateMissed(1, 0))).toHaveStyle({ color: BIN_NIGHT.light.hazard });
  });

  it('sets your own late and missed and money lost in ink on your tinted row', async () => {
    (loadStake as jest.Mock).mockResolvedValue(stakeRead([entry(1, 'priya', 'forfeit', -100, '2026-10')]));
    (loadTable as jest.Mock).mockResolvedValue({
      month: '2026-10',
      monthTable: [
        { userId: 'priya', points: 9, done: 3, late: 1, missed: 0, rank: 1 },
        { userId: 'sam', points: 2, done: 1, late: 0, missed: 0, rank: 2 },
      ],
      balances: [],
    });
    await open();
    const you = screen.getAllByTestId('standing')[0];
    expect(you).toHaveStyle({ backgroundColor: BIN_NIGHT.light.secondary });
    // Hazard words need the card colour behind them: on the tint they're ink, beside their mark.
    expect(within(you).getByText(HOUSE_PAGE_COPY.lateMissed(1, 0))).not.toHaveStyle({ color: BIN_NIGHT.light.hazard });
    expect(within(you).getByText('−£1')).toHaveStyle({ color: BIN_NIGHT.light.foreground });
    expect(within(you).getByLabelText(HOUSE_PAGE_COPY.losing('−£1'))).toBeOnTheScreen();
  });

  it('says more about each housemate where the row is wider', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
    await open();
    expect(screen.getAllByTestId('standing')[1]).toHaveTextContent(
      new RegExp(`Sam0 pts ·${HOUSE_PAGE_COPY.lateMissed(1, 0)} in Oct · ${HOUSE_PAGE_COPY.streak(5)}−£3`),
    );
  });

  it('switches to the month, and back', async () => {
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'October' }));
    const month = screen.getAllByTestId('standing');
    expect(month[0]).toHaveTextContent(new RegExp(`Sam12 pts ·${HOUSE_PAGE_COPY.lateMissed(1, 0)} in Oct−£3`));
    expect(month[1]).toHaveTextContent(new RegExp(`${HOUSE_PAGE_COPY.you}9 pts`));
    await fireEvent.press(screen.getByRole('radio', { name: HOUSE_PAGE_COPY.week }));
    expect(screen.getAllByTestId('standing')[0]).toHaveTextContent(/3 pts/);
  });

  it("opens a housemate's page", async () => {
    await open();
    await fireEvent.press(within(screen.getAllByTestId('standing')[1]).getByRole('link'));
    expect(screen).toHavePathname('/house/people/sam');
    expect(screen.getByText('Person page')).toBeOnTheScreen();
  });

  it("says when it can't read the month's Table", async () => {
    (loadTable as jest.Mock).mockRejectedValue(new Error('offline'));
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'October' }));
    expect(screen.getByRole('alert')).toHaveTextContent(HOUSE_PAGE_COPY.tableUnreadable);
  });

  it('shares the join code and the link to it', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await open();
    await fireEvent.press(screen.getByTestId('invite'));
    expect(screen.getByTestId('invite-code')).toHaveTextContent('AB3DEF7H');
    expect(screen.getByTestId('invite-url')).toHaveTextContent(/\/join\/AB3DEF7H$/);
    await fireEvent.press(screen.getByTestId('share-invite'));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: INVITE_COPY.shareTitle('Flat 3') }));
  });

  it('leaves copying to the share sheet on a phone, which has no clipboard of its own here', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('invite'));
    expect(screen.getByTestId('share-invite')).toBeOnTheScreen();
    expect(screen.queryByTestId('copy-link')).toBeNull();
  });

  it('copies the link on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await open();
    await fireEvent.press(screen.getByTestId('invite'));
    await fireEvent.press(screen.getByTestId('copy-link'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/join/AB3DEF7H'));
    expect(await screen.findByText(INVITE_COPY.copied)).toBeOnTheScreen();
  });

  it('copies the link from Share invite in a browser with no share sheet', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const share = jest.spyOn(Share, 'share');
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });
    await open();
    await fireEvent.press(screen.getByTestId('invite'));
    await fireEvent.press(screen.getByTestId('share-invite'));
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/join/AB3DEF7H'));
    expect(await screen.findByText(INVITE_COPY.copied)).toBeOnTheScreen();
  });

  it('says how points and the stake work, in the house’s own numbers', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('how-it-works'));
    for (const rule of stakeRules(snapshot().rules, 100)) expect(screen.getByText(rule.body)).toBeOnTheScreen();
  });
});

it('reads the house again each time House comes into view', async () => {
  await renderPages(
    {
      '(tabs)/_layout': () => (
        <Tabs screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="house" />
          <Tabs.Screen name="week" />
        </Tabs>
      ),
      '(tabs)/house': HouseScreen,
      '(tabs)/week': () => <Text>Week screen</Text>,
    },
    '/house',
  );
  await untilRead();
  expect(screen.getByText(HOUSE_PAGE_COPY.sub(2, '£20'))).toBeOnTheScreen();
  // Someone else changes the stake while you're on another tab.
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ rules: { ...snapshot().rules, stakeMinor: 2500 } }));
  await act(() => router.navigate('/week'));
  await act(() => router.navigate('/house'));
  await waitFor(() => expect(screen.getByText(HOUSE_PAGE_COPY.sub(2, '£25'))).toBeOnTheScreen());
});

it("says when it can't read the house, and tries again", async () => {
  (loadHouse as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await renderPages({ 'house/index': HouseScreen }, '/house');
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
  expect(await screen.findByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
});
