import type { HouseRules } from '@app/core';

import { confirmPayment, loadStake } from './stake';
import { supabase } from './supabase';

const mockAnswers: Record<string, { data: unknown; error: unknown }> = {};
const mockCalls: [string, string, unknown[]][] = [];

jest.mock('./supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order']) {
        builder[method] = jest.fn((...args: unknown[]) => {
          mockCalls.push([table, method, args]);
          return builder;
        });
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(mockAnswers[table] ?? { data: [], error: null }).then(resolve, reject);
      return builder;
    }),
  },
}));

const rpc = supabase.rpc as unknown as jest.Mock;
const RULES: HouseRules = {
  timezone: 'Europe/London',
  currency: 'GBP',
  weekStarts: 1,
  stakeMinor: 2000,
  lateForfeitMinor: 100,
  missedForfeitMinor: 300,
  disputeHours: 24,
};
const row = (id: number, user_id: string, kind: string, amount_minor: number, month: string) => ({
  id,
  user_id,
  kind,
  amount_minor,
  month,
  counterparty: null,
  created_at: '2026-10-10T12:00:00Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  for (const key of Object.keys(mockAnswers)) delete mockAnswers[key];
});

describe('loadStake', () => {
  it("builds the Stake from the house's ledger and its closed months", async () => {
    mockAnswers.ledger = {
      data: [row(2, 'ava', 'forfeit', -300, '2026-10'), row(1, 'ava', 'forfeit', -400, '2026-09'), row(0, 'ben', 'share', 400, '2026-09')],
      error: null,
    };
    mockAnswers.month_closes = { data: [{ month: '2026-09' }], error: null };
    const stake = await loadStake('h1', RULES, ['ava', 'ben'], new Date('2026-10-21T12:00:00Z'));
    expect(stake.month).toBe('2026-10');
    expect(stake.projection.find((p) => p.userId === 'ava')).toMatchObject({ forfeited: 300, net: -300 });
    expect(stake.transfers).toEqual([{ from: 'ava', to: 'ben', amount: 400 }]);
    expect(mockCalls).toContainEqual(['ledger', 'eq', ['house_id', 'h1']]);
    expect(mockCalls).toContainEqual(['ledger', 'order', ['created_at', { ascending: false }]]);
  });

  it('fails when the ledger or the closed months cannot be read', async () => {
    mockAnswers.ledger = { data: null, error: new Error('offline') };
    await expect(loadStake('h1', RULES, ['ava'], new Date())).rejects.toThrow('offline');
    mockAnswers.ledger = { data: [], error: null };
    mockAnswers.month_closes = { data: null, error: new Error('still offline') };
    await expect(loadStake('h1', RULES, ['ava'], new Date())).rejects.toThrow('still offline');
  });
});

describe('confirmPayment', () => {
  it('records the payment through confirm_payment, and says why when refused', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await confirmPayment('h1', 'ava', 400);
    expect(rpc).toHaveBeenCalledWith('confirm_payment', { p_house: 'h1', p_from: 'ava', p_amount: 400 });

    rpc.mockResolvedValue({ data: null, error: { message: 'more_than_owed', code: 'P0001' } });
    await expect(confirmPayment('h1', 'ava', 9999)).rejects.toThrow("That's more than is owed.");
  });
});
