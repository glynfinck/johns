import { settledLine, WALL_COPY, type BoardItem } from '@app/core';
import { Image, StyleSheet } from 'react-native';

import { Body } from '@/components/text';
import { useWall } from '@/hooks/use-wall';
import { RADIUS, useTheme } from '@/theme';

import type { JohnSheetContext } from './body';
import { SheetLines } from './parts';

/** A settled John: what happened, in a sentence, and the photo receipt if there is one. */
export function Settled({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  return (
    <SheetLines>
      <Body testID="settled-line">{settledLine(item, context.members, context.userId, context.rules, context.now)}</Body>
      {item.photoPath ? <Receipt item={item} path={item.photoPath} context={context} /> : null}
    </SheetLines>
  );
}

/**
 * The receipt, from the Wall's read (its photos come signed for an hour).
 * Nothing when the Wall doesn't hold it: an older tick, or a read that
 * failed.
 */
function Receipt({ item, path, context }: { item: BoardItem; path: string; context: JohnSheetContext }) {
  const { colors } = useTheme();
  const wall = useWall(context.houseId, context.userId);
  const url = wall.data?.photos[path];
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={WALL_COPY.photoOf(item.name)}
      resizeMode="cover"
      style={[styles.photo, { borderColor: colors.border }]}
      testID="sheet-photo"
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, maxHeight: 384, borderRadius: RADIUS, borderWidth: 1 },
});
