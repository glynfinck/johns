import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// A page opened straight from a link (/house/wall, say) still has House
// under it, so its back button goes somewhere.
export const unstable_settings = { anchor: 'index' };

/**
 * House, as a stack inside its tab: the group page, and the pages it pushes
 * (the Wall, the Stake, a housemate, the setup pages), which keep the tabs
 * and the rail. Each page draws its own title bar, with back.
 */
export default function HouseStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
