import { SHELL_COPY } from '@app/core';
import { router } from 'expo-router';
import { XIcon } from 'lucide-react-native';
import { useContext } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { AskJonz } from '@/components/house/ask-jonz';
import { TitleBar } from '@/components/title-bar';
import { AskPanelContext } from '@/hooks/use-ask-jonz';
import { useTheme, WIDE } from '@/theme';

/** The panel's width beside the page; a little less on a narrow laptop so the page keeps its room. */
const PANEL = 400;
const PANEL_SHARE = 0.36;

/**
 * The chat with Jonz down the right of the window, from WIDE, while it's
 * open: its own title bar with a close button, the chat under it, and the
 * page still there to its left. Closing it ends the chat; anything applied
 * stays applied.
 */
export function AskPanel({ houseId, userId }: { houseId: string; userId: string }) {
  const panel = useContext(AskPanelContext);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  if (!panel?.open || width < WIDE) return null;
  const close = () => panel.setOpen(false);
  return (
    <View
      style={[styles.panel, { width: Math.min(PANEL, width * PANEL_SHARE), borderLeftColor: colors.border }]}
      testID="ask-panel"
    >
      <AskJonz
        houseId={houseId}
        userId={userId}
        bar={(title) => (
          <TitleBar
            title={title}
            right={<Button variant="ghost" icon={XIcon} label={SHELL_COPY.close} iconOnly onPress={close} testID="ask-close" />}
          />
        )}
        onOpenList={() => router.navigate('/house/johns')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderLeftWidth: StyleSheet.hairlineWidth },
});
