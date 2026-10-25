import { useQuery } from '@tanstack/react-query';

import type { HouseSnapshot } from '@/api/board';
import { loadStake } from '@/api/stake';
import { stakeKey } from '@/hooks/keys';

/** The Stake, once the house itself has been read (it needs its rules and its people). */
export function useStake(houseId: string, snapshot: HouseSnapshot | undefined) {
  return useQuery({
    queryKey: stakeKey(houseId),
    queryFn: () => loadStake(houseId, snapshot!.rules, snapshot!.members.map((m) => m.userId), new Date()),
    enabled: snapshot !== undefined,
  });
}
