import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// A page opened straight from a link (/week/record, say) still has Week
// under it, so its back button goes somewhere.
export const unstable_settings = { anchor: 'index' };

/**
 * Week, as a stack inside its tab: the week, and the pages it pushes (the
 * track record and a housemate's breakdown), which keep the tabs and the
 * rail. Each page draws its own title bar, with back.
 */
export default function WeekStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
