import {
  BIN_NIGHT,
  buildStake,
  DISPUTE_COPY,
  FOCUS_SHELL_COPY,
  JOHN_COPY,
  JOHN_SHEET_COPY,
  monthOf,
  NEXT_UP_COPY,
  SWAP_COPY,
  type DisputeRow,
} from '@app/core';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Pressable, ScrollView, Text } from 'react-native';

import type { Housemate, HouseSnapshot } from '@/api/board';
import { loadHouse } from '@/api/board';
import { castVote } from '@/api/disputes';
import { markDone, spendImmunity, spendSwap, undoDone } from '@/api/johns';
import { pickPhoto } from '@/api/photos';
import { signPhoto } from '@/api/wall';
import { ToastProvider } from '@/components/toast';
import { houseKey, stakeKey } from '@/hooks/keys';
import { assignment, snapshot } from '@/testing/house';
import { measureAt, measureNowhere } from '@/testing/layout';
import { testQueryClient } from '@/testing/query';

import { JohnSheetProvider, useJohnSheet, type JohnSheetFocus } from '.';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn(() => Promise.resolve(false)) }));
jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn(), spendSwap: jest.fn() }));
jest.mock('@/api/disputes', () => ({ castVote: jest.fn(), raiseDispute: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/wall', () => ({ signPhoto: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

const MEGAN: Housemate = { userId: 'megan', name: 'Megan', role: 'member', streak: 0, immunityTokens: 0, swapTokens: 0 };

/** Where the sheet is opened from, and what for. */
const OPENERS: [string, JohnSheetFocus?][] = [['a1'], ['a3'], ['a4'], ['gone'], ['a1', 'swap'], ['a1', 'cant'], ['a4', 'dispute']];

/** Somewhere in the house: buttons that open the sheet on a John, and put it away. */
function Opener() {
  const sheet = useJohnSheet();
  return (
    <>
      {OPENERS.map(([id, focus]) => (
        <Pressable key={`${id}${focus ?? ''}`} accessibilityRole="button" onPress={() => sheet.open(id, focus)}>
          <Text>{focus ? `Open ${id} at ${focus}` : `Open ${id}`}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={sheet.close}>
        <Text>Put it away</Text>
      </Pressable>
    </>
  );
}

async function show(house?: HouseSnapshot): Promise<QueryClient> {
  if (house) (loadHouse as jest.Mock).mockResolvedValue(house);
  const client = testQueryClient();
  await render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <JohnSheetProvider houseId="h1" userId="priya">
          <Opener />
        </JohnSheetProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(loadHouse).toHaveBeenCalled());
  return client;
}

/** Open the sheet on a John and wait for it. */
async function openOn(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name }));
  return screen.findByTestId('john-sheet-body');
}

/** The house with these Johns this week, and these people. */
function house(assignments: HouseSnapshot['assignments'], members = snapshot().members, disputes: DisputeRow[] = []) {
  return snapshot({ assignments, members, disputes });
}

/** Priya, with what she holds changed. */
function priyaWith(tokens: Partial<Housemate>): Housemate[] {
  const [priya, ...rest] = snapshot().members;
  return [{ ...priya, ...tokens }, ...rest];
}

const binsOut = (overrides: Parameters<typeof assignment>[0] = {}) => assignment(overrides);
const samsBath = (overrides: Parameters<typeof assignment>[0] = {}) =>
  assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath', category: 'bathroom', points: 4, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(house([binsOut(), samsBath({ done_at: at(-1) })]));
  (markDone as jest.Mock).mockResolvedValue(undefined);
  (undoDone as jest.Mock).mockResolvedValue(undefined);
  (spendImmunity as jest.Mock).mockResolvedValue(undefined);
  (spendSwap as jest.Mock).mockResolvedValue(undefined);
  (castVote as jest.Mock).mockResolvedValue(undefined);
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  (signPhoto as jest.Mock).mockResolvedValue('https://photos.test/a3.jpg');
});

