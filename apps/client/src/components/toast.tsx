import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CONTENT_MAX, FONT, GUTTER, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/** How long a toast stays: long enough to read a sentence. */
export const TOAST_MS = 4000;

/** How long a toast with a button stays: long enough to read it and reach the button. */
export const TOAST_ACTION_MS = 10000;

/** A toast's one button: Undo, after a move. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Toasts {
  /**
   * Say something short at the bottom of the screen ("Vote counted."); it
   * goes by itself. With an action ("Undo") it stays TOAST_ACTION_MS and
   * goes as soon as the button is pressed.
   */
  show: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<Toasts | null>(null);

/** The house's toasts, or null outside a ToastProvider (a screen tested on its own). */
export function useToastIfAny(): Toasts | null {
  return useContext(ToastContext);
}

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
  const [toast, setToast] = useState<{ message: string; action?: ToastAction; serial: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? TOAST_ACTION_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = useCallback((message: string, action?: ToastAction) => {
    // A new message starts its own time, even when it says the same thing.
    setToast((was) => ({ message, action, serial: (was?.serial ?? 0) + 1 }));
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
              <Text style={[type.body, styles.message, { color: colors.background }]}>{toast.message}</Text>
              {toast.action ? (
                <Pressable
                  role="button"
                  accessibilityLabel={`${toast.action.label}: ${toast.message}`}
                  hitSlop={SPACE.sm}
                  onPress={() => {
                    const press = toast.action!.onPress;
                    setToast(null);
                    press();
                  }}
                  style={styles.action}
                  testID="toast-action"
                >
                  <Text style={[type.rowTitle, styles.actionLabel, { color: colors.background }]}>{toast.action.label}</Text>
                </Pressable>
              ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
  },
  message: { flexShrink: 1 },
  // A thumb's height, though the toast is shorter: hitSlop makes up the rest.
  action: { minHeight: TAP - 2 * SPACE.sm, justifyContent: 'center' },
  actionLabel: { fontFamily: FONT.extrabold, textDecorationLine: 'underline' },
});
