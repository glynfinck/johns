import { SHELL_COPY, withAlpha } from '@app/core';
import { XIcon } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Lead } from '@/components/text';
import { GUTTER, INSET, SECTION_GAP, SPACE, useTheme } from '@/theme';

/**
 * Something that rises from the bottom over the screen: a form, a menu, the
 * John sheet. A grabber, a 48pt close button, then the content on the
 * pavement. `title` (a Lead, announced as its heading) and `description`
 * head it; leave them out for a sheet that draws its own header. The
 * content sits on the leading edge, like a form on a page, SPACE.md apart;
 * `flush` sets it at the gutter instead, for groups and sections that inset
 * themselves, with SECTION_GAP between them as on a page.
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
  testID,
  children,
}: {
  visible: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onDismissed?: () => void;
  flush?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  // iOS says when the slide out ends (Modal's onDismiss); elsewhere a closed
  // sheet is gone at once, so it says so as it closes.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);
  // On the web a closed react-native-web Modal stays mounted until its slide
  // out reports it has ended, and until then it holds on to focus: typing
  // into the next sheet would land on this one's backdrop instead. So on the
  // web a closed sheet goes at once.
  if (Platform.OS === 'web' && !visible) return null;
  // The darker of the two inks, faintly, whichever way the theme is.
  const shade = withAlpha(scheme === 'dark' ? colors.background : colors.foreground, 0.5);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable accessibilityLabel={SHELL_COPY.close} onPress={onClose} style={[styles.fill, { backgroundColor: shade }]} />
        <View
          accessibilityViewIsModal
          testID={testID}
          style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACE.xl }]}
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
            contentContainerStyle={[styles.content, flush ? styles.flush : styles.inset]}
            keyboardShouldPersistTaps="handled"
          >
            {description ? (
              <View style={flush ? styles.flushText : null}>
                <Body muted>{description}</Body>
              </View>
            ) : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    width: '100%',
    maxWidth: 512,
    maxHeight: '90%',
    alignSelf: 'center',
    paddingTop: SPACE.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
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
