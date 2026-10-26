import {
  cantOptions,
  firstName,
  FOCUS_SHELL_COPY,
  JOHN_COPY,
  JOHN_SHEET_COPY,
  NEXT_UP_COPY,
  SWAP_COPY,
  swapMeta,
  type BoardItem,
  type CantOptions,
} from '@app/core';
import { CameraIcon, CheckIcon, ImagesIcon, RepeatIcon, ShieldIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spendImmunity, spendSwap } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { SheetAnchor } from '@/components/sheet';
import { StatusMark } from '@/components/status-mark';
import { Body } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { useTick } from '@/hooks/use-tick';
import { SPACE, useTheme } from '@/theme';

import type { JohnSheetContext, JohnSheetFocus } from './body';
import { SheetLines, SheetSection } from './parts';

/**
 * Your open John: amber "Mark done" and a photo with it (a photo John
 * leads with the camera, then the library), and, while you hold a token,
 * "If you can't": skip it with immunity, or swap it for a housemate's. The
 * swap takes over the sheet's content until it's done or cancelled. Opened
 * at "If you can't" with only one of the two to offer, it starts on that
 * one: the skip's sentence, or the swap.
 */
export function YoursOpen({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const tick = useTick(context.houseId, item.id);
  const cant = cantOptions(item, context.board, context.me);
  const atCant = context.focus === 'cant' && cant !== null;
  const [swapping, setSwapping] = useState(context.focus === 'swap' || (atCant && cant.immunity === 0));
  const working = tick.pending ? JOHN_COPY.ticking : tick.uploading ? JOHN_COPY.uploading : null;

  // The swap list follows the house: if every other John goes, so does the swap.
  if (swapping && cant && cant.swapFor.length > 0) {
    return <SwapPicker item={item} cant={cant} context={context} onCancel={() => setSwapping(false)} />;
  }

  return (
    <>
      <SheetLines testID="tick-actions">
        {item.needsPhoto ? (
          <>
            <Button
              icon={CameraIcon}
              label={working ?? NEXT_UP_COPY.takePhoto}
              disabled={tick.busy}
              onPress={() => void tick.tickWithPhoto('camera')}
              testID="sheet-mark-done"
            />
            <Button
              variant="outline"
              icon={ImagesIcon}
              label={JOHN_SHEET_COPY.fromLibrary}
              disabled={tick.busy}
              onPress={() => void tick.tickWithPhoto('library')}
            />
          </>
        ) : (
          <>
            <Button
              icon={CheckIcon}
              label={working ?? JOHN_COPY.markDone}
              disabled={tick.busy}
              onPress={() => void tick.tick()}
              testID="sheet-mark-done"
            />
            <Button
              variant="outline"
              icon={CameraIcon}
              label={JOHN_SHEET_COPY.addPhoto}
              disabled={tick.busy}
              onPress={() => void tick.tickWithPhoto('camera')}
            />
          </>
        )}
        {tick.problem ? <Alert message={tick.problem} /> : null}
      </SheetLines>
      {cant ? (
        <IfYouCant
          item={item}
          cant={cant}
          context={context}
          skipFirst={atCant && cant.swapFor.length === 0}
          onSwap={() => setSwapping(true)}
        />
      ) : null}
    </>
  );
}

/**
 * "If you can't": skipping with immunity turns its row into the sentence it
 * means, with "Skip it" and "Cancel"; swapping opens the swap. Each row only
 * with what it needs (the token; for a swap, a housemate's open John).
 */
function IfYouCant({
  item,
  cant,
  context,
  skipFirst,
  onSwap,
}: {
  item: BoardItem;
  cant: CantOptions;
  context: JohnSheetContext;
  /** Start on the skip's sentence (opened from Today's "Skip with immunity ›"). */
  skipFirst: boolean;
  onSwap: () => void;
}) {
  const move = useMove(context.houseId);
  const [skipping, setSkipping] = useState(skipFirst);
  // Opened at "If you can't" with more above it than fits, the sheet starts scrolled here.
  const anchor: JohnSheetFocus = 'cant';
  return (
    <SheetSection>
      <SheetAnchor name={anchor}>
        <Section label={JOHN_SHEET_COPY.cant} testID="if-you-cant">
          {cant.immunity > 0 ? (
            skipping ? (
              <GroupItem testID="skip-confirm">
                <Body>{JOHN_SHEET_COPY.skipSentence(item.name, cant.immunity - 1)}</Body>
                <View style={styles.pair}>
                  <View style={styles.half}>
                    <Button
                      variant="outline"
                      icon={ShieldIcon}
                      label={JOHN_SHEET_COPY.skipIt}
                      disabled={move.pending}
                      onPress={() => void move.run(() => spendImmunity(item.id))}
                      testID="skip-it"
                    />
                  </View>
                  <View style={styles.half}>
                    <Button variant="ghost" label={FOCUS_SHELL_COPY.cancel} onPress={() => setSkipping(false)} />
                  </View>
                </View>
                {move.problem ? <Alert message={move.problem} /> : null}
              </GroupItem>
            ) : (
              <Row
                leading={<RowIcon icon={ShieldIcon} />}
                title={JOHN_SHEET_COPY.skip}
                meta={JOHN_SHEET_COPY.skipMeta(cant.immunity)}
                chevron
                onPress={() => setSkipping(true)}
                testID="skip-row"
              />
            )
          ) : null}
          {cant.swapFor.length > 0 ? (
            <Row
              leading={<RowIcon icon={RepeatIcon} />}
              title={JOHN_SHEET_COPY.swap}
              meta={JOHN_SHEET_COPY.swapMeta}
              chevron
              onPress={onSwap}
              testID="swap-row"
            />
          ) : null}
        </Section>
      </SheetAnchor>
    </SheetSection>
  );
}

/**
 * The swap: the housemates' open Johns this week to pick one from, one
 * choice of n (an overdue one says so: the hazard edge and its mark, since
 * taking it on takes on what it costs), then "Swap them" (the sheet's one
 * amber). The one picked is ticked at the end of its row, in place of its
 * mark. Done, the sheet goes: the John it was opened on is someone else's
 * now.
 */
function SwapPicker({
  item,
  cant,
  context,
  onCancel,
}: {
  item: BoardItem;
  cant: CantOptions;
  context: JohnSheetContext;
  onCancel: () => void;
}) {
  const move = useMove(context.houseId);
  const [take, setTake] = useState<string | null>(null);
  // A pick that has since gone (ticked, or swapped by someone else) is no pick.
  const picked = cant.swapFor.some((i) => i.id === take) ? take : null;

  async function swap() {
    if (picked && (await move.run(() => spendSwap(item.id, picked)))) context.close();
  }

  return (
    <>
      <SheetLines>
        <Body>{JOHN_SHEET_COPY.swapBody(item.name)}</Body>
      </SheetLines>
      <SheetSection>
        <Section label={JOHN_SHEET_COPY.swapFor} testID="swap-picker">
          <View accessibilityRole="radiogroup" accessibilityLabel={JOHN_SHEET_COPY.swapFor}>
            {cant.swapFor.map((theirs) => (
              <SwapChoice
                key={theirs.id}
                item={theirs}
                context={context}
                chosen={theirs.id === picked}
                onChoose={() => setTake(theirs.id)}
              />
            ))}
          </View>
        </Section>
      </SheetSection>
      <SheetLines>
        <Button
          label={move.pending ? SWAP_COPY.swapping : SWAP_COPY.swap}
          icon={RepeatIcon}
          disabled={!picked || move.pending}
          onPress={() => void swap()}
          testID="swap-them"
        />
        <Button variant="outline" label={FOCUS_SHELL_COPY.cancel} onPress={onCancel} testID="swap-cancel" />
        {move.problem ? <Alert message={move.problem} /> : null}
      </SheetLines>
    </>
  );
}

/** One of the swap's choices: a row to pick, the owner leading, and the tick as its trailing item once chosen. */
function SwapChoice({
  item,
  context,
  chosen,
  onChoose,
}: {
  item: BoardItem;
  context: JohnSheetContext;
  chosen: boolean;
  onChoose: () => void;
}) {
  const { colors } = useTheme();
  const meta = swapMeta(item, context.members, context.rules, context.now);
  return (
    <Row
      leading={<Avatar name={context.nameOf(item.userId)} />}
      title={item.name}
      meta={meta}
      trailing={
        chosen ? (
          <View style={[styles.chosen, { backgroundColor: colors.foreground }]} testID="swap-chosen">
            <CheckIcon size={16} strokeWidth={3} color={colors.card} aria-hidden />
          </View>
        ) : (
          <StatusMark status={item.status} />
        )
      }
      hazardEdge={item.status === 'overdue'}
      selected={chosen}
      onPress={onChoose}
      accessibilityLabel={`${item.name}, ${meta}`}
      testID="swap-choice"
    />
  );
}

/** A housemate's John still to do: whose it is, and nothing to do about it from here. */
export function TheirsOpen({ item, context }: { item: BoardItem; context: JohnSheetContext }) {
  const owner = context.members.find((m) => m.userId === item.userId);
  return (
    <SheetLines>
      <View style={styles.owner}>
        <Avatar name={context.nameOf(item.userId)} />
        <Body style={styles.shrink}>{JOHN_SHEET_COPY.theirs(owner ? firstName(owner.name) : FOCUS_SHELL_COPY.formerHousemate)}</Body>
      </View>
    </SheetLines>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: SPACE.sm },
  // The pick: an ink disc with a tick, where the row's mark was.
  chosen: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  half: { flex: 1 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  shrink: { flexShrink: 1 },
});
