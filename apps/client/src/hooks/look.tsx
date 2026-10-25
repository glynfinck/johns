import { lookOf, type Look } from '@app/core';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { authStorage } from '@/api/storage';
import { LookContext } from '@/theme';

// The look, kept on this device: in the browser's localStorage under the key
// the web's theme switch (next-themes) used, so a choice made on the old site
// carries over; on a phone, in the same SQLite-backed storage as the session.
const KEY = 'theme';

function saved(): Look {
  try {
    return lookOf(authStorage?.getItem(KEY));
  } catch {
    return 'system';
  }
}

const ChooseContext = createContext<(look: Look) => void>(() => {});

/** Holds the look for every screen, and remembers a new one. */
export function LookProvider({ children }: { children: ReactNode }) {
  const [look, setLook] = useState<Look>(saved);
  const choose = useCallback((next: Look) => {
    setLook(next);
    try {
      authStorage?.setItem(KEY, next);
    } catch {
      // Not remembered (private browsing, say); it still applies until the app closes.
    }
  }, []);
  return (
    <ChooseContext.Provider value={choose}>
      <LookContext.Provider value={look}>{children}</LookContext.Provider>
    </ChooseContext.Provider>
  );
}

/** The look this device chose, and the way to choose another. */
export function useLook(): [Look, (look: Look) => void] {
  return [useContext(LookContext), useContext(ChooseContext)];
}