describe('the header', () => {
  it('says what the John is, its name, when it is due and what lateness costs', async () => {
    await show();
    expect(screen.queryByTestId('john-sheet-body')).toBeNull();
    await openOn('Open a1');
    expect(screen.getByRole('header', { name: 'Bins out' })).toBeOnTheScreen();
    expect(screen.getByText('Bins · 2 pts')).toBeOnTheScreen();
    expect(screen.getByTestId('lid-dot', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('john-sheet-when')).toHaveTextContent(/^Due .+ · late costs £1, missed £3$/);
  });

  it('says how often it comes round, from the John on the list it was dealt from', async () => {
    await show(house([binsOut({ john_id: 'j1', johns: { every_weeks: 2 } })]));
    await openOn('Open a1');
    expect(screen.getByText('Bins · 2 pts · every 2 weeks')).toBeOnTheScreen();
  });

  it("says no more than lateness can still cost the John's owner this month, once a screen has read the Stake", async () => {
    const client = await show();
    const month = monthOf(new Date(Date.now() + 48 * HOUR), 'Europe/London');
    // Priya has £2 of her £20 stake left to lose.
    await act(() =>
      client.setQueryData(
        stakeKey('h1'),
        buildStake({
          ledger: [{ id: 1, user_id: 'priya', kind: 'forfeit', amount_minor: -1800, month, counterparty: null, created_at: at(-1) }],
          closedMonths: [],
          memberIds: ['priya', 'sam'],
          stakeMinor: 2000,
          month,
        }),
      ),
    );
    await openOn('Open a1');
    expect(screen.getByTestId('john-sheet-when')).toHaveTextContent(/^Due .+ · late costs £1, missed £2$/);
  });
});

describe('your open John', () => {
  it('ticks it, or takes a photo first', async () => {
    await show();
    const body = await openOn('Open a1');
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_COPY.markDone }));
    expect(markDone).toHaveBeenCalledWith('a1');
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_SHEET_COPY.addPhoto }));
    expect(pickPhoto).toHaveBeenCalledWith('camera');
  });

  it('leads a photo John with the camera, then the library', async () => {
    await show(house([binsOut({ needs_photo: true })]));
    const body = await openOn('Open a1');
    expect(within(body).getByTestId('sheet-mark-done')).toHaveTextContent(NEXT_UP_COPY.takePhoto);
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_SHEET_COPY.fromLibrary }));
    expect(pickPhoto).toHaveBeenCalledWith('library');
  });

  it('says a refusal in the sheet', async () => {
    (markDone as jest.Mock).mockRejectedValue(new Error('That week has closed.'));
    await show();
    const body = await openOn('Open a1');
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_COPY.markDone }));
    expect(await within(body).findByRole('alert')).toHaveTextContent('That week has closed.');
  });

  it("offers no way out without a token", async () => {
    await show(house([binsOut(), samsBath()]));
    await openOn('Open a1');
    expect(screen.queryByTestId('if-you-cant')).toBeNull();
  });

  describe("opened at If you can't (Today's skip or swap)", () => {
    it('starts on the skip, ready to confirm, when immunity is all you hold', async () => {
      await show(house([binsOut(), samsBath()], priyaWith({ immunityTokens: 1 })));
      const body = await openOn('Open a1 at cant');
      expect(within(within(body).getByTestId('skip-confirm')).getByText(JOHN_SHEET_COPY.skipSentence('Bins out', 0))).toBeOnTheScreen();
      expect(spendImmunity).not.toHaveBeenCalled();
    });

    it('starts on the swap when a swap is all you hold', async () => {
      await show(house([binsOut(), samsBath()], priyaWith({ swapTokens: 1 })));
      const body = await openOn('Open a1 at cant');
      expect(within(body).getByTestId('swap-picker')).toBeOnTheScreen();
    });

    it('offers both, with the tick, when you hold both', async () => {
      await show(house([binsOut(), samsBath()], priyaWith({ immunityTokens: 1, swapTokens: 1 })));
      const body = await openOn('Open a1 at cant');
      expect(within(body).getByTestId('tick-actions')).toBeOnTheScreen();
      expect(within(body).getByTestId('skip-row')).toBeOnTheScreen();
      expect(within(body).getByTestId('swap-row')).toBeOnTheScreen();
    });

    it('opens scrolled to them, should the tick above leave them out of view', async () => {
      // Jest lays nothing out: the sheet is 400 tall, its content 900, and If you can't starts at 500.
      measureAt(500);
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await show(house([binsOut(), samsBath()], priyaWith({ immunityTokens: 1, swapTokens: 1 })));
      const body = await openOn('Open a1 at cant');
      const anchor = within(body).getByTestId('sheet-anchor-cant');
      expect(anchor).toContainElement(within(body).getByTestId('if-you-cant'));
      await fireEvent(screen.getByTestId('sheet-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      await fireEvent(screen.getByTestId('sheet-scroll'), 'contentSizeChange', 390, 900);
      await fireEvent(anchor, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 160 } } });
      expect(scrollTo).toHaveBeenCalledWith({ y: 500 - 16, animated: false });
      measureNowhere();
    });

    it('opens at the top when opened on the John itself', async () => {
      measureAt(500);
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      await show(house([binsOut(), samsBath()], priyaWith({ immunityTokens: 1, swapTokens: 1 })));
      const body = await openOn('Open a1');
      await fireEvent(screen.getByTestId('sheet-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      await fireEvent(screen.getByTestId('sheet-scroll'), 'contentSizeChange', 390, 900);
      await fireEvent(within(body).getByTestId('sheet-anchor-cant'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 160 } } });
      expect(scrollTo).not.toHaveBeenCalled();
      measureNowhere();
    });
  });

  describe('skipping with immunity', () => {
    it('says what it means first, and can be called off', async () => {
      await show(house([binsOut()], priyaWith({ immunityTokens: 1 })));
      const body = await openOn('Open a1');
      expect(within(body).getByText(JOHN_SHEET_COPY.skipMeta(1))).toBeOnTheScreen();
      await fireEvent.press(within(body).getByTestId('skip-row'));
      expect(within(within(body).getByTestId('skip-confirm')).getByText(JOHN_SHEET_COPY.skipSentence('Bins out', 0))).toBeOnTheScreen();
      await fireEvent.press(within(body).getByRole('button', { name: FOCUS_SHELL_COPY.cancel }));
      expect(within(body).queryByTestId('skip-confirm')).toBeNull();
      expect(spendImmunity).not.toHaveBeenCalled();
    });

    it('spends it on "Skip it"', async () => {
      await show(house([binsOut()], priyaWith({ immunityTokens: 2 })));
      const body = await openOn('Open a1');
      await fireEvent.press(within(body).getByTestId('skip-row'));
      expect(within(body).getByText(JOHN_SHEET_COPY.skipSentence('Bins out', 1))).toBeOnTheScreen();
      await fireEvent.press(within(body).getByRole('button', { name: JOHN_SHEET_COPY.skipIt }));
      expect(spendImmunity).toHaveBeenCalledWith('a1');
    });

    it('says a refusal where it was asked', async () => {
      (spendImmunity as jest.Mock).mockRejectedValue(new Error('You have no immunity left.'));
      await show(house([binsOut()], priyaWith({ immunityTokens: 1 })));
      const body = await openOn('Open a1');
      await fireEvent.press(within(body).getByTestId('skip-row'));
      await fireEvent.press(within(body).getByRole('button', { name: JOHN_SHEET_COPY.skipIt }));
      expect(await within(within(body).getByTestId('skip-confirm')).findByRole('alert')).toHaveTextContent(
        'You have no immunity left.',
      );
    });
  });

  describe('swapping', () => {
    const swappable = () => house([binsOut(), samsBath()], priyaWith({ swapTokens: 1 }));

    it("offers the housemates' open Johns, and swaps for the one picked", async () => {
      await show(swappable());
      const body = await openOn('Open a1');
      expect(within(body).queryByTestId('skip-row')).toBeNull();
      await fireEvent.press(within(body).getByTestId('swap-row'));
      expect(within(body).getByText(JOHN_SHEET_COPY.swapBody('Bins out'))).toBeOnTheScreen();
      // One choice of n, to a screen reader.
      expect(within(body).getByLabelText(JOHN_SHEET_COPY.swapFor)).toBeOnTheScreen();
      const choice = within(body).getByRole('radio', { name: /^Clean the bath, Sam · / });
      expect(choice).not.toBeChecked();
      expect(within(body).queryByTestId('swap-chosen')).toBeNull();
      expect(within(body).getByTestId('swap-them')).toBeDisabled();

      expect(within(body).getByTestId('swap-choice')).not.toHaveStyle({ backgroundColor: BIN_NIGHT.light.secondary });

      await fireEvent.press(choice);
      expect(choice).toBeChecked();
      // Ticked at the end of its row, which takes the tint; the owner's initials keep a plate that shows on it.
      expect(within(choice).getByTestId('swap-chosen')).toBeOnTheScreen();
      const row = within(body).getByTestId('swap-choice');
      expect(row).toHaveStyle({ backgroundColor: BIN_NIGHT.light.secondary });
      expect(within(row).getByTestId('avatar', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: BIN_NIGHT.light.card });
      await fireEvent.press(within(body).getByRole('button', { name: SWAP_COPY.swap }));
      expect(spendSwap).toHaveBeenCalledWith('a1', 'a4');
      // The John is Sam's now: the sheet goes.
      await waitFor(() => expect(screen.queryByTestId('john-sheet-body')).toBeNull());
    });

    it('says which of their Johns is overdue, with its edge and its mark until picked', async () => {
      await show(house([binsOut(), samsBath({ due_at: at(-5) })], priyaWith({ swapTokens: 1 })));
      const body = await openOn('Open a1 at swap');
      const choice = within(body).getByRole('radio', { name: /^Clean the bath, Sam · was due / });
      expect(within(choice).getByTestId('status-overdue')).toBeOnTheScreen();
      expect(within(within(body).getByTestId('swap-choice')).getByTestId('hazard-tape', { includeHiddenElements: true })).toBeOnTheScreen();
      await fireEvent.press(choice);
      expect(within(choice).queryByTestId('status-overdue')).toBeNull();
      expect(within(choice).getByTestId('swap-chosen')).toBeOnTheScreen();
    });

    it('goes back to the tick on Cancel', async () => {
      await show(swappable());
      const body = await openOn('Open a1');
      await fireEvent.press(within(body).getByTestId('swap-row'));
      await fireEvent.press(within(body).getByTestId('swap-cancel'));
      expect(within(body).queryByTestId('swap-picker')).toBeNull();
      expect(within(body).getByTestId('tick-actions')).toBeOnTheScreen();
    });

    it('opens straight on the swap when asked to', async () => {
      await show(swappable());
      const body = await openOn('Open a1 at swap');
      expect(within(body).getByTestId('swap-picker')).toBeOnTheScreen();
    });

    it('says a refusal, and stays open', async () => {
      (spendSwap as jest.Mock).mockRejectedValue(new Error('Sam has ticked that one.'));
      await show(swappable());
      const body = await openOn('Open a1 at swap');
      await fireEvent.press(within(body).getByRole('radio', { name: /^Clean the bath/ }));
      await fireEvent.press(within(body).getByTestId('swap-them'));
      expect(await within(body).findByRole('alert')).toHaveTextContent('Sam has ticked that one.');
      expect(screen.getByTestId('john-sheet-body')).toBeOnTheScreen();
    });
  });
});

