import {
  BIN_NIGHT,
  buildStake,
  DISPUTE_COPY,
  FOCUS_SHELL_COPY,
  INVITE_COPY,
  JOHN_COPY,
  JOHN_SHEET_COPY,
  monthOf,
  NEXT_UP_COPY,
  NOT_DEALT_COPY,
  PAGE_TITLE,
  type DisputeRow,
} from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { loadAway } from '@/api/away';
import type { Housemate } from '@/api/board';
import { loadHouse } from '@/api/board';
import { castVote } from '@/api/disputes';
import { catchUp } from '@/api/house';
import { markDone, undoDone } from '@/api/johns';
import { pickPhoto } from '@/api/photos';
import { dealThisWeek, loadJohnList } from '@/api/settings';
import { loadStake } from '@/api/stake';
import Today from '@/app/(house)/today';
import { JohnSheetProvider } from '@/components/john-sheet';
import { ToastProvider } from '@/components/toast';
import { assignment, snapshot } from '@/testing/house';
import { BINS } from '@/testing/pages';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/away', () => ({ loadAway: jest.fn(), setAway: jest.fn(), cancelAway: jest.fn() }));
jest.mock('@/api/settings', () => ({ dealThisWeek: jest.fn(), loadJohnList: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/stake', () => ({ loadStake: jest.fn(), confirmPayment: jest.fn() }));
jest.mock('@/api/disputes', () => ({ castVote: jest.fn(), raiseDispute: jest.fn() }));
jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn(), spendSwap: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/wall', () => ({ loadWall: jest.fn(), setReaction: jest.fn() }));
jest.mock('@/api/supabase', () => {
  const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  return {
    supabase: {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      realtime: { setAuth: jest.fn() },
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const read = loadHouse as jest.Mock;
const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

const MEGAN: Housemate = { userId: 'megan', name: 'Megan', role: 'member', streak: 0, immunityTokens: 0, swapTokens: 0 };

/** Priya, with what she holds changed. */
function priyaWith(tokens: Partial<Housemate>): Housemate[] {
  const [priya, ...rest] = snapshot().members;
  return [{ ...priya, ...tokens }, ...rest];
}

/** Somewhere for Today's links to land. */
const Landed = ({ name }: { name: string }) => <Text>{`Landed on ${name}`}</Text>;

async function show() {
  const client = testQueryClient();
  await renderRouter(
    {
      // As the house layout has it: the toasts and the one John sheet around every tab.
      _layout: () => (
        <QueryClientProvider client={client}>
          <ToastProvider>
            <JohnSheetProvider houseId="h1" userId="priya">
              <Slot />
            </JohnSheetProvider>
          </ToastProvider>
        </QueryClientProvider>
      ),
      today: Today,
      'house/index': () => <Landed name="House" />,
      'house/away': () => <Landed name="Away" />,
      'house/johns': () => <Landed name="Johns" />,
    },
    { initialUrl: '/today' },
  );
}

async function open() {
  await show();
  // Next up's card, or what takes its place: the house has been read.
  return screen.findByTestId('next-up');
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [] });
  read.mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (markDone as jest.Mock).mockResolvedValue(undefined);
  (undoDone as jest.Mock).mockResolvedValue(undefined);
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  (loadJohnList as jest.Mock).mockResolvedValue({ johns: [BINS], groups: [] });
  (loadStake as jest.Mock).mockResolvedValue(
    buildStake({
      ledger: [{ id: 1, user_id: 'sam', kind: 'forfeit', amount_minor: -300, month: '2026-10', counterparty: null, created_at: '2026-10-10T12:00:00Z' }],
      closedMonths: [],
      memberIds: ['priya', 'sam'],
      stakeMinor: 2000,
      month: '2026-10',
    }),
  );
});

it("reads the house under Focus's title bar, and leaves signing out to House", async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: PAGE_TITLE.today })).toBeOnTheScreen();
  // The day it is in the house, on the right.
  expect(bar.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}$/)).toBeOnTheScreen();
  expect(read).toHaveBeenCalledWith('h1', expect.any(Date));
  expect(screen.queryByTestId('sign-out')).toBeNull();
});

