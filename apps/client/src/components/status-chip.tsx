import { STATUS_LABEL, withAlpha, type BinNightScheme, type LiveStatus } from '@app/core';
import { CheckIcon, ClockIcon, EyeIcon, ShieldIcon, TriangleAlertIcon, XIcon, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

type Look = { background: string; ink: string; edge?: string };

/** Each status's colours, as the web's StatusChip has them (`bg-hazard/15` is 15% hazard). */
function looks(c: BinNightScheme): Record<LiveStatus, Look> {
  const quiet = { background: 'transparent', ink: c.mutedForeground, edge: c.border };
  const warn = { background: withAlpha(c.hazard, 0.15), ink: c.hazard };
  const good = { background: withAlpha(c.good, 0.15), ink: c.good };
  return {
    upcoming: quiet,
    'due-soon': { background: c.hivis, ink: c.onHivis },
    overdue: warn,
    checking: good,
    disputed: warn,
    done: good,
    late: warn,
    missed: { background: c.hazard, ink: c.onHazard },
    excused: quiet,
  };
}

const ICON: Partial<Record<LiveStatus, LucideIcon>> = {
  'due-soon': ClockIcon,
  overdue: TriangleAlertIcon,
  checking: CheckIcon,
  disputed: EyeIcon,
  done: CheckIcon,
  late: CheckIcon,
  missed: XIcon,
  excused: ShieldIcon,
};

export function StatusChip({ status }: { status: LiveStatus }) {
  const { colors } = useTheme();
  const look = looks(colors)[status];
  const Icon = ICON[status];
  return (
    <View
      testID={`status-${status}`}
      style={[styles.chip, { backgroundColor: look.background, borderColor: look.edge ?? look.background }]}
    >
      {Icon ? <Icon size={14} color={look.ink} aria-hidden /> : null}
      <Text style={[styles.label, { color: look.ink }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    height: 24,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS * 0.6,
    borderWidth: 1,
  },
  label: { fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
});