describe('your tick, being checked', () => {
  it('says when it stands, and undoes it', async () => {
    await show(house([binsOut({ done_at: at(-1) })]));
    const body = await openOn('Open a1');
    expect(within(body).getByTestId('ticked-line')).toHaveTextContent(/^You ticked this .+ · stands in 2[23]h$/);
    expect(within(body).queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_COPY.undo }));
    expect(undoDone).toHaveBeenCalledWith('a1');
  });

  it('says a refusal', async () => {
    (undoDone as jest.Mock).mockRejectedValue(new Error('It has stood.'));
    await show(house([binsOut({ done_at: at(-1) })]));
    const body = await openOn('Open a1');
    await fireEvent.press(within(body).getByRole('button', { name: JOHN_COPY.undo }));
    expect(await within(body).findByRole('alert')).toHaveTextContent('It has stood.');
  });
});

describe("a housemate's John", () => {
  it('says whose it is while it is open, with nothing to do', async () => {
    await show(house([binsOut(), samsBath()]));
    const body = await openOn('Open a4');
    expect(within(body).getByText(JOHN_SHEET_COPY.theirs('Sam'))).toBeOnTheScreen();
    expect(within(body).queryByRole('button')).toBeNull();
  });

  it('says who ticked it and when it stands, and disputes it in place', async () => {
    await show();
    const body = await openOn('Open a4');
    expect(within(body).getByTestId('ticked-line')).toHaveTextContent(/^Sam ticked this .+ · stands in 2[23]h$/);
    await fireEvent.press(within(body).getByRole('button', { name: DISPUTE_COPY.open }));
    expect(within(body).getByTestId('dispute-reason')).toBeOnTheScreen();
    expect(within(body).getByTestId('send-dispute')).toBeOnTheScreen();
  });

  it('waits for Dispute to be pressed, even when opened to dispute', async () => {
    await show();
    const body = await openOn('Open a4 at dispute');
    expect(within(body).queryByTestId('dispute-reason')).toBeNull();
    expect(within(body).getByRole('button', { name: DISPUTE_COPY.open })).toBeOnTheScreen();
  });
});

