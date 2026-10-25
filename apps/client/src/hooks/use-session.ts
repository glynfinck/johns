import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSession, onSessionChange } from '@/api/auth';

/** The current Supabase session, kept up to date as the user signs in and out. */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = onSessionChange((next) => setSession(next));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, loading };
}
