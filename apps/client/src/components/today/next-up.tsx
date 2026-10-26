import {
  clearUntil,
  dateRange,
  JOHN_COPY,
  NEXT_UP_COPY,
  nextUpMeta,
  NOT_DEALT_COPY,
  type BoardItem,
  type HouseRules,
  type NextUpState,
} from '@app/core';
import { CameraIcon, CheckIcon, ImagesIcon, TriangleAlertIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { HazardTape } from '@/components/hazard-tape';
import { useJohnSheet } from '@/components/john-sheet';
import { LidDot } from '@/components/lid';
import { Lead, Meta, SectionLabel } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useTick } from '@/hooks/use-tick';
import { SPACE, TAP, useTheme } from '@/theme';

/** What the card shows beside a John: the tokens you hold that can skip or swap it. */
export interface CantHeld {
  immunity: boolean;
  swap: boolean;
}

/**
 * Today's one card, Next up: your next open John with the screen's one
 * amber button, or what takes its place (all clear, time away, before the
 * first deal). Never stacked: one state at a time. The setup checklist is
 * its own card (SetupCard).
 */
export function NextUp({
  houseId,
  state,
  rules,
  now,
  cant,
  room,
  awayMakeup,
}: {
  houseId: string;
  state: Exclude<NextUpState, { kind: 'setup' }>;
  rules: HouseRules;
  now: Date;
  /** What you hold that could skip or swap the next John. */
  cant: CantHeld;
  /** What's left of your stake this month, which caps what lateness costs (null when not known). */
  room: number | null;
  /** How much of your share time away still counts (houses.away_makeup). */
  awayMakeup: number;
}) {
  switch (state.kind) {
    case 'john':
      // Keyed by the John, so a tick under way never carries over to the next one.
      return (
        <NextJohn key={state.item.id} houseId={houseId} item={state.item} rules={rules} now={now} cant={cant} room={room} />
      );
    case 'clear':
      return (
        <NextUpCard
          lead={clearUntil(state.until, rules.timezone)}
          body={state.nothingYours ? NEXT_UP_COPY.nothingYours : NEXT_UP_COPY.clearBody}
        />
      );
    case 'away':
      return (
        <NextUpCard lead={NEXT_UP_COPY.away(dateRange(state.until, state.until))} body={NEXT_UP_COPY.awayBody(awayMakeup)}>
          <TextButton label={NEXT_UP_COPY.changeDates} href="/house/away" chevron align="start" testID="change-dates" />
        </NextUpCard>
      );
    case 'waiting':
      return <NextUpCard lead={NEXT_UP_COPY.waiting(state.admin)} />;
    case 'undealt':
      return <NextUpCard lead={NOT_DEALT_COPY.nothingThisWeek} body={NOT_DEALT_COPY.nothingThisWeekBody} />;
  }
}

/**
 * The card's shell, for the states that aren't a John: "Next up", the Lead,
 * a line under it, and a quiet way onward. No amber.
 */
export function NextUpCard({ lead, body, children }: { lead: string; body?: string; children?: ReactNode }) {
  return (
    <Card testID="next-up" style={children ? styles.quietEnd : undefined}>
      <SectionLabel style={styles.label}>{NEXT_UP_COPY.label}</SectionLabel>
      <Lead style={styles.lead}>{lead}</Lead>
      {body ? <Meta>{body}</Meta> : null}
      {children ? <View style={styles.onward}>{children}</View> : null}
    </Card>
  );
}

/**
 * Your next John: its name as the Lead (which opens the John sheet), what
 * it is, when it's due and what being late costs, then amber "Mark done"
 * with a photo beside it (a photo John leads with the camera), and, while
 * you hold a token, the way to skip or swap it. Overdue, it wears the 4pt
 * hazard edge and says since when on a line of its own.
 */
