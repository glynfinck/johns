import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/wordmark';
import { FONT, SPACE, useTheme } from '@/theme';

/** A phone's strip above every house screen: the mark, and which house this is. */
export function HouseHeader({ houseName }: { houseName: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        {/* The mark keeps to the left of whatever holds it; this holds it centred. */}
        <View>
          <Wordmark size={18} />
        </View>
        <Text numberOfLines={1} style={[styles.house, { color: colors.mutedForeground }]}>
          {houseName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg },
  house: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONT.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
