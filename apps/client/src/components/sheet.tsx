import { SHELL_COPY, withAlpha } from '@app/core';
import { XIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type HostInstance,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Lead } from '@/components/text';
import { GUTTER, INSET, SECTION_GAP, SPACE, useTheme } from '@/theme';

/** How an anchor in a sheet's content says where it is: its view, to be measured against the content. */
const AnchorContext = createContext<((name: string, view: HostInstance) => void) | null>(null);

/**
 * A part of a sheet's content it can open scrolled to (the Sheet's
 * `openAt`), wherever in the content it sits: the John sheet's "If you
 * can't", say, when it opens for that.
 */
export function SheetAnchor({ name, children }: { name: string; children: ReactNode }) {
  const place = useContext(AnchorContext);
  const view = useRef<HostInstance>(null);
  return (
    <View
      ref={view}
      collapsable={false}
      onLayout={() => {
        if (view.current) place?.(name, view.current);
      }}
      testID={`sheet-anchor-${name}`}
    >
      {children}
    </View>
  );
}

/**
 * Something that rises from the bottom over the screen: a form, a menu, the
 * John sheet. A grabber, a 48pt close button, then the content on the
 * pavement. `title` (a Lead, announced as its heading) and `description`
 * head it; leave them out for a sheet that draws its own header. The
 * content sits on the leading edge, like a form on a page, SPACE.md apart;
 * `flush` sets it at the gutter instead, for groups and sections that inset
 * themselves, with SECTION_GAP between them as on a page.
 * The scrim dims the whole window behind it; from WIDE the sheet stays a
 * column in the middle. In the dark, where the scrim and the sheet are
 * nearly one colour, a hairline marks its top edge.
 * `openAt` names a `SheetAnchor` in the content to open scrolled to, when
 * there's more than fits; the sheet scrolls there once each time it opens.
 * Tapping outside it or the close button puts it away. A sheet changes its
 * own content and never opens a second one. `onDismissed` runs once it has
 * gone: on iOS when its slide out has ended (a modal can't rise while
 * another is still going), elsewhere as soon as it closes.
 */
export function Sheet({
  visible,
  title,
  description,
  onClose,
  onDismissed,
  flush = false,
  openAt,
  testID,
  children,
}: {
  visible: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onDismissed?: () => void;
  flush?: boolean;
  /** The `SheetAnchor` to open scrolled to. */
  openAt?: string;
  testID?: string;
  children: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { scroll, content, place, measured, reset } = useOpenAt(openAt);
  // iOS says when the slide out ends (Modal's onDismiss); elsewhere a closed
  // sheet is gone at once, so it says so as it closes.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') onDismissed?.();
    if (!visible) reset();
    wasVisible.current = visible;
  }, [visible, onDismissed, reset]);
  // On the web a closed react-native-web Modal stays mounted until its slide
  // out reports it has ended, and until then it holds on to focus: typing
  // into the next sheet would land on this one's backdrop instead. So on the
  // web a closed sheet goes at once.
  if (Platform.OS === 'web' && !visible) return null;
  // The darker of the two inks, faintly, whichever way the theme is.
  const shade = withAlpha(scheme === 'dark' ? colors.background : colors.foreground, 0.5);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
      <View style={styles.fill}>
        {/* Behind the sheet, the whole window: beside it too, where the sheet is a column. */}
        <Pressable accessibilityLabel={SHELL_COPY.close} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: shade }]} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.rise}>
          <View
            accessibilityViewIsModal
            testID={testID}
            style={[
              styles.sheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACE.xl },
              scheme === 'dark' && [styles.edge, { borderColor: colors.border }],
            ]}
          >
            <View aria-hidden style={[styles.grabber, { backgroundColor: colors.mutedForeground }]} />
            <View style={styles.top}>
              {title ? (
                <Lead header style={styles.title}>
                  {title}
                </Lead>
              ) : (
                <View style={styles.title} />
              )}
              <Button variant="ghost" icon={XIcon} label={SHELL_COPY.close} iconOnly onPress={onClose} testID="sheet-close" />
            </View>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => measured({ height: e.nativeEvent.layout.height })}
              onContentSizeChange={(_width, height) => measured({ content: height })}
              testID="sheet-scroll"
            >
              <View ref={content} collapsable={false} style={[styles.content, flush ? styles.flush : styles.inset]}>
                <AnchorContext.Provider value={place}>
                  {description ? (
                    <View style={flush ? styles.flushText : null}>
                      <Body muted>{description}</Body>
                    </View>
                  ) : null}
                  {children}
                </AnchorContext.Provider>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Opening scrolled to an anchor. Where the anchor sits is measured against
 * the content once it's laid out, and the scroll waits until the sheet also
 * knows how tall it and its content are, so it never goes past the end. It
 * happens once per opening: after that the scroll is the reader's.
 */
function useOpenAt(openAt: string | undefined) {
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<HostInstance>(null);
  const sizes = useRef<{ height?: number; content?: number; anchor?: number; done?: boolean }>({});
  // Stable, for the effect that calls it as the sheet closes.
  const reset = useCallback(() => {
    sizes.current = {};
  }, []);

  function settle() {
    const { height, content: full, anchor, done } = sizes.current;
    if (done || height === undefined || full === undefined || anchor === undefined) return;
    sizes.current.done = true;
    const y = Math.min(Math.max(anchor - SPACE.lg, 0), Math.max(full - height, 0));
    if (y > 0) scroll.current?.scrollTo({ y, animated: false });
  }

  return {
    scroll,
    content,
    place(name: string, view: HostInstance) {
      if (name !== openAt || !content.current || sizes.current.done) return;
      view.measureLayout(content.current, (_x, y) => {
        sizes.current.anchor = y;
        settle();
      });
    },
    measured(size: { height?: number; content?: number }) {
      Object.assign(sizes.current, size);
      settle();
    },
    reset,
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // The sheet at the bottom; taps beside and above it reach the scrim.
  rise: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: {
    width: '100%',
    maxWidth: 512,
    maxHeight: '90%',
    alignSelf: 'center',
    paddingTop: SPACE.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  edge: { borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  // The close button's icon lines up with the content's right edge.
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingLeft: GUTTER + INSET,
    paddingRight: GUTTER + INSET - SPACE.md,
  },
  title: { flex: 1 },
  content: { paddingTop: SPACE.xs },
  inset: { paddingHorizontal: GUTTER + INSET, gap: SPACE.md },
  flush: { paddingHorizontal: GUTTER, gap: SECTION_GAP },
  flushText: { paddingHorizontal: INSET },
});
