import { toggled, type ReactionKind } from '@app/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { loadWall, setReaction, type Wall } from '@/api/wall';
import { wallKey } from '@/hooks/keys';

/** The house's Wall, read once and kept with the house's other reads. */
export function useWall(houseId: string, userId: string) {
  return useQuery({ queryKey: wallKey(houseId), queryFn: () => loadWall(houseId, userId) });
}

/**
 * Reacting to an event shows at once, then the database is told; if it says
 * no, the Wall goes back as it was and `problem` says why.
 */
export function useReact(houseId: string, userId: string) {
  const client = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const key = wallKey(houseId);

  const mutation = useMutation({
    mutationFn: ({ eventId, kind, on }: { eventId: string; kind: ReactionKind; on: boolean }) =>
      setReaction(eventId, userId, kind, on),
    onMutate: async ({ eventId, kind }) => {
      setProblem(null);
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<Wall>(key);
      client.setQueryData<Wall>(key, (wall) =>
        wall && {
          ...wall,
          events: wall.events.map((e) => (e.id === eventId ? { ...e, reactions: toggled(e.reactions, kind) } : e)),
        },
      );
      return { before };
    },
    onError: (error, _move, saved) => {
      if (saved?.before) client.setQueryData(key, saved.before);
      setProblem(error.message);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });

  return {
    react: (eventId: string, kind: ReactionKind, on: boolean) => mutation.mutate({ eventId, kind, on }),
    problem,
  };
}
