import { useQuery } from '@tanstack/react-query';

import { loadRecord } from '@/api/record';
import { recordKey } from '@/hooks/keys';

/** The track record's rows. Reading the house again refreshes them too: they sit under its key. */
export function useRecord(houseId: string) {
  return useQuery({ queryKey: recordKey(houseId), queryFn: () => loadRecord(houseId) });
}
