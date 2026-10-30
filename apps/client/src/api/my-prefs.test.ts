import { saveMyPrefs } from './my-prefs';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

it('saves your days, best time and Johns through save_prefs', async () => {
  await saveMyPrefs('h1', { days: [3, 6], bestTime: 'morning', rather: { j1: 1, j2: -1 } });
  expect(rpc).toHaveBeenCalledWith('save_prefs', { p_house: 'h1', p_days: [3, 6], p_best_time: 'morning', p_rather: { j1: 1, j2: -1 } });
  await saveMyPrefs('h1', { days: [], bestTime: null, rather: {} });
  expect(rpc).toHaveBeenLastCalledWith('save_prefs', { p_house: 'h1', p_days: [], p_best_time: null, p_rather: {} });
});

it("says the database's refusal in words", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'bad_prefs', code: 'P0001' } });
  await expect(saveMyPrefs('h1', { days: [], bestTime: null, rather: {} })).rejects.toThrow('Those didn’t save.');
});
