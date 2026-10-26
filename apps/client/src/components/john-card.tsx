import {
  CATEGORY_LABEL,
  DISPUTE_COPY,
  dueLabel,
  isOpen,
  JOHN_COPY,
  pointsLabel,
  relative,
  WEEK_COPY,
  type BoardItem,
  type Category,
} from '@app/core';
import { CameraIcon, CheckIcon, FlagIcon, ImagesIcon, PlaneIcon, ShieldIcon, Undo2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spendImmunity, undoDone } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { DisputeButton, DisputeForm, VoteButtons } from '@/components/dispute';
import { HazardTape } from '@/components/hazard-tape';
import { Lid } from '@/components/lid';
import { StatusChip } from '@/components/status-chip';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { useTick } from '@/hooks/use-tick';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/**
 * One John, wearing its bin lid along the top, as the web's card: what you
 * can do with it depends on whose it is and where it has got to, and
 * nothing else. Yours can be ticked; a housemate's tick can be disputed, and
 * voted on once it is.
 */
export function JohnCard({
  item,
  houseId,
  zone,
  now,
  mine = true,
  ownerName = '',
  showOwner = false,
  immunityTokens = 0,
}: {
  item: BoardItem;
  houseId: string;
  zone: string;
  now: Date;
  mine?: boolean;
  ownerName?: string;
  showOwner?: boolean;
  immunityTokens?: number;
}) {
  const { colors } = useTheme();
  const open = isOpen(item.status);
  const finished = item.status === 'done' || item.status === 'late' || item.status === 'checking';
  const alarming = item.status === 'overdue' || item.status === 'missed';
  const kind = item.groupName ?? CATEGORY_LABEL[item.category as Category] ?? 'John';

  return (
    <View
      testID="john-card"
      accessibilityLabel={`${item.name}, ${kind}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Lid category={item.category} height={6} />
      <View style={styles.row}>
        {alarming ? <HazardTape width={8} height="100%" /> : null}
        <View style={styles.body}>
          <View style={styles.top}>
            <View style={styles.title}>
              <Text
                style={[
                  styles.name,
                  { color: finished ? colors.mutedForeground : colors.foreground },
                  finished && styles.struck,
                ]}
              >
                {item.name}
              </Text>
              <Body muted style={styles.meta}>
                {[kind, dueLabel(item.dueAt, now, zone), item.needsPhoto ? JOHN_COPY.photo : null].filter(Boolean).join(' · ')}
              </Body>
            </View>
            <View style={styles.side}>
              <StatusChip status={item.status} />
              <Text style={[styles.points, { color: colors.foreground }]}>{pointsLabel(item.points)}</Text>
            </View>
          </View>

          {showOwner ? (
            <View style={styles.owner}>
              <Avatar name={ownerName} me={mine} size={24} />
              <Text style={[styles.ownerName, { color: colors.foreground }]}>{mine ? WEEK_COPY.you : ownerName}</Text>
            </View>
          ) : null}

          <DisputeNote item={item} houseId={houseId} now={now} mine={mine} />

          <DueBeforeYouGo item={item} zone={zone} now={now} mine={mine} ownerName={ownerName} />

          {mine && open ? <TickActions item={item} houseId={houseId} immunityTokens={immunityTokens} /> : null}

          {item.status === 'checking' && item.standsAt ? (
            <StandsActions item={item} houseId={houseId} now={now} mine={mine} ownerName={ownerName} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * A dispute on a John: a hazard flag and the reason in ink (no tinted panel,
 * so it reads on the card or a sheet's pavement alike), the tally, and
 * (unless it's yours) your vote. Nothing without one.
 */
export function DisputeNote({ item, houseId, now, mine }: { item: BoardItem; houseId: string; now: Date; mine: boolean }) {
  const { colors, type } = useTheme();
  if (!item.dispute) return null;
  return (
    <View style={styles.dispute} testID="dispute-note">
      <View style={styles.flagged}>
        <FlagIcon size={16} color={colors.hazard} aria-hidden style={styles.flag} />
        <Text style={[type.body, styles.grow]}>{JOHN_COPY.disputed(item.dispute.reason)}</Text>
      </View>
      <Body muted>{JOHN_COPY.votes(item.dispute.uphold, item.dispute.reject, relative(item.dispute.closesAt, now))}</Body>
      {!mine ? <VoteButtons houseId={houseId} disputeId={item.dispute.id} myVote={item.dispute.myVote} /> : null}
    </View>
  );
}

/** An open John that time away pulled forward: when it was due, and whose trip moved it. Nothing otherwise. */
export function DueBeforeYouGo({
  item,
  zone,
  now,
  mine,
  ownerName,
}: {
  item: BoardItem;
  zone: string;
  now: Date;
  mine: boolean;
  ownerName: string;
}) {
  const { colors } = useTheme();
  if (!isOpen(item.status) || !item.movedFrom) return null;
  // "it was due tomorrow 20:00", mid-sentence.
  const was = dueLabel(item.movedFrom, now, zone).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase());
  return (
    <View style={[styles.note, styles.moved, { backgroundColor: colors.secondary }]} testID="due-before-you-go">
      <PlaneIcon size={16} color={colors.foreground} aria-hidden />
      <Body style={[styles.small, styles.grow]}>
        {mine ? JOHN_COPY.dueBeforeYouGo(was) : JOHN_COPY.dueBeforeTheyGo(ownerName, was)}
      </Body>
    </View>
  );
}

/**
 * Mark it done: on a photo John the photo comes first, from the camera or (the
 * square button) the library; on any other, a photo is offered, never required.
 * Then, while you hold one, spending an immunity token on it instead.
 */
export function TickActions({ item, houseId, immunityTokens }: { item: BoardItem; houseId: string; immunityTokens: number }) {
  const tick = useTick(houseId, item.id);
  const move = useMove(houseId);
  const [confirming, setConfirming] = useState(false);
  const busy = tick.busy || move.pending;

  return (
    <View style={styles.actions}>
      {item.needsPhoto ? (
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              icon={CameraIcon}
              label={tick.uploading ? JOHN_COPY.uploading : JOHN_COPY.photoAndDone}
              disabled={busy}
              onPress={() => void tick.tickWithPhoto('camera')}
              testID="mark-done"
            />
          </View>
          <Button
            variant="outline"
            icon={ImagesIcon}
            label={JOHN_COPY.choosePhoto}
            iconOnly
            disabled={busy}
            onPress={() => void tick.tickWithPhoto('library')}
            testID="choose-photo"
          />
        </View>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              icon={CheckIcon}
              label={tick.pending ? JOHN_COPY.ticking : tick.uploading ? JOHN_COPY.uploading : JOHN_COPY.markDone}
              disabled={busy}
              onPress={() => void tick.tick()}
              testID="mark-done"
            />
          </View>
          <Button
            variant="outline"
            icon={CameraIcon}
            label={JOHN_COPY.withPhoto}
            iconOnly
            disabled={busy}
            onPress={() => void tick.tickWithPhoto('camera')}
            testID="done-with-photo"
          />
        </View>
      )}

      {immunityTokens > 0 ? (
        confirming ? (
          <View style={styles.buttons}>
            <Button
              icon={ShieldIcon}
              label={JOHN_COPY.spendIt}
              disabled={busy}
              onPress={() => void move.run(() => spendImmunity(item.id))}
            />
            <Button variant="ghost" label={JOHN_COPY.keepIt} onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <View style={styles.start}>
            <Button variant="ghost" icon={ShieldIcon} label={JOHN_COPY.useImmunity} onPress={() => setConfirming(true)} />
          </View>
        )
      ) : null}

      {tick.problem || move.problem ? <Alert message={(tick.problem ?? move.problem)!} /> : null}
    </View>
  );
}

/**
 * A tick being checked: when it stands; meanwhile its owner can take it back
 * and anyone else can dispute it, in its own sheet or, with `inline` (inside
 * the John sheet), in place.
 */
export function StandsActions({
  item,
  houseId,
  now,
  mine,
  ownerName,
  inline = false,
}: {
  item: BoardItem;
  houseId: string;
  now: Date;
  mine: boolean;
  ownerName: string;
  inline?: boolean;
}) {
  const move = useMove(houseId);
  const [disputing, setDisputing] = useState(false);
  return (
    <View style={styles.actions}>
      <View style={styles.stands}>
        <Body muted style={[styles.small, styles.grow]}>
          {item.standsAt ? JOHN_COPY.standsIn(relative(item.standsAt, now)) : null}
        </Body>
        {mine ? (
          <Button
            variant="ghost"
            icon={Undo2Icon}
            label={JOHN_COPY.undo}
            disabled={move.pending}
            onPress={() => void move.run(() => undoDone(item.id))}
          />
        ) : inline ? (
          disputing ? null : (
            <Button variant="outline" icon={FlagIcon} label={DISPUTE_COPY.open} onPress={() => setDisputing(true)} testID="dispute" />
          )
        ) : (
          <DisputeButton houseId={houseId} assignmentId={item.id} john={item.name} owner={ownerName} />
        )}
      </View>
      {inline && disputing ? <DisputeForm houseId={houseId} assignmentId={item.id} onSent={() => setDisputing(false)} /> : null}
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

/**
 * The laptop table's tick: one small button. A photo John opens the camera
 * (the file chooser, on the web) first, as on the card.
 */
export function CompactTick({ item, houseId }: { item: BoardItem; houseId: string }) {
  const tick = useTick(houseId, item.id);
  return (
    <View style={styles.compact}>
      <Button
        icon={item.needsPhoto ? CameraIcon : CheckIcon}
        label={tick.busy ? '…' : JOHN_COPY.done}
        disabled={tick.busy}
        onPress={() => void (item.needsPhoto ? tick.tickWithPhoto('camera') : tick.tick())}
        testID="mark-done"
      />
      {tick.problem ? <Alert message={tick.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS * 1.4, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  body: { flex: 1, padding: SPACE.lg, gap: SPACE.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md },
  title: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.extrabold, fontSize: 17, lineHeight: 21 },
  struck: { textDecorationLine: 'line-through' },
  meta: { marginTop: SPACE.xs, fontSize: 14 },
  side: { alignItems: 'flex-end', gap: SPACE.xs },
  points: { fontFamily: FONT.extrabold, fontSize: 12 },
  note: { borderRadius: RADIUS, padding: SPACE.md, gap: SPACE.xs },
  dispute: { gap: SPACE.sm },
  flagged: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  // The flag sits on the first line's middle.
  flag: { marginTop: 4 },
  moved: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  small: { fontSize: 14, lineHeight: 20 },
  grow: { flex: 1 },
  actions: { gap: SPACE.sm },
  buttons: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' },
  start: { alignItems: 'flex-start' },
  stands: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  owner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  ownerName: { fontFamily: FONT.bold, fontSize: 14 },
  compact: { alignItems: 'flex-end', gap: SPACE.xs },
});
