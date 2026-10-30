import { ADMIN_COPY, auditChanges, auditLine, formatWhen, type AuditEntry } from '@app/core';
import { MegaphoneIcon, ScrollTextIcon, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Group, GroupItem } from '@/components/group';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Lead, Meta } from '@/components/text';
import { FONT, RADIUS, SPACE, TABULAR, useTheme } from '@/theme';

const KIND_ICON: Record<string, LucideIcon> = { notice: MegaphoneIcon };

/** An entry's mark: its kind's icon on a plate, ink when it was you. */
export function AuditMark({ entry, ownerId }: { entry: AuditEntry; ownerId: string | null }) {
  const { colors } = useTheme();
  const you = entry.actor !== null && entry.actor === ownerId;
  const Icon = KIND_ICON[entry.targetKind] ?? ScrollTextIcon;
  return (
    <View aria-hidden style={[styles.mark, { backgroundColor: you ? colors.foreground : colors.secondary }]}>
      <Icon size={18} strokeWidth={2.5} color={you ? colors.background : colors.foreground} />
    </View>
  );
}

/** One entry in the list: its mark, what was done, its detail, and the time. */
export function AuditRow({
  entry,
  ownerId,
  chosen,
  onPress,
}: {
  entry: AuditEntry;
  ownerId: string | null;
  chosen?: boolean;
  onPress: () => void;
}) {
  const { title, meta } = auditLine(entry, ownerId);
  return (
    <Row
      title={title}
      meta={meta}
      leading={<AuditMark entry={entry} ownerId={ownerId} />}
      trailing={<Time iso={entry.at} />}
      tint={chosen}
      onPress={onPress}
      testID={`audit-row-${entry.id}`}
    />
  );
}

function Time({ iso }: { iso: string }) {
  const { type, colors } = useTheme();
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  return <Text style={[type.meta, TABULAR, { color: colors.mutedForeground }]}>{time}</Text>;
}

/** An entry in full: when, what changed (old struck through, new in bold), and its details. */
export function AuditDetail({ entry, ownerId }: { entry: AuditEntry; ownerId: string | null }) {
  const { colors, type } = useTheme();
  const changes = auditChanges(entry);
  return (
    <View style={styles.detail} testID={`audit-detail-${entry.id}`}>
      <View style={styles.head}>
        <Meta>{`#${entry.id}, ${formatWhen(entry.at)}`}</Meta>
        <Lead header>{auditLine(entry, ownerId).title}</Lead>
      </View>
      {changes.length > 0 ? (
        <Section label={ADMIN_COPY.whatChanged}>
          <Group>
            {changes.map((change) => (
              <GroupItem key={change.field}>
                <View style={styles.change}>
                  <Text style={[type.initials, { color: colors.mutedForeground }]}>{change.label}</Text>
                  {change.from !== null ? (
                    <Text style={[type.body, styles.was, { color: colors.mutedForeground }]}>{change.from}</Text>
                  ) : null}
                  <Text style={[type.body, styles.now, { color: colors.foreground }]}>{change.to ?? '–'}</Text>
                </View>
              </GroupItem>
            ))}
          </Group>
        </Section>
      ) : null}
      <Section label={ADMIN_COPY.details}>
        <Group>
          <Row title={ADMIN_COPY.action} meta={entry.action} />
          {entry.reason ? <Row title={entry.reason} /> : null}
        </Group>
      </Section>
      <Meta>{ADMIN_COPY.appendOnly}</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 32, height: 32, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
  detail: { gap: SPACE.xl },
  head: { gap: SPACE.xs },
  change: { gap: 2, paddingVertical: SPACE.md },
  was: { textDecorationLine: 'line-through' },
  now: { fontFamily: FONT.bold },
});
