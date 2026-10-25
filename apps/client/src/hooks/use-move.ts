import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { houseKey } from '@/hooks/keys';

/**
 * Run one move on a house (a tick, an undo), and afterwards read the house
 * again so every screen shows what the database now says. `problem` is the
 * sentence to show when the database refused.
 */
export function useMove(houseId: string) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = useCallback(
    async (move: () => Promise<unknown>): Promise<boolean> => {
      setPending(true);
      setProblem(null);
      try {
        await move();
        await client.invalidateQueries({ queryKey: houseKey(houseId) });
        return true;
      } catch (reason) {
        setProblem(reason instanceof Error ? reason.message : String(reason));
        return false;
      } finally {
        setPending(false);
      }
    },
    [client, houseId],
  );

  return { pending, problem, run };
}
