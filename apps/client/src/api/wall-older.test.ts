import { supabase } from './supabase';
import { loadWall, loadWallEvents } from './wall';

// The whole Wall's older pages: `loadWall` with a cursor. The chain records
// its calls and answers with what the test sets.
const mockAnswer: { data: unknown; error: unknown } = { data: [], error: null };
const mockCalls: [string, unknown[]][] = [];

jest.mock('./supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'neq', 'or', 'order', 'limit']) {
    builder[method] = jest.fn((...args: unknown[]) => {
      mockCalls.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(mockAnswer).then(resolve, reject);
  return { supabase: { from: jest.fn(() => builder), storage: { from: jest.fn() } } };
});

const event = (id: string, created_at: string) => ({
  id,
  kind: 'joined',
  user_id: 'ben',
  assignment_id: null,
  data: {},
  created_at,
  assignments: null,
  reactions: [],
});

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswer.data = [];
  mockAnswer.error = null;
});

it('reads newest first, with the id settling a tie, and reads no further back than asked', async () => {
  await loadWall('h1', 'ava', 40);
  expect(mockCalls).toContainEqual(['order', ['created_at', { ascending: false }]]);
  expect(mockCalls).toContainEqual(['order', ['id', { ascending: false }]]);
  expect(mockCalls).toContainEqual(['limit', [40]]);
  expect(mockCalls.some(([method]) => method === 'or')).toBe(false);
});

it('says where the next page starts when this one came back full', async () => {
  mockAnswer.data = [event('e2', '2026-10-21T12:00:00.5+00:00'), event('e1', '2026-10-20T09:00:00+00:00')];
  expect((await loadWall('h1', 'ava', 2)).older).toEqual({ createdAt: '2026-10-20T09:00:00+00:00', id: 'e1' });
});

it("says there's nothing older once a page comes back short, or empty", async () => {
  mockAnswer.data = [event('e1', '2026-10-20T09:00:00+00:00')];
  expect((await loadWall('h1', 'ava', 2)).older).toBeNull();
  mockAnswer.data = [];
  expect((await loadWall('h1', 'ava', 2)).older).toBeNull();
});

it('reads strictly before the cursor: earlier, or the same instant with a smaller id', async () => {
  await loadWall('h1', 'ava', 40, { createdAt: '2026-10-20T09:00:00.123+00:00', id: 'e1' });
  expect(mockCalls).toContainEqual([
    'or',
    [
      'created_at.lt."2026-10-20T09:00:00.123+00:00",and(created_at.eq."2026-10-20T09:00:00.123+00:00",id.lt.e1)',
    ],
  ]);
});

it("reads House's latest without signing a photo", async () => {
  mockAnswer.data = [{ ...event('e1', '2026-10-20T09:00:00+00:00'), kind: 'done', assignments: { photo_path: 'h1/a1/p.jpg' } }];
  const wall = await loadWallEvents('h1', 'ava', 4);
  expect(wall.events).toHaveLength(1);
  expect(wall.photos).toEqual({});
  expect(mockCalls).toContainEqual(['limit', [4]]);
  expect(supabase.storage.from).not.toHaveBeenCalled();
});
