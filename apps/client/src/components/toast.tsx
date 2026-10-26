import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';

import { CONTENT_MAX, GUTTER, RADIUS, SPACE, useTheme } from '@/theme';

/** How long a toast stays: long enough to read a sentence. */
export const TOAST_MS = 4000;

interface Toasts {
  /** Say something short at the bottom of the screen ("Vote counted."); it goes by itself. */
  show: (message: string) => void;
}

const ToastContext = createContext<Toasts | null>(null);

/** The house's toasts. ToastProvider (in the house layout) must be above. */
export function useToast(): Toasts {
  const toasts = useContext(ToastContext);
  if (!toasts) throw new Error('useToast needs a ToastProvider above it (the house layout has one).');
  return toasts;
}

/**
 * Short messages at the bottom of the screen, one at a time, each gone after
 * TOAST_MS. The spot is a polite live region (a status, on the web), so a
 * screen reader reads each message out; iOS has no live regions, so it is
 * announced there. `bottom` keeps it clear of the tab bar.
 */
export function ToastProvider({ children, bottom = SPACE.xl }: { children: ReactNode; bottom?: number }) {
  const { colors, type } = useTheme();
  const [toast, setToast] = useState<{ message: string; serial: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((message: string) => {
    // A new message starts its own four seconds, even when it says the same thing.
    setToast((was) => ({ message, serial: (was?.serial ?? 0) + 1 }));
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {/* Always there, so a screen reader is already listening when a message arrives. */}
        <View
          role="status"
          testID="toast-region"
          accessibilityLiveRegion="polite"
          aria-live="polite"
          pointerEvents="box-none"
          style={[styles.layer, { bottom }]}
        >
          {toast ? (
            <View testID="toast" style={[styles.toast, { backgroundColor: colors.foreground }]}>
              <Text style={[type.body, { color: colors.background }]}>{toast.message}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: GUTTER },
  toast: {
    maxWidth: CONTENT_MAX - 2 * GUTTER,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS,
  },
});