function NextJohn({
  houseId,
  item,
  rules,
  now,
  cant,
  room,
}: {
  houseId: string;
  item: BoardItem;
  rules: HouseRules;
  now: Date;
  cant: CantHeld;
  room: number | null;
}) {
  const { colors, type } = useTheme();
  const sheet = useJohnSheet();
  const tick = useTick(houseId, item.id);
  const [pressed, setPressed] = useState(false);
  const meta = nextUpMeta(item, rules, now, room);
  const working = tick.pending ? JOHN_COPY.ticking : tick.uploading ? JOHN_COPY.uploading : null;
  const offersCant = cant.immunity || cant.swap;

  return (
    <Card testID="next-up" style={[styles.edged, offersCant && styles.quietEnd]}>
      {meta.overdue ? (
        <View aria-hidden pointerEvents="none" style={styles.edge} testID="overdue-edge">
          <HazardTape tone="hazard" width={4} height="100%" />
        </View>
      ) : null}
      <SectionLabel style={styles.label}>{NEXT_UP_COPY.label}</SectionLabel>
      <Pressable
        accessibilityRole="button"
        onPress={() => sheet.open(item.id)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.name, pressed && styles.pressed]}
        testID="next-up-name"
      >
        <Lead>{item.name}</Lead>
      </Pressable>
      {/* Not a row: the card's meta may wrap to a second line on a narrow phone rather than lose the cost. */}
      <View style={styles.meta}>
        <View style={styles.mark}>
          <LidDot category={item.category} />
        </View>
        <Meta numberOfLines={2} style={styles.shrink} testID="next-up-meta">
          {meta.due ? `${meta.kind} · ${meta.due}` : meta.kind}
        </Meta>
      </View>
      {meta.overdue ? (
        <View style={styles.meta} testID="next-up-overdue">
          <View style={styles.mark}>
            <TriangleAlertIcon size={14} color={colors.hazard} aria-hidden />
          </View>
          <Text numberOfLines={2} style={[type.meta, styles.shrink]}>
            <Text style={{ color: colors.hazard }}>{meta.overdue.since}</Text>
            {meta.overdue.cost ? ` · ${meta.overdue.cost}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.buttons}>
        <View style={styles.grow}>
          {item.needsPhoto ? (
            <Button
              icon={CameraIcon}
              label={working ?? NEXT_UP_COPY.takePhoto}
              disabled={tick.busy}
              onPress={() => void tick.tickWithPhoto('camera')}
              testID="mark-done"
            />
          ) : (
            <Button icon={CheckIcon} label={working ?? JOHN_COPY.markDone} disabled={tick.busy} onPress={() => void tick.tick()} testID="mark-done" />
          )}
        </View>
        {item.needsPhoto ? (
          <Button
            variant="outline"
            icon={ImagesIcon}
            label={NEXT_UP_COPY.library}
            disabled={tick.busy}
            onPress={() => void tick.tickWithPhoto('library')}
            testID="choose-photo"
          />
        ) : (
          <Button
            variant="outline"
            icon={CameraIcon}
            label={NEXT_UP_COPY.photo}
            disabled={tick.busy}
            onPress={() => void tick.tickWithPhoto('camera')}
            testID="done-with-photo"
          />
        )}
      </View>
      {tick.problem ? (
        <View style={styles.problem}>
          <Alert message={tick.problem} />
        </View>
      ) : null}

      {offersCant ? (
        <View style={styles.onward}>
          <TextButton
            label={NEXT_UP_COPY.cant(cant.immunity, cant.swap)}
            chevron
            align="start"
            // Only a swap to spend: straight to the swap.
            onPress={() => sheet.open(item.id, cant.swap && !cant.immunity ? 'swap' : 'cant')}
            testID="skip-or-swap"
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Room for the hazard edge, which sits on the card's left.
  edged: { position: 'relative' },
  // A quiet text button ends the card: its own 48 target is the room below.
  quietEnd: { paddingBottom: SPACE.sm },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  // Overpass's caps sit high in their line.
  label: { paddingTop: 2 },
  // The name is a thumb-sized target of its own; its words keep the Lead's place (the target reaches past them).
  name: { minHeight: TAP, marginVertical: -2, justifyContent: 'center', alignSelf: 'stretch' },
  pressed: { opacity: 0.6 },
  lead: { marginTop: SPACE.sm },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  // The dot or the sign, centred on the first line of words.
  mark: { height: 20, justifyContent: 'center' },
  shrink: { flexShrink: 1 },
  buttons: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, minHeight: TAP },
  grow: { flex: 1 },
  problem: { marginTop: SPACE.sm },
  onward: { marginTop: SPACE.xs },
});
