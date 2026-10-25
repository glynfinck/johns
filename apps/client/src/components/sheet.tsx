import { SHELL_COPY, withAlpha } from '@app/core';
import { XIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Body, Heading } from '@/components/text';
import { RADIUS, SPACE, useTheme } from '@/theme';

/**
 * A form that rises from the bottom over the screen, as the web's sheets do:
 * a title, a sentence on what it does, and the form. Tapping outside it or
 * the close button puts it away.
 */
export function Sheet({
  visible,
  title,
  description,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  // The darker of the two inks, faintly, whichever way the theme is.
  const shade = withAlpha(scheme === 'dark' ? colors.background : colors.foreground, 0.35);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable accessibilityLabel={SHELL_COPY.close} onPress={onClose} style={[styles.fill, { backgroundColor: shade }]} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + SPACE.xl },
          ]}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.top}>
              <Heading level={3} style={styles.title}>
                {title}
              </Heading>
              <Button variant="ghost" icon={XIcon} label={SHELL_COPY.close} iconOnly onPress={onClose} />
            </View>
            {description ? <Body muted>{description}</Body> : null}
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
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: RADIUS * 2,
    borderTopRightRadius: RADIUS * 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: SPACE.xl, gap: SPACE.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.md },
  title: { flex: 1 },
});
