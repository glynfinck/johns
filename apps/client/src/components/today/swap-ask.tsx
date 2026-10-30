import { STEADY_COPY, type BoardItem, type SwapAsk, type SwapOfferToYou } from '@app/core';
import { RepeatIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { answerSwap, askSwap } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Group, GroupItem } from '@/components/group';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Body, Meta } from '@/components/text';
import { useToastIfAny } from '@/components/toast';
import { useMove } from '@/hooks/use-move';
import { INSET, LABEL_GAP, SPACE } from '@/theme';

/**
 * A John you'd rather not, on Today: who would rather do it and which of
 * theirs it could swap for, with Ask; the line under it says it stays yours
 * if they say no or don't answer by tonight. Once asked, only that line.
 */
export function SwapSuggestion({ houseId, ask, nameOf }: { houseId: string; ask: SwapAsk<BoardItem>; nameOf: (id: string) => string }) {
  const move = useMove(houseId);
  const toast = useToastIfAny();
  if (ask.kind === 'asked') {
    return (
      <Meta style={styles.note} testID="swap-asked">
        {ask.note}
      </Meta>
    );
  }
  return (
    <View style={styles.noted} testID="swap-suggestion">
      <Group>
        <Row
          leading={<Avatar name={nameOf(ask.withUserId)} userId={ask.withUserId} />}
          title={ask.title}
          meta={ask.meta}
          metaLines={2}
          trailing={
            <Button
              variant="outline"
              icon={RepeatIcon}
              label={ask.button}
              disabled={move.pending}
              onPress={async () => {
                if (await move.run(() => askSwap(ask.mine.id, ask.theirs.id))) toast?.show(STEADY_COPY.asked(nameOf(ask.withUserId)));
              }}
              testID="ask-swap"
            />
          }
        />
        {move.problem ? (
          <GroupItem>
            <Alert message={move.problem} />
          </GroupItem>
        ) : null}
      </Group>
      <Meta style={styles.note}>{ask.note}</Meta>
    </View>
  );
}

/** An ask made to you: who asks, what for, and Swap or No thanks. */
export function SwapOfferCard({ houseId, offer, nameOf }: { houseId: string; offer: SwapOfferToYou<BoardItem>; nameOf: (id: string) => string }) {
  const move = useMove(houseId);
  const toast = useToastIfAny();
  const answer = async (accept: boolean) => {
    if (await move.run(() => answerSwap(offer.id, accept))) toast?.show(accept ? STEADY_COPY.swapped : STEADY_COPY.declined);
  };
  return (
    <Section label={offer.title} leading={<Avatar name={nameOf(offer.fromUserId)} userId={offer.fromUserId} size={24} />} testID="swap-offer">
      <GroupItem>
        <Body>{offer.body}</Body>
        <View style={styles.pair}>
          <View style={styles.half}>
            <Button icon={RepeatIcon} label={STEADY_COPY.accept} disabled={move.pending} onPress={() => void answer(true)} testID="accept-swap" />
          </View>
          <View style={styles.half}>
            <Button variant="ghost" label={STEADY_COPY.decline} disabled={move.pending} onPress={() => void answer(false)} testID="decline-swap" />
          </View>
        </View>
        {move.problem ? <Alert message={move.problem} /> : null}
      </GroupItem>
    </Section>
  );
}

const styles = StyleSheet.create({
  noted: { gap: LABEL_GAP },
  // A line under a group, on the leading edge.
  note: { paddingHorizontal: INSET },
  pair: { flexDirection: 'row', gap: SPACE.sm },
  half: { flex: 1 },
});
