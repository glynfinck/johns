import { markDone, spendImmunity, spendSwap, undoDone } from './johns';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

it('ticks a John through mark_done, with or without a photo', async () => {
  await markDone('a1');
  expect(rpc).toHaveBeenCalledWith('mark_done', { p_assignment: 'a1', p_photo_path: undefined });
  await markDone('a1', 'h1/a1/receipt.jpg');
  expect(rpc).toHaveBeenLastCalledWith('mark_done', { p_assignment: 'a1', p_photo_path: 'h1/a1/receipt.jpg' });
});

it('takes a tick back, and spends immunity, through their own functions', async () => {
  await undoDone('a1');
  expect(rpc).toHaveBeenCalledWith('undo_done', { p_assignment: 'a1' });
  await spendImmunity('a1');
  expect(rpc).toHaveBeenLastCalledWith('use_immunity', { p_assignment: 'a1' });
});

it('swaps one of yours for a housemate\'s through use_swap', async () => {
  await spendSwap('a1', 'a2');
  expect(rpc).toHaveBeenCalledWith('use_swap', { p_mine: 'a1', p_theirs: 'a2' });
  rpc.mockResolvedValue({ data: null, error: { message: 'no_swap', code: 'P0001' } });
  await expect(spendSwap('a1', 'a2')).rejects.toThrow("You don’t have a swap token.");
});

it("says the database's refusal in words", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'photo_required', code: 'P0001' } });
  await expect(markDone('a1')).rejects.toThrow('This John needs a photo with the tick.');
  rpc.mockResolvedValue({ data: null, error: { message: 'under_dispute', code: 'P0001' } });
  await expect(undoDone('a1')).rejects.toThrow("Someone’s disputing this tick, so it can’t be undone now.");
  rpc.mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
  await expect(spendImmunity('a1')).rejects.toThrow("You can’t do that.");
});
