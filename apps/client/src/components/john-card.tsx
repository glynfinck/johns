import {
  CATEGORY_LABEL,
  dueLabel,
  isOpen,
  JOHN_COPY,
  pointsLabel,
  relative,
  withAlpha,
  type BoardItem,
  type Category,
} from '@app/core';
import { CameraIcon, CheckIcon, ImagesIcon, PlaneIcon, ShieldIcon, Undo2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { markDone, spendImmunity, undoDone } from '@/api/johns';
import { pickPhoto, uploadProof } from '@/api/photos';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { HazardTape } from '@/components/hazard-tape';
import { Lid } from '@/components/lid';
import { StatusChip } from '@/components/status-chip';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/**
 * One of your Johns, wearing its bin lid along the top, as the web's card:
 * what you can do with it depends on where it has got to, and nothing else.
 */
export function JohnCard({
  item,
  houseId,
  zone,
  now,
  immunityTokens,
}: {
  item: BoardItem;
  houseId: string;
  zone: string;
  now: Date;
  immunityTokens: number;
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

          {item.dispute ? (
            <View style={[styles.note, { backgroundColor: withAlpha(colors.hazard, 0.1) }]}>
              <Text style={[styles.noteStrong, { color: colors.hazard }]}>{JOHN_COPY.disputed(item.dispute.reason)}</Text>
              <Body muted style={styles.small}>
                {JOHN_COPY.votes(item.dispute.uphold, item.dispute.reject, relative(item.dispute.closesAt, now))}
              </Body>
            </View>
          ) : null}

          {open && item.movedFrom ? (
            <View style={[styles.note, styles.moved, { backgroundColor: colors.secondary }]} testID="due-before-you-go">
              <PlaneIcon size={16} color={colors.foreground} aria-hidden />
              <Body style={[styles.small, styles.grow]}>
                {JOHN_COPY.dueBeforeYouGo(
                  dueLabel(item.movedFrom, now, zone).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase()),
                )}
              </Body>
            </View>
          ) : null}

          {open ? <Tick item={item} houseId={houseId} immunityTokens={immunityTokens} /> : null}

          {item.status === 'checking' && item.standsAt ? (
            <Stands item={item} houseId={houseId} now={now} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Mark it done: on a photo John the photo comes first, from the camera or (the
 * square button) the library; on any other, a photo is offered, never required.
 */
function Tick({ item, houseId, immunityTokens }: { item: BoardItem; houseId: string; immunityTokens: number }) {
  const move = useMove(houseId);
  const [uploading, setUploading] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = move.pending || uploading;

  async function withPhoto(source: 'camera' | 'library') {
    setPhotoProblem(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(source);
    } catch (reason) {
      setPhotoProblem(reason instanceof Error ? reason.message : JOHN_COPY.photoFailed);
      return;
    }
    if (!uri) return;
    setUploading(true);
    let path: string;
    try {
      path = await uploadProof(houseId, item.id, uri);
    } catch {
      setPhotoProblem(JOHN_COPY.photoFailed);
      setUploading(false);
      return;
    }
    setUploading(false);
    await move.run(() => markDone(item.id, path));
  }

  return (
    <View style={styles.actions}>
      {item.needsPhoto ? (
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              icon={CameraIcon}
              label={busy ? JOHN_COPY.uploading : JOHN_COPY.photoAndDone}
              disabled={busy}
              onPress={() => void withPhoto('camera')}
              testID="mark-done"
            />
          </View>
          <Button
            variant="outline"
            icon={ImagesIcon}
            label={JOHN_COPY.choosePhoto}
            iconOnly
            disabled={busy}
            onPress={() => void withPhoto('library')}
            testID="choose-photo"
          />
        </View>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              icon={CheckIcon}
              label={move.pending ? JOHN_COPY.ticking : uploading ? JOHN_COPY.uploading : JOHN_COPY.markDone}
              disabled={busy}
              onPress={() => void move.run(() => markDone(item.id))}
              testID="mark-done"
            />
          </View>
          <Button
            variant="outline"
            icon={CameraIcon}
            label={JOHN_COPY.withPhoto}
            iconOnly
            disabled={busy}
            onPress={() => void withPhoto('camera')}
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

      {photoProblem || move.problem ? <Alert message={(photoProblem ?? move.problem)!} /> : null}
    </View>
  );
}

/** A tick being checked: when it stands, and the owner's way to take it back meanwhile. */
function Stands({ item, houseId, now }: { item: BoardItem; houseId: string; now: Date }) {
  const move = useMove(houseId);
  return (
    <View style={styles.actions}>
      <View style={styles.stands}>
        <Body muted style={[styles.small, styles.grow]}>
          {JOHN_COPY.standsIn(relative(item.standsAt!, now))}
        </Body>
        <Button
          variant="ghost"
          icon={Undo2Icon}
          label={JOHN_COPY.undo}
          disabled={move.pending}
          onPress={() => void move.run(() => undoDone(item.id))}
        />
      </View>
      {move.problem ? <Alert message={move.problem} /> : null}
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
  noteStrong: { fontFamily: FONT.bold, fontSize: 14 },
  moved: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  small: { fontSize: 14, lineHeight: 20 },
  grow: { flex: 1 },
  actions: { gap: SPACE.sm },
  buttons: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' },
  start: { alignItems: 'flex-start' },
  stands: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
});