describe('a disputed John', () => {
  const dispute = (votes: DisputeRow['dispute_votes'] = [{ user_id: 'megan', uphold: true }]): DisputeRow => ({
    id: 'd1',
    assignment_id: 'a4',
    raised_by: 'megan',
    reason: 'Ring round the bath',
    closes_at: at(17.5),
    dispute_votes: votes,
  });
  const disputed = (votes?: DisputeRow['dispute_votes']) =>
    house([binsOut(), samsBath({ done_at: at(-2) })], [...snapshot().members, MEGAN], [dispute(votes)]);

  it('shows the reason beside the owner, and the tally', async () => {
    await show(disputed());
    const body = await openOn('Open a4');
    expect(within(body).getByTestId('john-sheet-when')).toHaveTextContent('Disputed by Megan');
    expect(within(body).getByText('“Ring round the bath”')).toBeOnTheScreen();
    expect(within(body).getByTestId('tally')).toHaveTextContent(/^0 fine · 1 not done · closes in 1[78]h$/);
    expect(within(body).getByRole('button', { name: DISPUTE_COPY.fine })).not.toBeSelected();
    expect(within(body).getByRole('button', { name: DISPUTE_COPY.notDone })).not.toBeSelected();
  });

  it('counts your vote, puts itself away, and says where to change it', async () => {
    await show(disputed());
    const body = await openOn('Open a4');
    await fireEvent.press(within(body).getByRole('button', { name: DISPUTE_COPY.fine }));
    expect(castVote).toHaveBeenCalledWith('d1', false);
    await waitFor(() => expect(screen.queryByTestId('john-sheet-body')).toBeNull());
    expect(screen.getByText(JOHN_SHEET_COPY.voted)).toBeOnTheScreen();
  });

  it('shows the vote you cast as chosen', async () => {
    await show(
      disputed([
        { user_id: 'megan', uphold: true },
        { user_id: 'priya', uphold: false },
      ]),
    );
    const body = await openOn('Open a4');
    expect(within(body).getByTestId('tally')).toHaveTextContent(/^1 fine · 1 not done/);
    expect(within(body).getByRole('button', { name: DISPUTE_COPY.fine })).toBeSelected();
    expect(within(body).getByRole('button', { name: DISPUTE_COPY.notDone })).not.toBeSelected();
  });

  it('says a refusal, and stays open', async () => {
    (castVote as jest.Mock).mockRejectedValue(new Error('The vote has closed.'));
    await show(disputed());
    const body = await openOn('Open a4');
    await fireEvent.press(within(body).getByRole('button', { name: DISPUTE_COPY.notDone }));
    expect(await within(body).findByRole('alert')).toHaveTextContent('The vote has closed.');
    expect(screen.queryByText(JOHN_SHEET_COPY.voted)).toBeNull();
  });

  it('only tells the owner the house is voting', async () => {
    await show(
      house([binsOut({ done_at: at(-2) })], [...snapshot().members, MEGAN], [{ ...dispute(), assignment_id: 'a1' }]),
    );
    const body = await openOn('Open a1');
    expect(within(body).getByText(JOHN_SHEET_COPY.yourTick)).toBeOnTheScreen();
    expect(within(body).queryByRole('button', { name: DISPUTE_COPY.fine })).toBeNull();
  });
});

