import type { Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSession, onSessionChange } from '@/api/auth';

import { useSession } from './use-session';

jest.mock('@/api/auth', () => ({ getSession: jest.fn(), onSessionChange: jest.fn() }));

const SESSION = { user: { id: 'user-1' } } as Session;
let changed: (session: Session | null) => void = () => undefined;

beforeEach(() => {
  (onSessionChange as jest.Mock).mockImplementation((callback: typeof changed) => {
    changed = callback;
    return jest.fn();
  });
});

it('says nobody ended a session for a visitor who never signed in', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);
  const { result } = await renderHook(() => useSession());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toEqual({ session: null, loading: false, ended: false });
});

it('says a session ended here once it goes, and not once someone signs in again', async () => {
  (getSession as jest.Mock).mockResolvedValue(SESSION);
  const { result } = await renderHook(() => useSession());
  await waitFor(() => expect(result.current.session).toBe(SESSION));
  expect(result.current.ended).toBe(false);
  await act(async () => changed(null));
  expect(result.current).toMatchObject({ session: null, ended: true });
  await act(async () => changed(SESSION));
  expect(result.current).toMatchObject({ session: SESSION, ended: false });
});
