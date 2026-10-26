import { SECTION_LABEL } from '@app/core';
import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JohnSheetProvider } from '@/components/john-sheet';
import { SheetRailContext } from '@/components/sheet';
import { HouseTabBar, type ShellHouse } from '@/components/shell/house-tab-bar';
import { ToastProvider } from '@/components/toast';
import { useHouse, useLiveHouse } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { RAIL, SPACE, useTheme, WIDE } from '@/theme';

/** The tab bar's height above the home bar, so a toast clears it. */
const TAB_BAR = 56;

/**
 * A house's three places, Today, Week and House, as tabs along the bottom of
 * a phone and a rail from laptop width on the web. House is a stack of its
 * own (house/_layout), so the pages it pushes keep the tabs. Each screen
 * draws its own title bar. The house is followed live here, once for every
 * tab, and the John sheet and the toasts are mounted here for all of them.
 * From WIDE every sheet centres itself on the page beside the rail.
 */
export default function HouseLayout() {
  // The root layout's guard only opens this group with a house and a session.
  const { session, house } = useMembership();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= WIDE;
  const { view } = useHouse(house!.id, session!.user.id);
  useLiveHouse(house!.id);

  const shell: ShellHouse = {
    name: view?.snapshot.house.name ?? house!.name,
    memberCount: view?.snapshot.members.length ?? 1,
  };
  const toVote = view?.today.toVote.length ?? 0;

  return (
    <SheetRailContext.Provider value={wide ? RAIL : 0}>
      <ToastProvider bottom={wide ? SPACE.xl : TAB_BAR + insets.bottom + SPACE.lg}>
        <JohnSheetProvider houseId={house!.id} userId={session!.user.id}>
          <Tabs
            tabBar={(props) => <HouseTabBar {...props} wide={wide} house={view ? shell : null} toVote={toVote} />}
            screenOptions={{
              tabBarPosition: wide ? 'left' : 'bottom',
              headerShown: false,
              sceneStyle: { backgroundColor: colors.background },
            }}
          >
            <Tabs.Screen name="today" options={{ title: SECTION_LABEL.today }} />
            <Tabs.Screen name="week" options={{ title: SECTION_LABEL.week }} />
            <Tabs.Screen name="house" options={{ title: SECTION_LABEL.house }} />
          </Tabs>
        </JohnSheetProvider>
      </ToastProvider>
    </SheetRailContext.Provider>
  );
}
