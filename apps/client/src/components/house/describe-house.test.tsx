import { HOUSE_DRAFT_COPY, NEXT_UP_COPY, starterDraft, tidyDraft, type HouseRules } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { keepDraft, requestDraft } from '@/api/draft';
import { testQueryClient } from '@/testing/query';

import { DescribeHouse } from './describe-house';

jest.mock('@/api/draft', () => ({ keepDraft: jest.fn(), requestDraft: jest.fn() }));
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), router: { dismissTo: jest.fn() } }));

const ask = requestDraft as jest.Mock;
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

function House({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={testQueryClient()}>{children}</QueryClientProvider>;
}

async function open() {
  await render(<DescribeHouse houseId="h1" rules={RULES} groups={[]} people={people} me={ME} />, { wrapper: House });
}

beforeEach(() => {
  jest.clearAllMocks();
  ask.mockResolvedValue({ draft: drafted, source: 'ai' });
  keep.mockResolvedValue(1);
});

it('waits for a sentence before drafting, and says where it goes', async () => {
  await open();
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.draft })).toBeDisabled();
  expect(screen.getByText(HOUSE_DRAFT_COPY.privacy)).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('describe-field'), 'Three of us, two bathrooms');
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.draft })).toBeEnabled();
});

it('shows the draft with every John kept, its note and its groups, and adds only the ones still ticked', async () => {
  await open();
  await fireEvent.changeText(screen.getByTestId('describe-field'), 'Three of us, two bathrooms');
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.draft }));
  expect(ask).toHaveBeenCalledWith('h1', 'Three of us, two bathrooms');
  expect(await screen.findByText(HOUSE_DRAFT_COPY.drafted(2))).toBeTruthy();
  expect(screen.getByTestId('describe-note')).toHaveTextContent('I guessed the bins go out Monday night.');
  expect(screen.getByTestId('draft-group')).toHaveTextContent(/You · waiting for Priya to join/);

  for (const row of screen.getAllByRole('checkbox')) expect(row).toBeChecked();
  await fireEvent.press(screen.getByRole('checkbox', { name: /^Upstairs bathroom/ }));
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.keep(1) }));
  expect(keep).toHaveBeenCalledWith('h1', RULES, drafted, [1], [], expect.any(Date));
  expect(router.dismissTo).toHaveBeenCalledWith('/house/johns');
});

it('starts from a list without asking anyone, and can start again', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('starter-couple'));
  expect(ask).not.toHaveBeenCalled();
  expect(screen.getByText(HOUSE_DRAFT_COPY.fromStarter)).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(starterDraft('couple').johns.length);
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.startAgain }));
  expect(screen.getByTestId('describe-field')).toBeTruthy();
});

it('says when a starter list stood in for the draft', async () => {
  ask.mockResolvedValue({ draft: starterDraft('flat_share'), source: 'starter' });
  await open();
  await fireEvent.changeText(screen.getByTestId('describe-field'), 'Five students, one kitchen');
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.draft }));
  expect(await screen.findByText(HOUSE_DRAFT_COPY.offline)).toBeTruthy();
});

it("says why when the API refuses, and keeps what was written", async () => {
  ask.mockRejectedValue(new Error('That’s enough drafts for one day. Start from a list, or add Johns by hand.'));
  await open();
  await fireEvent.changeText(screen.getByTestId('describe-field'), 'Five students, one kitchen');
  await fireEvent.press(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.draft }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/enough drafts/);
  expect(screen.getByTestId('describe-field').props.value).toBe('Five students, one kitchen');
});

it('can’t add nothing', async () => {
  await open();
  await fireEvent.press(screen.getByTestId('starter-family'));
  for (const row of screen.getAllByRole('checkbox')) await fireEvent.press(row);
  expect(screen.getByRole('button', { name: HOUSE_DRAFT_COPY.keep(0) })).toBeDisabled();
  expect(NEXT_UP_COPY.describe).toBe(HOUSE_DRAFT_COPY.title);
});
