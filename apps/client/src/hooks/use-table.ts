import { useQuery } from '@tanstack/react-query';

import type { HouseSnapshot } from '@/api/board';
import { loadTable } from '@/api/table';
import { tableKey } from '@/hooks/keys';

/**
 * The month's Table and the fair shares, once the house itself has been read
 * (they need its rules and its people). Reading the house again refreshes
 * them too: they sit under its key.
 */
export function useTable(houseId: string, snapshot: HouseSnapshot | undefined) {
  return useQuery({
    queryKey: tableKey(houseId),
    queryFn: () => loadTable(houseId, snapshot!.rules, snapshot!.members.map((m) => m.userId), new Date()),
    enabled: snapshot !== undefined,
  });
}