describe('a settled John', () => {
  it('says it was done on time, in its header, with the photo receipt signed for it', async () => {
    await show(
      house([
        binsOut(),
        assignment({ id: 'a3', name: 'Wipe the hob', category: 'kitchen', due_at: at(-30), done_at: at(-40), outcome: 'done', photo_path: 'h1/a3.jpg' }),
      ]),
    );
    const body = await openOn('Open a3');
    expect(within(body).getByTestId('john-sheet-when')).toHaveTextContent(/^You did it on time, .+\.$/);
    const photo = await within(body).findByTestId('sheet-photo');
    expect(photo.props.source).toEqual({ uri: 'https://photos.test/a3.jpg' });
    expect(signPhoto).toHaveBeenCalledWith('h1/a3.jpg');
    expect(within(body).queryByRole('button')).toBeNull();
  });

  it.each([
    [{ done_at: at(-1), outcome: 'late' as const }, /^Sam did it late, .+\.$/],
    [{ excused: true }, /^Sam skipped it with immunity, so there’s no forfeit\.$/],
    [{ due_at: at(-30), outcome: 'missed' as const }, /^It was missed\.$/],
  ])('says what happened, in place of what lateness would cost: %o', async (how, words) => {
    await show(house([binsOut(), samsBath(how)]));
    const body = await openOn('Open a4');
    expect(within(body).getByTestId('john-sheet-when')).toHaveTextContent(words);
    expect(within(body).queryByTestId('sheet-photo')).toBeNull();
    expect(signPhoto).not.toHaveBeenCalled();
  });
});

