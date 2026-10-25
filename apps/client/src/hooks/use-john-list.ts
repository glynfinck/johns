import { useQuery } from '@tanstack/react-query';

import { loadJohnList } from '@/api/settings';
import { listKey } from '@/hooks/keys';

/** The house's John list and its groups. A move on the house (useMove) reads them again too. */
export function useJohnList(houseId: string) {
  return useQuery({ queryKey: listKey(houseId), queryFn: () => loadJohnList(houseId) });
}
