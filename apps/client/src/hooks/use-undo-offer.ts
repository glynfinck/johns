import { HISTORY_COPY, type ActionKind } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { undoAction, undoLatest } from '@/api/history';
import { useToastIfAny } from '@/components/toast';
import { houseKey } from '@/hooks/keys';

/**
 * After a move: say it was done, with Undo for the toast's ten seconds.
 * Undo takes back your latest move of that kind about `about` (the John,
 * the dispute, the housemate) and reads the house again; a refusal is the
 * next toast. Older moves are undone from History. A reset, which isn't
 * one of your own moves on a John, passes its action instead.
 */
export function useUndoOffer(houseId: string) {
  const toast = useToastIfAny();
  const client = useQueryClient();
  return useCallback(
    (message: string, kind: ActionKind | { action: string }, about?: string) => {
      toast?.show(message, {
        label: HISTORY_COPY.undo,
        onPress: () => {
          (typeof kind === 'string' ? undoLatest(kind, about) : undoAction(kind.action)).then(
            () => {
              void client.invalidateQueries({ queryKey: houseKey(houseId) });
              toast.show(HISTORY_COPY.wasUndone);
            },
            (reason: unknown) => toast.show(reason instanceof Error ? reason.message : String(reason)),
          );
        },
      });
    },
    [toast, client, houseId],
  );
}
