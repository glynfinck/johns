import { monthWindow, weekWindow, type HouseRules } from '@app/core';

import { supabase } from './supabase';
import { loadTable } from './table';

// Each table answers with what the test sets; the chain records its calls.
const mockAnswers: Record<string, { data: unknown; error: unknown }[]> = {};
const mockCalls: [string, string, unknown[]][] = [];

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      const answer = () => Promise.resolve(mockAnswers[table]?.shift() ?? { data: [], error: null });
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'in']) {
        builder[method] = jest.fn((...args: unknown[]) => {
          mockCalls.push([table, method, args]);
          return builder;
        });
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => answer().then(resolve, reject);
      return builder;
    }),
  },
}));

const RULES: HouseRules = {
  timezone: 'Europe/London',
  currency: 'GBP',
  weekStarts: 1,
  stakeMinor: 2000,
  lateForfeitMinor: 100,
  missedForfeitMinor: 300,
  disputeHours: 24,
  coverGraceHours: 3,
  lateHours: 24,
};
const NOW = new Date('2026-10-21T12:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  for (const key of Object.keys(mockAnswers)) delete mockAnswers[key];
});

it("scores the house's month, from the Johns due in it", async () => {
  mockAnswers.assignments = [
    {
      data: [
        { user_id: 'ava', points: 4, outcome: 'done', done_at: '2026-10-05T10:00:00Z', due_at: '2026-10-05T19:00:00Z', excused: false, weeks: { ends_at: '2026-10-11T23:00:00Z' } },
        { user_id: 'ben', points: 2, outcome: 'missed', done_at: null, due_at: '2026-10-06T19:00:00Z', excused: false, weeks: { ends_at: '2026-10-11T23:00:00Z' } },
      ],
      error: null,
    },
  ];
  const table = await loadTable('h1', RULES, ['ava', 'ben'], NOW);
  expect(table.month).toBe('2026-10');
  expect(table.monthTable.map((r) => [r.userId, r.points, r.missed])).toEqual([
    ['ava', 4, 0],
    ['ben', 0, 1],
  ]);
  const { startsAt, endsAt } = monthWindow('2026-10', 'Europe/London');
  expect(mockCalls).toContainEqual(['assignments', 'gte', ['due_at', startsAt.toISOString()]]);
  expect(mockCalls).toContainEqual(['assignments', 'lt', ['due_at', endsAt.toISOString()]]);
});

it('balances everyone against their share over the weeks before this one', async () => {
  mockAnswers.weeks = [{ data: [{ id: 'w2' }, { id: 'w1' }], error: null }];
  mockAnswers.assignments = [
    { data: [], error: null },
    {
      data: [
        { week_id: 'w1', user_id: 'ava', points: 2 },
        { week_id: 'w2', user_id: 'ben', points: 6 },
      ],
      error: null,
    },
  ];
  mockAnswers.week_shares = [
    {
      data: [
        { week_id: 'w1', user_id: 'ava', share: 2 },
        { week_id: 'w1', user_id: 'ben', share: 2 },
        { week_id: 'w2', user_id: 'ava', share: 2 },
        { week_id: 'w2', user_id: 'ben', share: 2 },
      ],
      error: null,
    },
  ];
  const table = await loadTable('h1', RULES, ['ava', 'ben'], NOW);
  expect(table.balances.map((b) => [b.userId, b.balance])).toEqual([
    ['ava', -2],
    ['ben', 2],
  ]);
  const { startsOn } = weekWindow(NOW, 'Europe/London', 1);
  expect(mockCalls).toContainEqual(['weeks', 'lt', ['starts_on', startsOn]]);
  expect(mockCalls).toContainEqual(['weeks', 'limit', [12]]);
  expect(mockCalls).toContainEqual(['week_shares', 'in', ['week_id', ['w2', 'w1']]]);
});

it('reads no shares for a house with no weeks behind it, and is level', async () => {
  const table = await loadTable('h1', RULES, ['ava'], NOW);
  expect(supabase.from).not.toHaveBeenCalledWith('week_shares');
  expect(table.balances).toEqual([{ userId: 'ava', balance: 0, weeksToEven: 0 }]);
});

it('fails when any of it cannot be read', async () => {
  mockAnswers.weeks = [{ data: null, error: new Error('offline') }];
  await expect(loadTable('h1', RULES, ['ava'], NOW)).rejects.toThrow('offline');
});
