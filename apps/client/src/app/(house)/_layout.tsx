import { SECTION_LABEL } from '@app/core';
import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';

import { HouseHeader } from '@/components/shell/house-header';
import { HouseTabBar, type ShellHouse } from '@/components/shell/house-tab-bar';
import { useHouse, useLiveHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useTheme, WIDE } from '@/theme';

/**
 * Every screen of a house, as tabs: along the bottom of a phone, a sidebar
 * from laptop width on the web. The house is followed live here, once, for
 * every tab.
 */
export default function HouseLayout() {
  // The root layout's guard only opens this group with a house and a session.
  const { session, house } = useMembership();
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= WIDE;
  const { view } = useHouse(house!.id, session!.user.id);
  useLiveHouse(house!.id);

  const shell: ShellHouse | null = view
    ? {
        name: view.snapshot.house.name,
        memberCount: view.snapshot.members.length,
        me: view.me
          ? { name: view.me.name, streak: view.me.streak, tokens: view.me.immunityTokens + view.me.swapTokens }
          : null,
      }
    : null;

  return (
    <Tabs
      tabBar={(props) => <HouseTabBar {...props} wide={wide} house={shell} />}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerShown: !wide,
        header: () => <HouseHeader houseName={view?.snapshot.house.name ?? house!.name} />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: SECTION_LABEL.today }} />
      <Tabs.Screen name="week" options={{ title: SECTION_LABEL.week }} />
      <Tabs.Screen name="wall" options={{ title: SECTION_LABEL.wall }} />
      <Tabs.Screen name="table" options={{ title: SECTION_LABEL.table }} />
    </Tabs>
  );
}
