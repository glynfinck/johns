import { noticeToShow, type ClosedNotices, type Notice } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { closedNotices, closeNotice, fetchNotices, lastNotices } from '@/api/notices';
import { useNow } from '@/hooks/use-now';

/** Every five minutes, and when the app comes back to the front. */
const EVERY = 5 * 60_000;

/**
 * The one notice to show at the top of the app, or that Jonz can't be
 * reached. While the API doesn't answer, the notices last seen stay up.
 */
export function useNotices(): {
  notice: Notice | null;
  unreachable: boolean;
  close: (id: string) => void;
  retry: () => void;
} {
  const query = useQuery({
    queryKey: ['notices'],
    queryFn: fetchNotices,
    staleTime: EVERY,
    refetchInterval: EVERY,
    retry: 2,
  });
  const [closed, setClosed] = useState<ClosedNotices>(closedNotices);
  const now = useNow();
  const notices = query.data ?? lastNotices();
  const notice = noticeToShow(notices, closed, now);

  const close = useCallback((id: string) => setClosed(closeNotice(id, notices, new Date())), [notices]);
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  return { notice, unreachable: query.isError, close, retry };
}
