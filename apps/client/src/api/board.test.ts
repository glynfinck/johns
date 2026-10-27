import { weekWindow } from '@app/core';

import { loadHouse } from './board';
import { supabase } from './supabase';

// Each table answers with what the test sets in `mockRows`; every builder
// method records its call and hands the builder back, as supabase-js does.
const mockRows: Record<string, { data: unknown; error: unknown }> = {};
const mockCalls: Record<string, [string, unknown[]][]> = {};

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      const result = () => Promise.resolve(mockRows[table] ?? { data: null, error: null });
      const record = (method: string) =>
        jest.fn((...args: unknown[]) => {
          (mockCalls[table] ??= []).push([method, args]);
          return builder;
        });
      const builder: Record<string, unknown> = {
        select: record('select'),
        eq: record('eq'),
        neq: record('neq'),
        not: record('not'),
        is: record('is'),
        order: record('order'),
        single: () => result(),
        maybeSingle: () => result(),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return builder;
    }),
  },
}));

const NOW = new Date('2026-10-21T12:00:00Z');

const HOUSE = {
  id: 'h1',
  name: 'Flat 3',
  join_code: 'AB3DEF7H',
  first_dealt_at: '2026-10-01T09:00:00Z',
  away_makeup: 100,
  timezone: 'Europe/London',
  currency: 'GBP',
  week_starts: 1,
  stake_minor: 2000,
  late_forfeit_minor: 100,
  missed_forfeit_minor: 300,
  dispute_hours: 24,
};

const WEEK = { id: 'w1', starts_on: '2026-10-19', starts_at: '2026-10-18T23:00:00Z', ends_at: '2026-10-25T23:00:00Z' };

function calls(table: string, method: string) {
  return (mockCalls[table] ?? []).filter(([m]) => m === method).map(([, args]) => args);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockRows)) delete mockRows[key];
  for (const key of Object.keys(mockCalls)) delete mockCalls[key];
  mockRows.houses = { data: HOUSE, error: null };
  mockRows.members = {
    data: [
      { user_id: 'u1', role: 'admin', streak: 3, immunity_tokens: 1, swap_tokens: 0, profiles: { display_name: 'Priya' } },
      { user_id: 'u2', role: 'member', streak: 0, immunity_tokens: 0, swap_tokens: 1, profiles: null },
    ],
    error: null,
  };
  mockRows.weeks = { data: WEEK, error: null };
  mockRows.assignments = { data: [{ id: 'a1' }], error: null };
  mockRows.disputes = { data: [{ id: 'd1' }], error: null };
  mockRows.on_call = { data: [{ john_id: 'j9', user_id: 'u2', johns: { name: 'Bins', category: 'bins' } }], error: null };
});

it('reads the house, its people and this week in one go', async () => {
  const snapshot = await loadHouse('h1', NOW);

  expect(snapshot.house).toEqual({ id: 'h1', name: 'Flat 3', joinCode: 'AB3DEF7H', everDealt: true, awayMakeup: 100 });
  expect(snapshot.rules).toMatchObject({ timezone: 'Europe/London', currency: 'GBP', weekStarts: 1, disputeHours: 24 });
  expect(snapshot.members).toEqual([
    { userId: 'u1', name: 'Priya', role: 'admin', streak: 3, immunityTokens: 1, swapTokens: 0 },
    { userId: 'u2', name: 'Housemate', role: 'member', streak: 0, immunityTokens: 0, swapTokens: 1 },
  ]);
  expect(snapshot.week).toEqual(WEEK);
  // This week's, then any flag from last week still open: the mock answers both reads alike.
  expect(snapshot.assignments).toEqual([{ id: 'a1' }, { id: 'a1' }]);
  expect(snapshot.disputes).toEqual([{ id: 'd1' }]);
  expect(snapshot.onCall).toEqual([{ john_id: 'j9', user_id: 'u2', johns: { name: 'Bins', category: 'bins' } }]);
});

it("asks for the week that holds now in the house's own zone, and only open disputes", async () => {
  await loadHouse('h1', NOW);
  const { startsOn } = weekWindow(NOW, 'Europe/London', 1);
  expect(calls('weeks', 'eq')).toEqual([
    ['house_id', 'h1'],
    ['starts_on', startsOn],
  ]);
  expect(calls('assignments', 'eq')).toEqual([
    ['week_id', 'w1'],
    ['house_id', 'h1'],
  ]);
  // How often each John comes round rides along, for the John sheet.
  expect(calls('assignments', 'select')).toEqual([['*, johns(every_weeks)'], ['*, johns(every_weeks)']]);
  // A flag from an earlier week that hasn't settled stays its holder's.
  expect(calls('assignments', 'neq')).toEqual([['week_id', 'w1']]);
  expect(calls('assignments', 'not')).toEqual([['flagged_at', 'is', null]]);
  expect(calls('assignments', 'is')).toEqual([['outcome', null]]);
  expect(calls('on_call', 'eq')).toEqual([['week_id', 'w1']]);
  expect(calls('disputes', 'is')).toEqual([['resolution', null]]);
  expect(calls('members', 'order')).toEqual([['joined_at']]);
});

it("reads no Johns when this week hasn't been dealt", async () => {
  mockRows.weeks = { data: null, error: null };
  mockRows.houses = { data: { ...HOUSE, first_dealt_at: null }, error: null };
  const snapshot = await loadHouse('h1', NOW);
  expect(snapshot).toMatchObject({ week: null, assignments: [], disputes: [], onCall: [], house: { everDealt: false } });
  expect(supabase.from).not.toHaveBeenCalledWith('assignments');
  expect(supabase.from).not.toHaveBeenCalledWith('disputes');
});

it.each(['houses', 'members', 'weeks', 'assignments', 'disputes', 'on_call'])('fails when %s cannot be read', async (table) => {
  mockRows[table] = { data: null, error: new Error(`${table} offline`) };
  await expect(loadHouse('h1', NOW)).rejects.toThrow(`${table} offline`);
});
