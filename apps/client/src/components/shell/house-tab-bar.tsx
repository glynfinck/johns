import { SECTION_LABEL, SHELL_COPY, type Section } from '@app/core';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarDaysIcon,
  CoinsIcon,
  HouseIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  TrophyIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Wordmark } from '@/components/wordmark';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

const ICON: Record<Section, LucideIcon> = {
  today: ListChecksIcon,
  week: CalendarDaysIcon,
  wall: MessagesSquareIcon,
  table: TrophyIcon,
  stake: CoinsIcon,
  house: HouseIcon,
};

/** What the sidebar says about the house and you; null until the house has been read. */
export interface ShellHouse {
  name: string;
  memberCount: number;
  me: { name: string; streak: number; tokens: number } | null;
}

/**
 * The house's tabs, as the web has them: along the bottom of a phone, one per
 * screen, the current one marked in hi-vis; from laptop width (`wide`), a
 * sidebar of signs with the house above and you below.
 */
export function HouseTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  wide,
  house,
}: BottomTabBarProps & { wide: boolean; house: ShellHouse | null }) {
  const { colors } = useTheme();

  const tabs = state.routes.map((route, index) => {
    const section = route.name as Section;
    const focused = index === state.index;
    const Icon = ICON[section];
    const label = descriptors[route.key]?.options.title ?? SECTION_LABEL[section];
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };
    return wide ? (
      <Pressable
        key={route.key}
        role="tab"
        aria-selected={focused}
        accessibilityLabel={label}
        testID={`tab-${section}`}
        onPress={onPress}
        style={[styles.sign, focused && { backgroundColor: colors.hivis }]}
      >
        <Icon size={18} color={focused ? colors.onHivis : colors.mutedForeground} aria-hidden />
        <Text style={[styles.signLabel, { color: focused ? colors.onHivis : colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    ) : (
      <Pressable
        key={route.key}
        role="tab"
        aria-selected={focused}
        accessibilityLabel={label}
        testID={`tab-${section}`}
        onPress={onPress}
        style={styles.tab}
      >
        {focused ? <View aria-hidden style={[styles.marker, { backgroundColor: colors.hivis }]} /> : null}
        <Icon size={20} strokeWidth={focused ? 2.4 : 1.9} color={focused ? colors.foreground : colors.mutedForeground} aria-hidden />
        <Text style={[styles.tabLabel, { color: focused ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    );
  });

  if (!wide) {
    return (
      <View
        role="tablist"
        style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: colors.card, borderTopColor: colors.border }]}
      >
        {tabs}
      </View>
    );
  }

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
      <Wordmark size={22} />
      {house ? (
        <View style={styles.house}>
          <Text style={[styles.houseName, { color: colors.foreground }]}>{house.name}</Text>
          <Text style={[styles.small, { color: colors.mutedForeground }]}>{SHELL_COPY.housemates(house.memberCount)}</Text>
        </View>
      ) : null}
      <View role="tablist" style={styles.signs}>
        {tabs}
      </View>
      {house?.me ? (
        <View style={[styles.me, { borderTopColor: colors.border }]}>
          <Avatar name={house.me.name} me />
          <View style={styles.meText}>
            <Text numberOfLines={1} style={[styles.meName, { color: colors.foreground }]}>
              {house.me.name}
            </Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {SHELL_COPY.standing(house.me.streak, house.me.tokens)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  marker: { position: 'absolute', top: 0, left: SPACE.lg, right: SPACE.lg, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  tabLabel: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  sidebar: { width: 232, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xl, gap: SPACE.xl },
  house: { paddingHorizontal: SPACE.xs },
  houseName: { fontFamily: FONT.extrabold, fontSize: 14 },
  small: { fontFamily: FONT.regular, fontSize: 12 },
  signs: { gap: SPACE.xs },
  sign: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.md, borderRadius: RADIUS },
  signLabel: { fontFamily: FONT.bold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  me: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.lg, paddingHorizontal: SPACE.xs },
  meText: { flex: 1, minWidth: 0 },
  meName: { fontFamily: FONT.bold, fontSize: 14 },
});