describe('Next up', () => {
  it('shows your next John, what it is, when it is due and what late costs', async () => {
    const card = await open();
    expect(within(card).getByText(NEXT_UP_COPY.label)).toBeOnTheScreen();
    expect(within(card).getByText('Bins out')).toBeOnTheScreen();
    expect(screen.getByTestId('next-up-meta')).toHaveTextContent(/^Bins & recycling · due .+ · £1 if late$/);
    expect(within(card).getByRole('button', { name: JOHN_COPY.markDone })).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: NEXT_UP_COPY.photo })).toBeOnTheScreen();
    // Not overdue, and no token to spend: no hazard, no way to skip.
    expect(screen.queryByTestId('overdue-edge')).toBeNull();
    expect(screen.queryByTestId('skip-or-swap')).toBeNull();
    // Someone else's John is never yours to do.
    expect(screen.queryByText('Clean the bath')).toBeNull();
  });

  it('ticks it, reads the house again, and moves on to the next', async () => {
    await open();
    read.mockResolvedValue(snapshot({ assignments: [assignment({ done_at: at(0) }), ...snapshot().assignments.slice(1)] }));
    await fireEvent.press(screen.getByTestId('mark-done'));
    expect(markDone).toHaveBeenCalledWith('a1');
    await waitFor(() => expect(within(screen.getByTestId('next-up')).getByText('Hoover the stairs')).toBeOnTheScreen());
    // The tick waits for the house in the rest of the week, with Undo.
    const rows = within(screen.getByTestId('rest-of-week')).getAllByTestId('my-john');
    expect(rows[0]).toHaveTextContent(/Bins out/);
    expect(rows[0]).toHaveTextContent(/Bins · stands in 2\dh/);
  });

  it('ticks with a photo from the camera', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('done-with-photo'));
    expect(pickPhoto).toHaveBeenCalledWith('camera');
    // No photo taken: nothing ticked.
    expect(markDone).not.toHaveBeenCalled();
  });

  it('leads a photo John with the camera, and offers the library beside it', async () => {
    read.mockResolvedValue(snapshot({ assignments: [assignment({ needs_photo: true })] }));
    await open();
    expect(screen.getByTestId('mark-done')).toHaveTextContent(NEXT_UP_COPY.takePhoto);
    await fireEvent.press(screen.getByRole('button', { name: NEXT_UP_COPY.library }));
    expect(pickPhoto).toHaveBeenCalledWith('library');
    await fireEvent.press(screen.getByTestId('mark-done'));
    expect(pickPhoto).toHaveBeenLastCalledWith('camera');
  });

  it('says a refusal on the card', async () => {
    (markDone as jest.Mock).mockRejectedValue(new Error('That week has closed.'));
    const card = await open();
    await fireEvent.press(screen.getByTestId('mark-done'));
    expect(await within(card).findByRole('alert')).toHaveTextContent('That week has closed.');
  });

  it('wears the hazard edge when overdue, keeps its kind, and says what it costs now', async () => {
    read.mockResolvedValue(snapshot({ assignments: [assignment({ due_at: at(-3) })] }));
    await open();
    expect(screen.getByTestId('overdue-edge', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('next-up-meta')).toHaveTextContent(/^Bins & recycling$/);
    expect(screen.getByTestId('next-up-overdue')).toHaveTextContent(/^Overdue since .+ · £1 now, £3 if missed$/);
  });

  it('says no more than lateness can still cost you this month', async () => {
    // Priya has forfeited £19.50 of her £20 stake: being late costs her 50p more at most.
    const thisMonth = () => monthOf(new Date(Date.now() + HOUR), 'Europe/London');
    (loadStake as jest.Mock).mockResolvedValue(
      buildStake({
        ledger: [{ id: 1, user_id: 'priya', kind: 'forfeit', amount_minor: -1950, month: thisMonth(), counterparty: null, created_at: at(-1) }],
        closedMonths: [],
        memberIds: ['priya', 'sam'],
        stakeMinor: 2000,
        month: thisMonth(),
      }),
    );
    read.mockResolvedValue(snapshot({ assignments: [assignment({ due_at: at(1) })] }));
    await open();
    await waitFor(() => expect(screen.getByTestId('next-up-meta')).toHaveTextContent(/ · £0\.50 if late$/));
  });

  it('opens the John sheet from its name', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('next-up-name'));
    expect(await screen.findByTestId('john-sheet-body')).toBeOnTheScreen();
    expect(screen.getByTestId('john-sheet-name')).toHaveTextContent('Bins out');
  });

  it.each([
    [{ immunityTokens: 1 }, NEXT_UP_COPY.cant(true, false), 'skip-confirm'],
    [{ swapTokens: 1 }, NEXT_UP_COPY.cant(false, true), 'swap-picker'],
    [{ immunityTokens: 2, swapTokens: 1 }, NEXT_UP_COPY.cant(true, true), 'if-you-cant'],
  ])('offers to skip or swap while you hold %o, and opens the sheet on it', async (tokens, words, part) => {
    read.mockResolvedValue(snapshot({ members: priyaWith(tokens) }));
    await open();
    const way = screen.getByTestId('skip-or-swap');
    expect(way).toHaveTextContent(words);
    await fireEvent.press(way);
    expect(await within(await screen.findByTestId('john-sheet-body')).findByTestId(part)).toBeOnTheScreen();
  });

  it("offers no swap with nobody's John to swap for", async () => {
    read.mockResolvedValue(snapshot({ members: priyaWith({ swapTokens: 1 }), assignments: snapshot().assignments.slice(0, 3) }));
    await open();
    expect(screen.queryByTestId('skip-or-swap')).toBeNull();
  });
});

