import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useCatchUp } from '@/hooks/use-house';

/**
 * Pull to refresh for a house screen: catch the house up (which reads it
 * again when the server did anything), or else run `refetch` (what the
 * screen reads besides the house). Catching up as the screen comes into
 * view is part of it. Hand `refreshing` and `pull` to Screen.
 */
export function usePull(houseId: string, refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const freshen = useCatchUp(houseId);
  const pull = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!(await freshen())) await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [freshen, refetch]);
  return { refreshing, pull: () => void pull() };
}

/**
 * Read something again each time the screen comes back into view. For what
 * Realtime doesn't carry (the rules, the John list and its groups, time
 * away, who lives here), which another housemate may have changed while you
 * were elsewhere. `skipFirst` for a read the screen has only just made.
 */
export function useReadOnFocus(refetch: () => unknown, { skipFirst = false }: { skipFirst?: boolean } = {}) {
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seen.current || !skipFirst) void refetch();
      seen.current = true;
    }, [refetch, skipFirst]),
  );
}
