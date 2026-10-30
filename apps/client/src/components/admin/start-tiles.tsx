import { ADMIN_COPY, NOTICE_KINDS, type NoticeKind } from '@app/core';
import { GiftIcon, NewspaperIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GROUP_RADIUS, SPACE, TAP, useTheme } from '@/theme';

const ICON: Record<NoticeKind, LucideIcon> = { status: TriangleAlertIcon, offer: GiftIcon, news: NewspaperIcon };

/**
 * The ways in to a new notice, named by what's happening rather than by a
 * button that says New: Something's wrong (in hazard, first), An offer,
 * News. Each opens the editor with its kind set.
 */
export function StartTiles({ chosen, onStart }: { chosen: NoticeKind | null; onStart: (kind: NoticeKind) => void }) {
  return (
    <View style={styles.row} testID="start-tiles">
      {NOTICE_KINDS.map((kind) => (
        <Tile key={kind} kind={kind} chosen={chosen === kind} onPress={() => onStart(kind)} />
      ))}
    </View>
  );
}

function Tile({ kind, chosen, onPress }: { kind: NoticeKind; chosen: boolean; onPress: () => void }) {
  const { colors, type } = useTheme();
  const [pressed, setPressed] = useState(false);
  const Icon = ICON[kind];
  const { title, meta } = ADMIN_COPY.start[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.tile,
        { backgroundColor: chosen || pressed ? colors.secondary : colors.card },
        chosen && { borderColor: colors.foreground },
      ]}
      testID={`start-${kind}`}
    >
      <Icon size={22} strokeWidth={2.5} color={kind === 'status' ? colors.hazard : colors.foreground} aria-hidden />
      <Text style={[type.rowTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[type.meta, { color: colors.mutedForeground }]}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 2 * TAP,
    padding: SPACE.md,
    gap: SPACE.xs,
    borderRadius: GROUP_RADIUS,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
