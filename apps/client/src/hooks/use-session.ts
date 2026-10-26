import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSession, onSessionChange } from '@/api/auth';

/**
 * The current Supabase session, kept up to date as the user signs in and
 * out, and whether one `ended` here: signed out (or run out) in this app,
 * rather than nobody having signed in yet.
 */
export function useSession(): { session: Session | null; loading: boolean; ended: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let active = true;
    let had = false;
    function take(next: Session | null) {
      if (!active) return;
      if (next) had = true;
      setEnded(had && !next);
      setSession(next);
    }
    getSession()
      .then(take)
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = onSessionChange(take);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, loading, ended };
}
