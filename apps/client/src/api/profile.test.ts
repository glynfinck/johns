import { renameMe, setMyName } from './profile';
import { supabase } from './supabase';

const mockCalls: [string, unknown[]][] = [];
let mockAnswer: { error: unknown } = { error: null };

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ['update', 'eq']) {
        builder[method] = jest.fn((...args: unknown[]) => {
          mockCalls.push([method, args]);
          return builder;
        });
      }
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockAnswer).then(resolve);
      return builder;
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockAnswer = { error: null };
});

describe('renameMe', () => {
  it('writes your name, tidied, to your own profile', async () => {
    await renameMe('ava', '  Ava B  ');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(mockCalls).toEqual([
      ['update', [{ display_name: 'Ava B' }]],
      ['eq', ['id', 'ava']],
    ]);
  });

  it('refuses an empty or overlong name before writing', async () => {
    await expect(renameMe('ava', '   ')).rejects.toThrow('Names are 1 to 60 characters.');
    await expect(renameMe('ava', 'x'.repeat(61))).rejects.toThrow('Names are 1 to 60 characters.');
    expect(mockCalls).toEqual([]);
  });

  it("says the database's refusal in words", async () => {
    mockAnswer = { error: { code: '42501', message: 'permission denied' } };
    await expect(renameMe('ava', 'Ava')).rejects.toThrow("You can’t do that.");
  });
});

describe('setMyName', () => {
  it('throws the error as it came, for sign-in to log', async () => {
    mockAnswer = { error: { message: 'offline' } };
    await expect(setMyName('ava', 'Ava')).rejects.toEqual({ message: 'offline' });
  });
});
