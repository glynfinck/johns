import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * What a screen has already read under `key`, from the cache alone, and
 * followed as it's read again (the John list, the Stake). The sheet never
 * asks the network for it, nor holds a query of its own that a move would
 * have React Query read again.
 */
export function useCached<T>(key: QueryKey): T | undefined {
  const client = useQueryClient();
  const subscribe = useCallback((changed: () => void) => client.getQueryCache().subscribe(changed), [client]);
  return useSyncExternalStore(subscribe, () => client.getQueryData<T>(key));
}