it('puts itself away', async () => {
  await show();
  await openOn('Open a1');
  await fireEvent.press(screen.getByRole('button', { name: 'Put it away' }));
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
});

it('opens on nothing for a John the board does not have', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Open gone' }));
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
});

it('follows the John live, and closes when it goes (a re-deal)', async () => {
  const client = await show();
  await openOn('Open a1');
  expect(screen.getByRole('header', { name: 'Bins out' })).toBeOnTheScreen();

  // Ticked underneath the open sheet, from another phone: it follows.
  (loadHouse as jest.Mock).mockResolvedValue(house([binsOut({ done_at: at(0) })]));
  await act(() => client.invalidateQueries({ queryKey: houseKey('h1') }));
  expect(await screen.findByTestId('ticked-line')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();

  // Re-dealt: the John is gone, and so is the sheet.
  (loadHouse as jest.Mock).mockResolvedValue(house([binsOut({ id: 'a9' })]));
  await act(() => client.invalidateQueries({ queryKey: houseKey('h1') }));
  await waitFor(() => expect(screen.queryByTestId('john-sheet-body')).toBeNull());
  // And it stays shut when that id comes back.
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  await act(() => client.invalidateQueries({ queryKey: houseKey('h1') }));
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
});

it('needs the provider above it', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(render(<Opener />)).rejects.toThrow(/JohnSheetProvider/);
});