describe('what takes Next up’s place', () => {
  it('says you are clear until the week turns over, with no amber', async () => {
    const done = { done_at: at(-40), outcome: 'done' as const };
    read.mockResolvedValue(
      snapshot({ assignments: snapshot().assignments.map((a) => (a.user_id === 'priya' ? { ...a, ...done } : a)) }),
    );
    const card = await open();
    expect(within(card).getByText(/^You’re clear until (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)).toBeOnTheScreen();
    expect(within(card).getByText(NEXT_UP_COPY.clearBody)).toBeOnTheScreen();
    expect(screen.queryByTestId('mark-done')).toBeNull();
    // The finished ones are folded away.
    expect(screen.getByTestId('done-fold')).toHaveTextContent(FOCUS_SHELL_COPY.done(3));
  });

  it('says so when nothing on the list is yours this week', async () => {
    read.mockResolvedValue(snapshot({ assignments: [assignment({ user_id: 'sam' })] }));
    const card = await open();
    expect(within(card).getByText(NEXT_UP_COPY.nothingYours)).toBeOnTheScreen();
    expect(screen.queryByTestId('rest-of-week')).toBeNull();
  });

  describe('time away', () => {
    const trip = (startsOn: string, endsOn: string) => ({ id: 'p1', userId: 'priya', startsOn, endsOn, note: null });

    it('says until when, how your share catches up, and where to change the dates', async () => {
      (loadAway as jest.Mock).mockResolvedValue({ today: '2026-10-21', periods: [trip('2026-10-20', '2026-10-28')] });
      await show();
      const card = await screen.findByText(/^You’re away until Wed 28 Oct$/);
      expect(card).toBeOnTheScreen();
      expect(screen.getByText(NEXT_UP_COPY.awayBody(100))).toBeOnTheScreen();
      expect(screen.queryByTestId('mark-done')).toBeNull();
      await fireEvent.press(screen.getByRole('link', { name: NEXT_UP_COPY.changeDates }));
      expect(screen).toHavePathname('/house/away');
    });

    it('runs back-to-back trips together', async () => {
      (loadAway as jest.Mock).mockResolvedValue({
        today: '2026-10-21',
        periods: [trip('2026-10-20', '2026-10-23'), { ...trip('2026-10-24', '2026-10-30'), id: 'p2' }],
      });
      await show();
      expect(await screen.findByText(/^You’re away until Fri 30 Oct$/)).toBeOnTheScreen();
    });

    it("stays on your John for a trip still to come, and says when under the week, on to the dates", async () => {
      (loadAway as jest.Mock).mockResolvedValue({
        today: '2026-10-21',
        periods: [trip('2026-10-23', '2026-10-28'), { ...trip('2026-10-20', '2026-10-23'), id: 'p2', userId: 'sam' }],
      });
      await open();
      const line = await screen.findByTestId('away-line');
      expect(line).toHaveTextContent('You’re away 23–28 Oct');
      expect(screen.getByTestId('mark-done')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('link', { name: `You’re away 23–28 Oct. ${NEXT_UP_COPY.changeDates}` }));
      expect(screen).toHavePathname('/house/away');
    });

    it("says nothing of someone else's trip, or one more than a fortnight off", async () => {
      (loadAway as jest.Mock).mockResolvedValue({
        today: '2026-10-21',
        periods: [{ ...trip('2026-10-20', '2026-10-23'), userId: 'sam' }, trip('2026-11-06', '2026-11-08')],
      });
      await open();
      await waitFor(() => expect(loadAway).toHaveBeenCalled());
      expect(await screen.findByTestId('standing-line')).toBeOnTheScreen();
      expect(screen.queryByTestId('away-line')).toBeNull();
      expect(screen.queryByText(/^You’re away/)).toBeNull();
    });
  });

  describe('before the first deal', () => {
    const first = () => snapshot({ week: null, assignments: [], house: { ...snapshot().house, everDealt: false } });

    it('gives an admin the steps, and deals week 1 in amber once the first two are done', async () => {
      (dealThisWeek as jest.Mock).mockResolvedValue(undefined);
      read.mockResolvedValue(first());
      const card = await open();
      expect(within(card).getByText('Set up Flat 3')).toBeOnTheScreen();
      expect(await within(card).findByText(NEXT_UP_COPY.onTheList(1))).toBeOnTheScreen();
      expect(within(card).getByText(NEXT_UP_COPY.housemates(2))).toBeOnTheScreen();
      const deal = within(card).getByRole('button', { name: NEXT_UP_COPY.dealWeek1 });
      expect(deal).toHaveStyle({ backgroundColor: BIN_NIGHT.light.hivis });
      await fireEvent.press(deal);
      expect(dealThisWeek).toHaveBeenCalledWith('h1');
    });

    it('offers the deal in outline until there are Johns and a housemate, and says what the server says', async () => {
      (dealThisWeek as jest.Mock).mockRejectedValue(new Error('Add some Johns to the list first.'));
      (loadJohnList as jest.Mock).mockResolvedValue({ johns: [], groups: [] });
      read.mockResolvedValue({ ...first(), members: first().members.slice(0, 1) });
      const card = await open();
      expect(await within(card).findByText(NEXT_UP_COPY.onTheList(0))).toBeOnTheScreen();
      const deal = within(card).getByRole('button', { name: NEXT_UP_COPY.dealWeek1 });
      expect(deal).toHaveStyle({ backgroundColor: 'transparent' });
      await fireEvent.press(deal);
      expect(dealThisWeek).toHaveBeenCalledWith('h1');
      expect(await within(card).findByRole('alert')).toHaveTextContent('Add some Johns to the list first.');
    });

    it('opens the John list, and the invite in a sheet', async () => {
      read.mockResolvedValue({ ...first(), members: first().members.slice(0, 1) });
      await open();
      expect(screen.getByText(NEXT_UP_COPY.housemates(1))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(NEXT_UP_COPY.invite) }));
      expect(await screen.findByTestId('invite-url')).toHaveTextContent('https://johns.glyn.dev/join/AB3DEF7H');
      // The invite says its heading once: the sheet leaves it to the card.
      expect(within(screen.getByTestId('invite-sheet')).getAllByText(INVITE_COPY.heading)).toHaveLength(1);
      await fireEvent.press(screen.getByRole('link', { name: new RegExp(NEXT_UP_COPY.addJohns) }));
      expect(screen).toHavePathname('/house/johns');
    });

    it("tells everyone else who will deal it", async () => {
      const house = first();
      read.mockResolvedValue({
        ...house,
        members: [
          { ...house.members[0], role: 'member' },
          { ...house.members[1], role: 'admin' },
        ],
      });
      const card = await open();
      expect(within(card).getByText(NEXT_UP_COPY.waiting('Sam'))).toBeOnTheScreen();
      expect(screen.queryByTestId('setup-steps')).toBeNull();
    });
  });

  it("says when a dealt house has nothing handed out this week", async () => {
    read.mockResolvedValue(snapshot({ week: null, assignments: [] }));
    const card = await open();
    expect(within(card).getByText(NOT_DEALT_COPY.nothingThisWeek)).toBeOnTheScreen();
    expect(screen.queryByTestId('standing-line')).toBeNull();
  });
});

