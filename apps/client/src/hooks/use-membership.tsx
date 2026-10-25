import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getMyHouse, type MyHouse } from '@/api/house';
import { useSession } from '@/hooks/use-session';

/** Who is signed in and which house they're in: what every screen's guard needs. */
export interface Membership {
  session: Session | null;
  house: MyHouse | null;
  /** The saved session, or the house for it, is still being read. */
  loading: boolean;
  /** The house couldn't be read (offline, say), so nothing is known. */
  failed: boolean;
  /** Read the house again: after creating or joining one. */
  refresh: () => Promise<void>;
}

const MembershipContext = createContext<Membership | null>(null);

type Known = { userId: string; house: MyHouse | null } | { userId: string; failed: true };

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const [known, setKnown] = useState<Known | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Only the answer for whoever is still signed in counts.
    let active = true;
    getMyHouse(userId)
      .then((house) => {
        if (active) setKnown({ userId, house });
      })
      .catch(() => {
        if (active) setKnown({ userId, failed: true });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setKnown({ userId, house: await getMyHouse(userId) });
    } catch {
      setKnown({ userId, failed: true });
    }
  }, [userId]);

  // What's known only counts for the person signed in now.
  const current = userId && known?.userId === userId ? known : null;
  const value: Membership = {
    session,
    house: current && 'house' in current ? current.house : null,
    loading: sessionLoading || (userId !== undefined && current === null),
    failed: current !== null && 'failed' in current,
    refresh,
  };
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership(): Membership {
  const membership = useContext(MembershipContext);
  if (!membership) throw new Error('useMembership needs a MembershipProvider (the root layout has one).');
  return membership;
}
