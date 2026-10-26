import { DISPUTE_COPY, dueLabel, JOHN_COPY, STATUS_MARK } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { loadHouse } from '@/api/board';
import { markDone } from '@/api/johns';
import { houseKey } from '@/hooks/keys';
import { assignment, snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

import { JohnSheetProvider, useJohnSheet } from '.';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn(() => Promise.resolve(false)) }));
jest.mock('@/api/johns', () => ({ markDone: jest.fn(), undoDone: jest.fn(), spendImmunity: jest.fn() }));
jest.mock('@/api/disputes', () => ({ castVote: jest.fn(), raiseDispute: jest.fn() }));
jest.mock('@/api/photos', () => ({ pickPhoto: jest.fn(), uploadProof: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

/** Somewhere in the house: buttons that open the sheet on a John, and put it away. */
function Opener() {
  const sheet = useJohnSheet();
  return (
    <>
      {['a1', 'a4', 'gone'].map((id) => (
        <Pressable key={id} accessibilityRole="button" onPress={() => sheet.open(id)}>
          <Text>{`Open ${id}`}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={sheet.close}>
        <Text>Put it away</Text>
      </Pressable>
    </>
  );
}

async function show() {
  const client = testQueryClient();
  await render(
    <QueryClientProvider client={client}>
      <JohnSheetProvider houseId="h1" userId="priya">
        <Opener />
      </JohnSheetProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(loadHouse).toHaveBeenCalled());
  return client;
}

const ticked = new Date(Date.now() - 3_600_000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({
      assignments: [
        assignment(),
        assignment({ id: 'a4', user_id: 'sam', name: 'Clean the bath', category: 'bathroom', points: 4, done_at: ticked }),
      ],
    }),
  );
  (markDone as jest.Mock).mockResolvedValue(undefined);
});

it('opens on a John with its kind, points, name and when it is due', async () => {
  await show();
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open a1' }));
  expect(await screen.findByRole('header', { name: 'Bins out' })).toBeOnTheScreen();
  expect(screen.getByText('Bins & recycling · 2 pts')).toBeOnTheScreen();
  expect(screen.getByTestId('lid-dot', { includeHiddenElements: true })).toBeOnTheScreen();
  // Due in two days, at the same time of day.
  const due = new Date(assignment().due_at);
  expect(screen.getByText(dueLabel(due, new Date(), 'Europe/London'))).toBeOnTheScreen();
});

it('offers the tick on your own open John', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Open a1' }));
  await fireEvent.press(await screen.findByRole('button', { name: JOHN_COPY.markDone }));
  expect(markDone).toHaveBeenCalledWith('a1');
});

it("offers to dispute a housemate's tick, in place", async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Open a4' }));
  expect(await screen.findByRole('header', { name: 'Clean the bath' })).toBeOnTheScreen();
  // Where it has got to, in words after when: the sheet is on the pavement, so no chip.
  expect(screen.getByTestId('john-sheet-when')).toHaveTextContent(new RegExp(`· ${STATUS_MARK.checking.label}$`));
  expect(screen.queryByTestId('status-checking')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: DISPUTE_COPY.open }));
  expect(screen.getByTestId('dispute-reason')).toBeOnTheScreen();
  expect(screen.getByTestId('send-dispute')).toBeOnTheScreen();
});

it('puts itself away', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Open a1' }));
  await screen.findByTestId('john-sheet-body');
  await fireEvent.press(screen.getByRole('button', { name: 'Put it away' }));
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
});

it('opens on nothing for a John the board does not have', async () => {
  await show();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open gone' })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Open gone' }));
  expect(screen.queryByTestId('john-sheet-body')).toBeNull();
});

it('follows the John live, and closes when it goes (a re-deal)', async () => {
  const client = await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Open a1' }));
  await screen.findByRole('header', { name: 'Bins out' });

  // Renamed underneath the open sheet: it reads the new name.
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ assignments: [assignment({ name: 'Bins and recycling' })] }));
  await act(() => client.invalidateQueries({ queryKey: houseKey('h1') }));
  expect(await screen.findByRole('header', { name: 'Bins and recycling' })).toBeOnTheScreen();

  // Re-dealt: the John is gone, and so is the sheet.
  (loadHouse as jest.Mock).mockResolvedValue(snapshot({ assignments: [assignment({ id: 'a9' })] }));
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