describe('Needs you', () => {
  const disputed = () => {
    const dispute: DisputeRow = {
      id: 'd1',
      assignment_id: 'a4',
      raised_by: 'megan',
      reason: 'Ring round the bath',
      closes_at: at(17.5),
      dispute_votes: [{ user_id: 'megan', uphold: true }],
    };
    return snapshot({
      members: [...snapshot().members, MEGAN],
      assignments: [...snapshot().assignments.slice(0, 3), assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath', done_at: at(-2) })],
      disputes: [dispute],
    });
  };

  it('is not there when nothing waits for your vote', async () => {
    await open();
    expect(screen.queryByTestId('needs-you')).toBeNull();
  });

  it('lists the disputes waiting for your vote, saying whose John each is', async () => {
    read.mockResolvedValue(disputed());
    await open();
    const section = screen.getByTestId('needs-you');
    expect(within(section).getByText(`${NEXT_UP_COPY.needsYou}`)).toBeOnTheScreen();
    const row = within(section).getByTestId('vote-row');
    expect(within(row).getByText('Vote on Sam’s Clean the bath')).toBeOnTheScreen();
    expect(row).toHaveTextContent(/Megan says it’s not done · closes in 1[78]h/);
    expect(within(row).getByTestId('avatar', { includeHiddenElements: true })).toHaveTextContent('SA');
  });

  it('opens the John sheet at the vote, which closes it and says where to change it', async () => {
    (castVote as jest.Mock).mockResolvedValue(undefined);
    read.mockResolvedValue(disputed());
    await open();
    await fireEvent.press(within(screen.getByTestId('needs-you')).getByTestId('vote-row'));
    const body = await screen.findByTestId('john-sheet-body');
    expect(within(body).getByText('“Ring round the bath”')).toBeOnTheScreen();
    await fireEvent.press(within(body).getByRole('button', { name: DISPUTE_COPY.notDone }));
    expect(castVote).toHaveBeenCalledWith('d1', true);
    await waitFor(() => expect(screen.queryByTestId('john-sheet-body')).toBeNull());
    expect(screen.getByText(JOHN_SHEET_COPY.voted)).toBeOnTheScreen();
  });
});

describe('the rest of your week', () => {
  it('lists your other Johns, ticked from their circle, with the finished ones folded', async () => {
    await open();
    const section = screen.getByTestId('rest-of-week');
    expect(within(section).getByText(NEXT_UP_COPY.rest)).toBeOnTheScreen();
    // Next up's John isn't listed twice.
    expect(within(section).queryByText('Bins out')).toBeNull();
    expect(within(section).getByText('Hoover the stairs')).toBeOnTheScreen();
    expect(within(section).queryByText('Wipe the hob')).toBeNull();

    await fireEvent.press(within(section).getByRole('checkbox', { name: NEXT_UP_COPY.tick('Hoover the stairs') }));
    expect(markDone).toHaveBeenCalledWith('a2');

    const fold = screen.getByTestId('done-fold');
    expect(fold).toHaveTextContent(FOCUS_SHELL_COPY.done(1));
    await fireEvent.press(fold);
    // Done once: the green circle, then the points it earned, not a second mark.
    const hob = within(section).getAllByTestId('my-john')[1];
    expect(hob).toHaveTextContent(/^Wipe the hobKitchen · done .+2 pts$/);
    expect(within(hob).getByLabelText(NEXT_UP_COPY.stateLabel.done)).toBeOnTheScreen();
    expect(within(hob).queryByTestId('status-done')).toBeNull();
  });

  it('shows an immunity skip with its shield, folded with the done, and a disputed John with who raised it', async () => {
    const dispute: DisputeRow = {
      id: 'd1',
      assignment_id: 'a2',
      raised_by: 'sam',
      reason: 'Stairs still dusty',
      closes_at: at(17.5),
      dispute_votes: [{ user_id: 'sam', uphold: true }],
    };
    read.mockResolvedValue(
      snapshot({
        assignments: [
          assignment(),
          assignment({ id: 'a2', name: 'Hoover the stairs', category: 'floors', due_at: at(-5), done_at: at(-6) }),
          assignment({ id: 'a3', name: 'Wipe the hob', category: 'kitchen', due_at: at(-30), excused: true }),
        ],
        disputes: [dispute],
      }),
    );
    await open();
    const section = screen.getByTestId('rest-of-week');
    const stairs = within(section).getByTestId('my-john');
    expect(stairs).toHaveTextContent(/^Hoover the stairsDisputed by Sam · 1[78]h left2 pts$/);
    expect(within(stairs).getByLabelText(NEXT_UP_COPY.stateLabel.disputed)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('done-fold'));
    const hob = within(section).getAllByTestId('my-john')[1];
    expect(hob).toHaveTextContent(/^Wipe the hobKitchen · skipped with immunity$/);
    // Never spoken as "Not done".
    expect(within(hob).queryByLabelText(NEXT_UP_COPY.stateLabel.open)).toBeNull();
  });

  it('offers Undo while the house checks your tick', async () => {
    read.mockResolvedValue(
      snapshot({ assignments: [assignment(), assignment({ id: 'a2', name: 'Hoover the stairs', category: 'floors', due_at: at(72), done_at: at(-1) })] }),
    );
    await open();
    const row = within(screen.getByTestId('rest-of-week')).getByTestId('my-john');
    expect(within(row).getByLabelText(NEXT_UP_COPY.stateLabel.checking)).toBeOnTheScreen();
    expect(within(row).queryByTestId('status-checking')).toBeNull();
    await fireEvent.press(within(row).getByRole('button', { name: NEXT_UP_COPY.undo('Hoover the stairs') }));
    expect(undoDone).toHaveBeenCalledWith('a2');
  });

  it('marks an overdue John with the hazard edge, and opens the sheet from the row', async () => {
    read.mockResolvedValue(
      snapshot({ assignments: [assignment(), assignment({ id: 'a2', name: 'Hoover the stairs', category: 'floors', due_at: at(-5) })] }),
    );
    await open();
    // The overdue one is next up; Bins out waits in the rest of the week.
    expect(within(screen.getByTestId('next-up')).getByText('Hoover the stairs')).toBeOnTheScreen();
    const row = within(screen.getByTestId('rest-of-week')).getByTestId('my-john');
    await fireEvent.press(within(row).getByText('Bins out'));
    expect(await screen.findByTestId('john-sheet-name')).toHaveTextContent('Bins out');
  });

  it('says a refusal under the row', async () => {
    (markDone as jest.Mock).mockRejectedValue(new Error('That week has closed.'));
    await open();
    const section = screen.getByTestId('rest-of-week');
    await fireEvent.press(within(section).getByRole('checkbox', { name: NEXT_UP_COPY.tick('Hoover the stairs') }));
    expect(await within(section).findByRole('alert')).toHaveTextContent('That week has closed.');
  });
});

it('says where you stand in one line, on to House', async () => {
  await open();
  // Priya alone has points this week; Sam's forfeit is in the pot.
  const line = await screen.findByTestId('standing-line');
  expect(line).toHaveTextContent(/^1st this week · up £3 in October$/);
  // No trip coming: no line about one.
  expect(screen.queryByTestId('away-line')).toBeNull();
  await fireEvent.press(line);
  expect(screen).toHavePathname('/house');
});

describe('catching up', () => {
  it('catches the house up as it comes into view', async () => {
    await open();
    expect(catchUp).toHaveBeenCalledWith('h1');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads the house again when the server had something to do', async () => {
    (catchUp as jest.Mock).mockResolvedValue(true);
    await open();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  });

  it("doesn't mind when catching up fails", async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (catchUp as jest.Mock).mockRejectedValue(new Error('offline'));
    expect(await open()).toBeOnTheScreen();
  });
});

it("says when it can't read the house, and tries again", async () => {
  read.mockRejectedValueOnce(new Error('offline'));
  await show();
  expect(await screen.findByRole('alert')).toHaveTextContent(FOCUS_SHELL_COPY.unreadable);
  await fireEvent.press(screen.getByRole('button', { name: FOCUS_SHELL_COPY.retry }));
  expect(await screen.findByTestId('next-up')).toBeOnTheScreen();
});
