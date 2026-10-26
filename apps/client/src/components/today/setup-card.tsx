import { DEAL_COPY, NEXT_UP_COPY, setupChecklist } from '@app/core';
import { ShuffleIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dealThisWeek } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card, CardRows } from '@/components/card';
import { InviteCard } from '@/components/invite-card';
import { Row } from '@/components/row';
import { Sheet } from '@/components/sheet';
import { Lead, SectionLabel } from '@/components/text';
import { TickCircle } from '@/components/tick-circle';
import { useMove } from '@/hooks/use-move';
import { SPACE } from '@/theme';

/** A checklist step's circle: ticked once it's done. A picture, not a control: the row is the way in. */
function Step({ done }: { done: boolean }) {
  return <TickCircle state={done ? 'done' : 'open'} label={done ? NEXT_UP_COPY.stateLabel.done : NEXT_UP_COPY.stateLabel.open} />;
}

/**
 * An admin's Today before anything is dealt, in Next up's place: the steps
 * to start the house. Add the Johns (the John list), invite the housemates
 * (the join link, in a sheet), then "Deal week 1", across the card, which
 * becomes the screen's amber button once the first two have something.
 * It's there before then too, in outline: the server says what's missing
 * (no Johns yet), and a house of one may deal alone.
 */
export function SetupCard({
  houseId,
  houseName,
  joinCode,
  johns,
  memberCount,
}: {
  houseId: string;
  houseName: string;
  joinCode: string;
  /** The John list; null while it's being read. */
  johns: readonly unknown[] | null;
  memberCount: number;
}) {
  const [inviting, setInviting] = useState(false);
  const deal = useMove(houseId);
  const steps = setupChecklist(johns, memberCount);
  return (
    <>
      <Card testID="next-up">
        <SectionLabel style={styles.label}>{NEXT_UP_COPY.label}</SectionLabel>
        <Lead style={styles.lead}>{NEXT_UP_COPY.setUp(houseName)}</Lead>
        <CardRows testID="setup-steps">
          <Row
            leading={<Step done={steps.johns} />}
            title={NEXT_UP_COPY.addJohns}
            meta={steps.johnCount === null ? undefined : NEXT_UP_COPY.onTheList(steps.johnCount)}
            href="/house/johns"
            chevron
            testID="setup-johns"
          />
          <Row
            leading={<Step done={steps.housemates} />}
            title={NEXT_UP_COPY.invite}
            meta={NEXT_UP_COPY.housemates(memberCount)}
            onPress={() => setInviting(true)}
            chevron
            testID="setup-invite"
          />
        </CardRows>
        <View style={styles.deal}>
          <Button
            variant={steps.ready ? 'primary' : 'outline'}
            icon={ShuffleIcon}
            label={deal.pending ? DEAL_COPY.dealing : NEXT_UP_COPY.dealWeek1}
            disabled={deal.pending}
            onPress={() => void deal.run(() => dealThisWeek(houseId))}
            testID="deal-week"
          />
          {deal.problem ? <Alert message={deal.problem} /> : null}
        </View>
      </Card>
      {/* The join link for now, under its own heading; House's invite sheet takes its place. */}
      <Sheet visible={inviting} onClose={() => setInviting(false)} testID="invite-sheet">
        <InviteCard code={joinCode} houseName={houseName} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  // Overpass's caps sit high in their line.
  label: { paddingTop: 2 },
  lead: { marginTop: SPACE.sm },
  deal: { marginTop: SPACE.lg, gap: SPACE.sm },
});
