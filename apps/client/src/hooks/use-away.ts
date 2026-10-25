import { useQuery } from '@tanstack/react-query';

import { loadAway } from '@/api/away';
import type { HouseSnapshot } from '@/api/board';
import { awayKey } from '@/hooks/keys';

/** The house's time away, once the house itself has been read (today is in its zone). */
export function useAway(houseId: string, snapshot: HouseSnapshot | undefined) {
  return useQuery({
    queryKey: awayKey(houseId),
    queryFn: () => loadAway(houseId, snapshot!.rules.timezone, new Date()),
    enabled: snapshot !== undefined,
  });
}
