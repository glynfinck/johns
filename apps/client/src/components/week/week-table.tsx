import { FOCUS_SHELL_COPY, WEEK_COPY, weekSpokenRow, weekWho, withAlpha, type BoardItem } from '@app/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Group, GroupItem, Hairline, useRowInset } from '@/components/group';
import { HazardTape } from '@/components/hazard-tape';
import { DoneFold, useJohnRow, type JohnRowContext } from '@/components/john-row';
import { LidDot } from '@/components/lid';
import { Body, Meta, RowTitle } from '@/components/text';
import { LEADING, ROW_GAP, SPACE, TABULAR, TAP, useTheme } from '@/theme';

/** The fixed columns; the John's takes what's left. */
const WHO = 112;
const POINTS = 40;
const STATUS = 120;
/** A row with a meta line, as Row has it. */
const TWO_LINES = 64;

/**
 * The laptop's Week: one row per John, the whole house in one group, within
 * the tab's 680. Each row is the phone's row with two columns of its own:
 * the circle (yours ticks from it), the John and its meta line (the column
 * that flexes), whose it is, its points (earned, once it's finished), and
 * one cell for where it has got to or what to do about it (Undo, Vote).
 * Tapping a row opens the John sheet. Finished Johns fold away at the end.
 * The column names are only for the eye: each row says all of its columns
 * to a screen reader.
 */
export function WeekTable({ rows, folded, context }: { rows: BoardItem[]; folded: BoardItem[]; context: JohnRowContext }) {
  return (
    <View testID="week-table">
      <Group>
        <HeadRow />
        {rows.map((item) => (
          <TableRow key={item.id} item={item} context={context} />
        ))}
        <DoneFold items={folded}>
          {folded.map((item) => (
            <TableRow key={item.id} item={item} context={context} />
          ))}
        </DoneFold>
      </Group>
    </View>
  );
}

/** The columns' names, in section-label caps, hidden from a screen reader (the rows say them). */
function HeadRow() {
  const { type } = useTheme();
  const inset = useRowInset();
  const head = (label: string, style: StyleProp<TextStyle>) => (
    <Text numberOfLines={1} style={[type.sectionLabel, style]}>
      {label}
    </Text>
  );
  return (
    <View aria-hidden testID="week-table-head" style={[styles.row, styles.head, { paddingHorizontal: inset }]}>
      <Hairline />
      <View style={styles.leading} />
      {head(WEEK_COPY.columns.john, styles.john)}
      {head(WEEK_COPY.columns.who, styles.who)}
      {head(WEEK_COPY.columns.points, [styles.points, styles.end])}
      {head(WEEK_COPY.columns.status, [styles.status, styles.end])}
    </View>
  );
}

/** One John across the table's columns. */
function TableRow({ item, context }: { item: BoardItem; context: JohnRowContext }) {
  const { colors } = useTheme();
  const inset = useRowInset();
  const john = useJohnRow(item, context);
  const [pressed, setPressed] = useState(false);
  const mine = item.userId === context.userId;
  const name = context.nameOf(item.userId) ?? FOCUS_SHELL_COPY.formerHousemate;
  const who = weekWho(item.userId, context.userId, context.nameOf);
  // A circle that ticks is its own control, beside the row's press target.
  const leading = <View style={styles.leading}>{john.leading}</View>;
  return (
    <>
      <View testID="week-row" style={[styles.row, { paddingHorizontal: inset }]}>
        {pressed ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.foreground, 0.06) }]} />
        ) : null}
        <Hairline />
        {john.plan.hazardEdge ? (
          <View aria-hidden pointerEvents="none" style={styles.edge}>
            <HazardTape tone="hazard" width={4} height="100%" />
          </View>
        ) : null}
        {john.plan.ticks ? leading : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={weekSpokenRow(item, john.plan.meta, who, john.plan.points)}
          onPress={john.open}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={styles.target}
        >
          {john.plan.ticks ? null : leading}
          <View style={styles.john}>
            <RowTitle numberOfLines={1}>{item.name}</RowTitle>
            <View style={styles.metaLine}>
              {john.plan.lid ? <LidDot category={item.category} /> : null}
              <Meta numberOfLines={1} style={styles.shrink}>
                {john.plan.meta}
              </Meta>
            </View>
          </View>
          <View style={[styles.who, styles.person]}>
            <Avatar name={name} me={mine} size={24} />
            <Body numberOfLines={1} style={styles.shrink}>
              {who}
            </Body>
          </View>
          <Body numberOfLines={1} style={[styles.points, styles.end, TABULAR]}>
            {String(john.plan.points)}
          </Body>
        </Pressable>
        {/* Its points have their own column, so this cell is for anything else. */}
        <View style={[styles.status, styles.cell]}>{john.plan.trailing === 'points' ? null : john.trailing}</View>
      </View>
      {john.problem ? (
        <GroupItem>
          <Alert message={john.problem} />
        </GroupItem>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TWO_LINES, flexDirection: 'row', alignItems: 'center', gap: ROW_GAP },
  head: { minHeight: TAP },
  target: {
    flex: 1,
    minWidth: 0,
    minHeight: TAP,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: SPACE.sm,
  },
  leading: { width: LEADING, alignItems: 'center', justifyContent: 'center' },
  john: { flex: 1, minWidth: 0, gap: 2 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1, minWidth: 0 },
  who: { width: WHO },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  points: { width: POINTS },
  status: { width: STATUS },
  end: { textAlign: 'right' },
  cell: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
});
