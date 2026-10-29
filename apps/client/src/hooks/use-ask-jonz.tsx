import { type Href } from 'expo-router';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { WIDE } from '@/theme';

export const AskPanelContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

/** Whether the chat with Jonz is open beside the page; the house layout holds it for every tab. */
export function AskPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <AskPanelContext.Provider value={value}>{children}</AskPanelContext.Provider>;
}

/**
 * How a button opens the chat with Jonz: from WIDE it opens the panel beside
 * the page (the title bar's sparkles open and close it); on a phone or a
 * tablet it's the full-screen page, `/house/describe`.
 */
export function useAskJonz(mode: 'open' | 'toggle' = 'open'): { onPress: () => void } | { href: Href } {
  const panel = useContext(AskPanelContext);
  const wide = useWindowDimensions().width >= WIDE;
  if (!panel || !wide) return { href: '/house/describe' };
  return { onPress: () => panel.setOpen(mode === 'toggle' ? !panel.open : true) };
}

/** Whether the panel is open beside the page (never on a phone, where the chat is a page). */
export function useAskPanelOpen(): boolean {
  const panel = useContext(AskPanelContext);
  const wide = useWindowDimensions().width >= WIDE;
  return (panel?.open ?? false) && wide;
}
