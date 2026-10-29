import type { HistoryKind, HistoryMonth } from '@app/core';
import { BanknoteIcon, ClockIcon, CoinsIcon, RotateCcwIcon, TriangleAlertIcon, Undo2Icon, XIcon, type LucideIcon } from 'lucide-react-native';

import { Money } from '@/components/house-page/money';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { useTheme } from '@/theme';

/** Each kind of entry's icon: the late and missed marks for a forfeit, in hazard; the rest in ink. */
const KIND_ICON: Record<HistoryKind, LucideIcon> = {
  late: ClockIcon,
  missed: XIcon,
  forfeit: TriangleAlertIcon,
  share: CoinsIcon,
  cap_refund: Undo2Icon,
  payment: BanknoteIcon,
  correction: RotateCcwIcon,
  other: CoinsIcon,
};

/**
 * The ledger by month, newest first: a section for each month, a row for
 * each entry. A forfeit names its John, with the late or missed mark and
 * its amount in hazard; shares and refunds are said in words, signed in
 * ink. A payment says who paid whom, its amount in ink without a sign
 * (core's HistoryLine says why); one between two others has no amount:
 * it's theirs.
 */
export function StakeHistory({ months }: { months: readonly HistoryMonth[] }) {
  const { colors } = useTheme();
  return months.map((month) => (
    <Section key={month.month} label={month.label} testID="ledger-month">
      {month.lines.map((line) => {
        const Icon = KIND_ICON[line.kind];
        const hazard = line.kind === 'late' || line.kind === 'missed' || line.kind === 'forfeit';
        return (
          <Row
            key={line.id}
            leading={<Icon size={24} color={hazard ? colors.hazard : colors.foreground} aria-hidden />}
            title={line.title}
            meta={line.meta}
            trailing={line.amount != null ? <Money value={line.amount} losing={line.losing} marked={!hazard} /> : undefined}
            testID="ledger-entry"
          />
        );
      })}
    </Section>
  ));
}
