import { starterDraft, tidyDraft, type HouseRules } from '@app/core';

import { keepDraft, requestDraft } from './draft';
import { apiPost, ApiRequestError } from './http';
import { addJohns, saveGroup } from './settings';
import { supabase } from './supabase';

jest.mock('./http', () => {
  class ApiRequestError extends Error {
    status: number;
    constructor(message: string, code: number) {
      super(message);
      this.status = code;
    }
  }
  return { apiPost: jest.fn(), ApiRequestError };
});
jest.mock('./settings', () => ({ addJohns: jest.fn(), saveGroup: jest.fn() }));
jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));

const post = apiPost as jest.Mock;
const from = supabase.from as jest.Mock;
const HOUSE = 'c4ca4238-a0b9-4382-8dcc-509a6f75849b';
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
};
const NOW = new Date('2026-10-28T12:00:00Z');

beforeEach(() => jest.clearAllMocks());

describe('requestDraft', () => {
  it("asks the API for the house's draft", async () => {
    const answer = { draft: starterDraft('couple'), source: 'ai' };
    post.mockResolvedValue(answer);
    await expect(requestDraft(HOUSE, 'Me and my partner in a flat')).resolves.toBe(answer);
    expect(post).toHaveBeenCalledWith('/api/setup/draft', { houseId: HOUSE, description: 'Me and my partner in a flat' }, expect.anything());
  });

  it("passes on the API's refusal", async () => {
    post.mockRejectedValue(new ApiRequestError('That’s enough drafts for one day.', 409));
    await expect(requestDraft(HOUSE, 'Five of us')).rejects.toThrow('That’s enough drafts for one day.');
  });

  it('falls back to a starter list that fits when the API can’t be reached', async () => {
    post.mockRejectedValue(new TypeError('Network request failed'));
    await expect(requestDraft(HOUSE, 'Me, my wife and the kids')).resolves.toEqual({ draft: starterDraft('family'), source: 'starter' });
    post.mockRejectedValue(new ApiRequestError('Something went wrong. Try again.', 500));
    await expect(requestDraft(HOUSE, 'Five of us in a flat')).resolves.toEqual({ draft: starterDraft('flat_share'), source: 'starter' });
  });
});

describe('keepDraft', () => {
  const draft = tidyDraft(
    {
      groups: [{ name: 'Upstairs', members: ['me'] }],
      johns: [
        { name: 'Upstairs bathroom', category: 'bathroom', points: 4, group: 'Upstairs' },
        { name: 'Bins', category: 'bins', points: 1 },
        { name: 'Oven', category: 'kitchen', points: 5 },
      ],
    },
    [{ userId: ME, name: 'Glyn' }],
    ME,
  );

  it('makes the groups the kept Johns need, then adds them with their group', async () => {
    from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'g1', name: 'Upstairs' }], error: null }) }),
    });
    await expect(keepDraft(HOUSE, RULES, draft, [0, 1], [], NOW)).resolves.toBe(2);
    expect(saveGroup).toHaveBeenCalledWith(HOUSE, { name: 'Upstairs', members: [ME] });
    const [, , johns] = (addJohns as jest.Mock).mock.calls[0];
    expect(johns.map((j: { name: string; groupId: string | null }) => [j.name, j.groupId])).toEqual([
      ['Upstairs bathroom', 'g1'],
      ['Bins', null],
    ]);
  });

  it("uses the house's own group of that name, and makes none", async () => {
    await keepDraft(HOUSE, RULES, draft, [0], [{ id: 'g9', name: 'upstairs', memberIds: [ME] }], NOW);
    expect(saveGroup).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect((addJohns as jest.Mock).mock.calls[0][2][0].groupId).toBe('g9');
  });
});
