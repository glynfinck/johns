import { useQuery } from '@tanstack/react-query';

import { movingOn } from '@/api/moving';
import { movingOnKey } from '@/hooks/keys';
import { useMembership } from '@/hooks/use-membership';

/**
 * The house you left most recently, while its John list can still come with
 * you: null when you haven't just left one. Read each time you're between
 * houses, since leaving is what makes it.
 */
export function useMovingOn() {
  const { session } = useMembership();
  const userId = session?.user.id ?? '';
  return useQuery({ queryKey: movingOnKey(userId), queryFn: movingOn, enabled: userId !== '', staleTime: 0 });
}
