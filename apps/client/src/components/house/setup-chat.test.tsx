import { HOUSE_DRAFT_COPY, NEXT_UP_COPY, starterDraft, tidyDraft, type HouseRules } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { keepDraft, sendChat } from '@/api/draft';
import { testQueryClient } from '@/testing/query';

import { SetupChat } from './setup-chat';

jest.mock('@/api/draft', () => ({ keepDraft: jest.fn(), sendChat: jest.fn() }));
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), router: { dismissTo: jest.fn() } }));

const chat = sendChat as jest.Mock;
const keep = keepDraft as jest.Mock;
const ME = '00000000-0000-4000-8000-000000000001';
const RULES: HouseRules = {
  timezone: 'Europe/London',
  currency: 'GBP',
  weekStarts: 1,
  stakeMinor: 0,
  lateForfeitMinor: 0,
  missedForfeitMinor: 0,
  disputeHours: 24,
  coverGraceHours: 3,
  lateHours: 24,
};
const people = [{ userId: ME, name: 'Glyn Finck' }];
const drafted = tidyDraft(
  {
    groups: [{ name: 'Upstairs', members: ['me', 'Priya'] }],
    johns: [
      { name: 'Upstairs bathroom', category: 'bathroom', points: 4, everyWeeks: 1, dueDow: 6, dueTime: '18:00', group: 'Upstairs' },
      { name: 'Bins out', category: 'bins', points: 1, everyWeeks: 1, dueDow: 1, dueTime: '21:00', why: 'collection is Tuesday' },
    ],
    note: 'I guessed the bins go out Monday night.',
  },
  people,
  ME,
);
const HOUSE = 'Three of us, two bathrooms';

function House({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={testQueryClient()}>{children}</QueryClientProvider>;
}

async function open() {
  await render(<SetupChat houseId="h1" rules={RULES} groups={[]} people={people} me={ME} />, { wrapper: House });
}

async function say(text: string) {
  await fireEvent.changeText(screen.getByTestId('chat-input'), text);
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.send }));
}

beforeEach(() => {
  jest.clearAllMocks();
  chat.mockResolvedValue({ reply: 'Here’s a first go.', ask: null, draft: drafted, source: 'ai' });
  keep.mockResolvedValue(1);
});

it('greets with the starter lists, says where messages go, and waits for words before sending', async () => {
  await open();
  expect(screen.getByText(HOUSE_DRAFT_COPY.greeting)).toBeTruthy();
  expect(screen.getByText(HOUSE_DRAFT_COPY.privacy)).toBeTruthy();
  expect(screen.getByTestId('starter-family')).toBeTruthy();
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.send })).toBeDisabled();
  await fireEvent.changeText(screen.getByTestId('chat-input'), HOUSE);
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.send })).toBeEnabled();
});

it('shows the draft in the chat with every John kept, opens it into its groups, and adds only the ones still ticked', async () => {
  await open();
  await say(HOUSE);
  expect(chat).toHaveBeenCalledWith('h1', [{ role: 'user', text: HOUSE }], null);
  expect(await screen.findByText('Here’s a first go.')).toBeTruthy();
  expect(screen.getByTestId('chat-user')).toHaveTextContent(HOUSE);
  expect(screen.getByTestId('draft-note')).toHaveTextContent('I guessed the bins go out Monday night.');
  expect(screen.queryByTestId('starter-family')).toBeNull();

  for (const row of screen.getAllByRole('checkbox')) expect(row).toBeChecked();
  expect(screen.queryByTestId('draft-group')).toBeNull();
  await fireEvent.press(screen.getByRole('checkbox', { name: /^Upstairs bathroom/ }));
  expect(screen.getByText(HOUSE_DRAFT_COPY.draftMeta(1, 2))).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.keep(1) }));
  expect(keep).toHaveBeenCalledWith('h1', RULES, drafted, [1], [], expect.any(Date));
  expect(await screen.findByText(HOUSE_DRAFT_COPY.added(1))).toBeTruthy();
  expect(screen.queryByTestId('chat-input')).toBeNull();
  await fireEvent.press(screen.getByTestId('chat-open-list'));
  expect(router.dismissTo).toHaveBeenCalledWith('/house/johns');
});

it('sends the chat so far and the draft with each change, and keeps the draft when Jonz only talks', async () => {
  await open();
  await say(HOUSE);
  await screen.findByText('Here’s a first go.');
  chat.mockResolvedValue({ reply: 'That’s all of it.', ask: null, draft: null, source: 'ai' });
  await say('Is that all?');
  expect(chat).toHaveBeenLastCalledWith(
    'h1',
    [
      { role: 'user', text: HOUSE },
      { role: 'assistant', text: 'Here’s a first go.' },
      { role: 'user', text: 'Is that all?' },
    ],
    drafted,
  );
  expect(await screen.findByText('That’s all of it.')).toBeTruthy();
  expect(screen.getAllByTestId('draft-card')).toHaveLength(1);
});

it('answers a question with a tap: a quick answer, or a day', async () => {
  chat.mockResolvedValueOnce({ reply: 'Anything nobody gets round to?', ask: { kind: 'choices', options: ['Oven', 'Windows'] }, draft: null, source: 'ai' });
  await open();
  await say(HOUSE);
  await fireEvent.press(await screen.findByRole('button', { name: 'Windows' }));
  expect(chat).toHaveBeenLastCalledWith('h1', expect.arrayContaining([{ role: 'user', text: 'Windows' }]), null);

  chat.mockResolvedValueOnce({ reply: 'Which night are the bins?', ask: { kind: 'day' }, draft: null, source: 'ai' });
  await say('Bins too');
  await fireEvent.press(await screen.findByRole('radio', { name: 'Tuesday' }));
  expect(chat).toHaveBeenLastCalledWith('h1', expect.arrayContaining([{ role: 'user', text: 'Tuesday' }]), drafted);
});

it('starts from a list without asking anyone, and opens it to see every John', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('starter-couple'));
  expect(chat).not.toHaveBeenCalled();
  expect(screen.getByText(HOUSE_DRAFT_COPY.fromStarter)).toBeTruthy();
  const all = starterDraft('couple').johns.length;
  expect(screen.getAllByRole('checkbox')).toHaveLength(Math.min(3, all));
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.seeAll(all) }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(all);
});

it("says why when the API refuses, and puts back what was written", async () => {
  chat.mockRejectedValue(new Error('That’s enough for one day.'));
  await open();
  await say('Five students, one kitchen');
  expect(await screen.findByRole('alert')).toHaveTextContent(/enough for one day/);
  expect(screen.getByTestId('chat-input').props.value).toBe('Five students, one kitchen');
  expect(screen.queryByTestId('chat-user')).toBeNull();
});

it('can’t add nothing', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('starter-family'));
  await fireEvent.press(screen.getByTestId('draft-see-all'));
  for (const row of screen.getAllByRole('checkbox')) await fireEvent.press(row);
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.keep(0) })).toBeDisabled();
  expect(NEXT_UP_COPY.describe).toBe(HOUSE_DRAFT_COPY.title);
});
