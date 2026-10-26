import { loadWall, setReaction, signPhoto } from './wall';
import { supabase } from './supabase';

// `from` answers every table with what the test sets; the chain records its calls.
const mockAnswer: { events: { data: unknown; error: unknown }; reactions: { error: unknown } } = {
  events: { data: [], error: null },
  reactions: { error: null },
};
const mockCalls: [string, unknown[]][] = [];

jest.mock('./supabase', () => {
  const chain = (result: () => Promise<unknown>) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'insert', 'delete']) {
      builder[method] = jest.fn((...args: unknown[]) => {
        mockCalls.push([method, args]);
        return builder;
      });
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject);
    return builder;
  };
  return {
    supabase: {
      from: jest.fn((table: string) =>
        chain(() => Promise.resolve(table === 'events' ? mockAnswer.events : mockAnswer.reactions)),
      ),
      storage: { from: jest.fn(() => ({ createSignedUrls: jest.fn() })) },
    },
  };
});

const storage = supabase.storage as unknown as { from: jest.Mock };

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    kind: 'done',
    user_id: 'ben',
    assignment_id: 'a1',
    data: { name: 'Bins' },
    created_at: '2026-10-21T12:00:00Z',
    assignments: { photo_path: 'h1/a1/p.jpg' },
    reactions: [{ user_id: 'ava', kind: 'nice' }],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockAnswer.events = { data: [], error: null };
  mockAnswer.reactions = { error: null };
});

describe('loadWall', () => {
  it("reads the house's latest events, leaving out each week's deal", async () => {
    await loadWall('h1', 'ava');
    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(mockCalls).toContainEqual(['eq', ['house_id', 'h1']]);
    expect(mockCalls).toContainEqual(['neq', ['kind', 'week_dealt']]);
    expect(mockCalls).toContainEqual(['order', ['created_at', { ascending: false }]]);
    expect(mockCalls).toContainEqual(['limit', [60]]);
  });

  it('counts the reactions, and signs each photo for an hour in one go', async () => {
    mockAnswer.events = { data: [event(), event({ id: 'e2' })], error: null };
    const createSignedUrls = jest.fn().mockResolvedValue({ data: [{ path: 'h1/a1/p.jpg', signedUrl: 'https://signed/p' }] });
    storage.from.mockReturnValue({ createSignedUrls });

    const wall = await loadWall('h1', 'ava');
    expect(wall.events[0].reactions.nice).toEqual({ count: 1, mine: true });
    expect(storage.from).toHaveBeenCalledWith('proofs');
    expect(createSignedUrls).toHaveBeenCalledWith(['h1/a1/p.jpg'], 3600);
    expect(wall.photos).toEqual({ 'h1/a1/p.jpg': 'https://signed/p' });
  });

  it('asks for no links when there are no photos, and fails when it cannot read', async () => {
    mockAnswer.events = { data: [event({ assignments: null })], error: null };
    await loadWall('h1', 'ava');
    expect(storage.from).not.toHaveBeenCalled();

    mockAnswer.events = { data: null, error: new Error('offline') };
    await expect(loadWall('h1', 'ava')).rejects.toThrow('offline');
  });
});

describe('signPhoto', () => {
  it('signs one receipt for an hour, and fails when storage says no', async () => {
    const createSignedUrl = jest
      .fn()
      .mockResolvedValueOnce({ data: { signedUrl: 'https://signed/p' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('Object not found') });
    storage.from.mockReturnValue({ createSignedUrl });

    await expect(signPhoto('h1/a1/p.jpg')).resolves.toBe('https://signed/p');
    expect(storage.from).toHaveBeenCalledWith('proofs');
    expect(createSignedUrl).toHaveBeenCalledWith('h1/a1/p.jpg', 3600);
    await expect(signPhoto('h1/a1/gone.jpg')).rejects.toThrow('Object not found');
  });
});

describe('setReaction', () => {
  it('adds your reaction as your own row', async () => {
    await setReaction('e1', 'ava', 'fire', true);
    expect(supabase.from).toHaveBeenCalledWith('reactions');
    expect(mockCalls).toContainEqual(['insert', [{ event_id: 'e1', kind: 'fire' }]]);
  });

  it('takes back only your own', async () => {
    await setReaction('e1', 'ava', 'fire', false);
    expect(mockCalls).toEqual(
      expect.arrayContaining([
        ['delete', []],
        ['eq', ['event_id', 'e1']],
        ['eq', ['user_id', 'ava']],
        ['eq', ['kind', 'fire']],
      ]),
    );
  });

  it("doesn't mind a reaction that's already there, and says why otherwise", async () => {
    mockAnswer.reactions = { error: { message: 'duplicate key value violates unique constraint' } };
    await expect(setReaction('e1', 'ava', 'fire', true)).resolves.toBeUndefined();
    mockAnswer.reactions = { error: { message: 'permission denied', code: '42501' } };
    await expect(setReaction('e1', 'ava', 'fire', true)).rejects.toThrow("You can't do that.");
  });
});
