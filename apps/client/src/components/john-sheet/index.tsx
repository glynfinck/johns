import { FOCUS_SHELL_COPY } from '@app/core';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { Sheet } from '@/components/sheet';
import { useHouse } from '@/hooks/use-house';

import { JohnSheetBody, type JohnSheetContext, type JohnSheetFocus } from './body';

export { JohnSheetBody, JohnSheetHeader, type JohnSheetContext, type JohnSheetFocus } from './body';

interface JohnSheetApi {
  /** Open the sheet on one John (an assignment's id), optionally at what it was opened for. */
  open: (assignmentId: string, focus?: JohnSheetFocus) => void;
  close: () => void;
}

const JohnSheetApiContext = createContext<JohnSheetApi | null>(null);

/** Open any John's sheet from anywhere in the house: `useJohnSheet().open(item.id)`. */
export function useJohnSheet(): JohnSheetApi {
  const api = useContext(JohnSheetApiContext);
  if (!api) throw new Error('useJohnSheet needs a JohnSheetProvider above it (the house layout has one).');
  return api;
}

/**
 * The one John sheet: every John action lives in it, opened by tapping a
 * John anywhere (Today, Week, House). Mounted once, in the house layout. It
 * reads the John live from the house's board by id, so it follows ticks and
 * votes as they land, and puts itself away if the John goes (a re-deal).
 */
export function JohnSheetProvider({ houseId, userId, children }: { houseId: string; userId: string; children: ReactNode }) {
  const { view } = useHouse(houseId, userId);
  const [shown, setShown] = useState<{ id: string; focus: JohnSheetFocus | null } | null>(null);

  const open = useCallback((id: string, focus?: JohnSheetFocus) => setShown({ id, focus: focus ?? null }), []);
  const close = useCallback(() => setShown(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  const item = shown && view ? (view.board.items.find((i) => i.id === shown.id) ?? null) : null;
  // Asked for a John the board doesn't have (any more, after a re-deal):
  // put the sheet away, so it stays shut should that id come back. (Set
  // while rendering, as React suggests for state that follows other state.)
  if (shown !== null && view !== null && item === null) setShown(null);

  let body: ReactNode = null;
  if (item && view && shown) {
    const members = view.snapshot.members;
    const context: JohnSheetContext = {
      houseId,
      userId,
      zone: view.snapshot.rules.timezone,
      rules: view.snapshot.rules,
      now: view.now,
      nameOf: (id) => members.find((m) => m.userId === id)?.name ?? FOCUS_SHELL_COPY.formerHousemate,
      me: view.me,
      board: view.board,
      focus: shown.focus,
      close,
    };
    // Keyed by the John and what it was opened for, so what one John's sheet
    // had under way (a swap, a dispute's words) never carries to the next.
    body = <JohnSheetBody key={`${item.id}:${shown.focus ?? ''}`} item={item} context={context} />;
  }

  return (
    <JohnSheetApiContext.Provider value={api}>
      {children}
      <Sheet visible={item !== null} onClose={close} flush testID="john-sheet">
        {body}
      </Sheet>
    </JohnSheetApiContext.Provider>
  );
}
