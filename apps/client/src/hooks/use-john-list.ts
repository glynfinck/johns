import { useQuery } from '@tanstack/react-query';

import { loadJohnList } from '@/api/settings';
import { listKey } from '@/hooks/keys';

/**
 * The house's John list and its groups. A move on the house (useMove) reads
 * them again too. `enabled` false leaves it unread, for a screen that only
 * needs it sometimes (Week, before the first deal).
 */
export function useJohnList(houseId: string, enabled = true) {
  return useQuery({ queryKey: listKey(houseId), queryFn: () => loadJohnList(houseId), enabled });
}
