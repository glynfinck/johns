import { JOHN_COPY, type BoardItem } from '@app/core';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { markDone, spendImmunity, undoDone } from '@/api/johns';
import { pickPhoto, uploadProof } from '@/api/photos';
import { testQueryClient } from '@/testing/query';

import { JohnCard } from './john-card';

jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const NOW = new Date('2026-10-21T12:00:00Z');
const HIDDEN = { includeHiddenElements: true };

const BINS: BoardItem = {
  id: 'a1',
  userId: 'u1',
  name: 'Bins out',
  category: 'bins',
  points: 2,
  needsPhoto: false,
  dueAt: new Date('2026-10-22T19:00:00Z'),
  movedFrom: null,
  groupName: null,
  doneAt: null,
  photoPath: null,
  outcome: null,
  status: 'upcoming',
  standsAt: null,
  dispute: null,
};

let client: QueryClient;

async function show(item: Partial<BoardItem> = {}, immunityTokens = 0) {
  await render(
    <QueryClientProvider client={client}>
      <JohnCard item={{ ...BINS, ...item }} houseId="h1" zone="Europe/London" now={NOW} immunityTokens={immunityTokens} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  client = testQueryClient();
  jest.spyOn(client, 'invalidateQueries');
  (markDone as jest.Mock).mockResolvedValue(undefined);
  (undoDone as jest.Mock).mockResolvedValue(undefined);
  (spendImmunity as jest.Mock).mockResolvedValue(undefined);
  (pickPhoto as jest.Mock).mockResolvedValue('file:///small.jpg');
  (uploadProof as jest.Mock).mockResolvedValue('h1/a1/receipt.jpg');
});

it('shows the John: its kind, when it is due, its status and its points', async () => {
  await show();
  expect(screen.getByText('Bins out')).toBeOnTheScreen();
  expect(screen.getByText('Bins & recycling · Tomorrow 20:00')).toBeOnTheScreen();
  expect(screen.getByText('Upcoming')).toBeOnTheScreen();
  expect(screen.getByText('2 pts')).toBeOnTheScreen();
  expect(screen.queryByTestId('hazard-tape', HIDDEN)).toBeNull();
});

it("names a group's John by its group, and says a photo John needs one", async () => {
  await show({ groupName: 'Upstairs', needsPhoto: true });
  expect(screen.getByText(/^Upstairs · .* · photo$/)).toBeOnTheScreen();
});

it('ticks it, then reads the house again', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.markDone }));
  expect(markDone).toHaveBeenCalledWith('a1');
  expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['house', 'h1'] });
});

it("says why when the database won't take the tick", async () => {
  (markDone as jest.Mock).mockRejectedValue(new Error("That's already ticked."));
  await show();
  await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.markDone }));
  expect(screen.getByRole('alert')).toHaveTextContent("That's already ticked.");
  expect(client.invalidateQueries).not.toHaveBeenCalled();
});

it('can tick any John with a photo, though only a photo John needs one', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.withPhoto }));
  expect(pickPhoto).toHaveBeenCalledWith('camera');
  expect(uploadProof).toHaveBeenCalledWith('h1', 'a1', 'file:///small.jpg');
  expect(markDone).toHaveBeenCalledWith('a1', 'h1/a1/receipt.jpg');
});

describe('a photo John', () => {
  it('takes the photo first, from the camera or the library', async () => {
    await show({ needsPhoto: true });
    expect(screen.queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.photoAndDone }));
    expect(pickPhoto).toHaveBeenLastCalledWith('camera');
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.choosePhoto }));
    expect(pickPhoto).toHaveBeenLastCalledWith('library');
    expect(markDone).toHaveBeenCalledTimes(2);
    expect(markDone).toHaveBeenCalledWith('a1', 'h1/a1/receipt.jpg');
  });

  it('does nothing when you back out of the camera', async () => {
    (pickPhoto as jest.Mock).mockResolvedValue(null);
    await show({ needsPhoto: true });
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.photoAndDone }));
    expect(uploadProof).not.toHaveBeenCalled();
    expect(markDone).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("says so when the camera isn't allowed, or the photo didn't upload, and doesn't tick", async () => {
    (pickPhoto as jest.Mock).mockRejectedValueOnce(new Error('Johns needs the camera for photo receipts. Allow it in Settings.'));
    await show({ needsPhoto: true });
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.photoAndDone }));
    expect(screen.getByRole('alert')).toHaveTextContent('Johns needs the camera for photo receipts. Allow it in Settings.');

    (uploadProof as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.photoAndDone }));
    expect(screen.getByRole('alert')).toHaveTextContent(JOHN_COPY.photoFailed);
    expect(markDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: JOHN_COPY.photoAndDone })).toBeEnabled();
  });
});

describe('immunity', () => {
  it("isn't offered without a token", async () => {
    await show();
    expect(screen.queryByRole('button', { name: JOHN_COPY.useImmunity })).toBeNull();
  });

  it('asks before spending one, and can be kept', async () => {
    await show({}, 1);
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.useImmunity }));
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.keepIt }));
    expect(spendImmunity).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.useImmunity }));
    await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.spendIt }));
    expect(spendImmunity).toHaveBeenCalledWith('a1');
  });
});

it('wears hazard tape when overdue or missed, and offers no tick once missed', async () => {
  await show({ status: 'overdue', dueAt: new Date('2026-10-20T19:00:00Z') });
  expect(screen.getByTestId('hazard-tape', HIDDEN)).toBeTruthy();
  expect(screen.getByRole('button', { name: JOHN_COPY.markDone })).toBeOnTheScreen();

  await show({ status: 'missed', outcome: 'missed' });
  expect(screen.getByTestId('hazard-tape', HIDDEN)).toBeTruthy();
  expect(screen.queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();
});

it('says when a tick stands, and lets you take it back meanwhile', async () => {
  await show({ status: 'checking', doneAt: NOW, standsAt: new Date('2026-10-22T12:00:00Z') });
  expect(screen.getByText('Done, being checked')).toBeOnTheScreen();
  expect(screen.getByText(/^Stands in .* unless someone disputes it\.$/)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: JOHN_COPY.markDone })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: JOHN_COPY.undo }));
  expect(undoDone).toHaveBeenCalledWith('a1');
});

it("shows a dispute and its votes on your John", async () => {
  await show({
    status: 'disputed',
    doneAt: NOW,
    dispute: {
      id: 'd1',
      assignmentId: 'a1',
      raisedBy: 'u2',
      reason: 'Still full',
      closesAt: new Date('2026-10-22T12:00:00Z'),
      uphold: 1,
      reject: 0,
      myVote: null,
    },
  });
  expect(screen.getByText('Disputed: “Still full”')).toBeOnTheScreen();
  expect(screen.getByText(/^1 say not done, 0 say fine · closes /)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: JOHN_COPY.undo })).toBeNull();
});

it('says when time away moved it earlier, until it is done', async () => {
  await show({ movedFrom: new Date('2026-10-24T09:00:00Z') });
  expect(screen.getByTestId('due-before-you-go')).toHaveTextContent(/^Due before you go: it was due sat/i);

  await show({ movedFrom: new Date('2026-10-24T09:00:00Z'), status: 'done', outcome: 'done' });
  expect(screen.queryByTestId('due-before-you-go')).toBeNull();
});
