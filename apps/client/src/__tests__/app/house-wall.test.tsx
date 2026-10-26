import { FOCUS_SHELL_COPY, REACTION_LABEL, SECTION_LABEL, WALL_COPY, wallEvents } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { loadHouse } from '@/api/board';
import { catchUp } from '@/api/house';
import { loadWall, setReaction } from '@/api/wall';
import WallScreen from '@/app/(house)/house/wall';
import { snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/wall', () => ({ loadWall: jest.fn(), setReaction: jest.fn() }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const EVENTS = wallEvents(
  [
    {
      id: 'e1',
      kind: 'done',
      user_id: 'sam',
      assignment_id: 'a4',
      data: { name: 'Clean the bath' },
      created_at: ago(5),
      assignments: { photo_path: 'h1/a4/p.jpg' },
      reactions: [{ user_id: 'sam', kind: 'fire' }],
    },
    {
      id: 'e2',
      kind: 'joined',
      user_id: 'sam',
      assignment_id: null,
      data: {},
      created_at: ago(60),
      assignments: null,
      reactions: [],
    },
  ],
  'priya',
);

async function open() {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      'house/wall': WallScreen,
    },
    { initialUrl: '/house/wall' },
  );
  await screen.findByText(WALL_COPY.title);
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(snapshot());
  (catchUp as jest.Mock).mockResolvedValue(false);
  (loadWall as jest.Mock).mockResolvedValue({ events: EVENTS, photos: { 'h1/a4/p.jpg': 'https://signed/p' } });
});

it('tells what the house did, in words, with the photo', async () => {
  await open();
  const [tick, joined] = await screen.findAllByTestId('wall-event');
  expect(tick).toHaveTextContent(/Sam did Clean the bath\./);
  expect(within(tick).getByTestId('wall-photo')).toHaveProp('source', { uri: 'https://signed/p' });
  expect(within(tick).getByLabelText(WALL_COPY.photoOf('Clean the bath'))).toBeOnTheScreen();
  expect(joined).toHaveTextContent(/Sam moved in\./);
  expect(loadWall).toHaveBeenCalledWith('h1', 'priya');
});

it('offers reactions only on how a John went', async () => {
  await open();
  const [tick, joined] = await screen.findAllByTestId('wall-event');
  expect(within(tick).getByRole('button', { name: REACTION_LABEL.fire })).toHaveTextContent('1');
  expect(within(joined).queryByRole('button', { name: REACTION_LABEL.fire })).toBeNull();
});

it('shows your reaction at once, then tells the database', async () => {
  let answer: () => void = () => undefined;
  (setReaction as jest.Mock).mockReturnValue(new Promise<void>((resolve) => (answer = resolve)));
  await open();
  const [tick] = await screen.findAllByTestId('wall-event');
  await fireEvent.press(within(tick).getByRole('button', { name: REACTION_LABEL.nice }));
  // The database hasn't answered yet; the Wall already shows it.
  await waitFor(() => expect(within(tick).getByRole('button', { name: REACTION_LABEL.nice })).toHaveTextContent('1'));
  expect(within(tick).getByRole('button', { name: REACTION_LABEL.nice })).toBeSelected();
  expect(setReaction).toHaveBeenCalledWith('e1', 'priya', 'nice', true);
  answer();
});

it('puts it back and says why when the database says no', async () => {
  (setReaction as jest.Mock).mockRejectedValue(new Error("You can't do that."));
  await open();
  const [tick] = await screen.findAllByTestId('wall-event');
  await fireEvent.press(within(tick).getByRole('button', { name: REACTION_LABEL.fire }));
  expect(setReaction).toHaveBeenCalledWith('e1', 'priya', 'fire', true);
  expect(await screen.findByRole('alert')).toHaveTextContent("You can't do that.");
  await waitFor(() => expect(within(tick).getByRole('button', { name: REACTION_LABEL.fire })).toHaveTextContent('1'));
});

it('says what lands here before anything has', async () => {
  (loadWall as jest.Mock).mockResolvedValue({ events: [], photos: {} });
  await open();
  expect(await screen.findByText(WALL_COPY.empty)).toBeOnTheScreen();
});

it('sits under a title bar with the way back to House', async () => {
  await open();
  const bar = within(screen.getByTestId('title-bar'));
  expect(bar.getByRole('header', { name: WALL_COPY.title })).toBeOnTheScreen();
  expect(bar.getByRole('button', { name: FOCUS_SHELL_COPY.backTo(SECTION_LABEL.house) })).toBeOnTheScreen();
});
