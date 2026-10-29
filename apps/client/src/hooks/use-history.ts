import { useInfiniteQuery } from '@tanstack/react-query';

import { HISTORY_PAGE, loadHistory } from '@/api/history';
import { historyKey } from '@/hooks/keys';

/**
 * History, a page at a time, newest first: `fetchNextPage` reads the moves
 * older than the last one shown. Under the house, so every move (an undo
 * included) reads it again.
 */
export function useHistory(houseId: string) {
  return useInfiniteQuery({
    queryKey: historyKey(houseId),
    queryFn: ({ pageParam }) => loadHistory(houseId, pageParam ?? undefined),
    initialPageParam: null as Date | null,
    getNextPageParam: (last) => (last.length < HISTORY_PAGE ? null : last[last.length - 1].at),
  });
}
