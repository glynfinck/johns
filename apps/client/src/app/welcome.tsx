import { dateRange, DOOR, FRONT_DOOR_COPY, inviteCode, MOVING_COPY, NO_HOUSE_COPY, PAGE_TITLE, SIGN_IN_COPY } from '@app/core';
import { router } from 'expo-router';
import { LogOutIcon, TicketXIcon, TruckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { leavePass, type MovingOn } from '@/api/moving';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Door, DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { Meta, SectionLabel } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMovingOn } from '@/hooks/use-moving-on';
import { SPACE } from '@/theme';

/**
 * Signed in, in no house: the fallback, and where "I've got an invite"
 * lands. One field takes the invite as it came, a whole link or the code
 * alone, and opens the join screen for it (a link opened on the phone lands
 * there itself). Starting a house instead is a tap away, and signing out is
 * here for whoever signed in with the wrong account.
 *
 * Just after leaving a house it's the Moving on screen: "Start Jonz in my
 * new place", with the old John list coming too, is the one amber button,
 * and the invite field sits under "I have an invite".
 */
export default function Welcome() {
  const movingOn = useMovingOn();
  const moving = movingOn.data ?? null;
  const [invite, setInvite] = useState('');
  const [problem, setProblem] = useState<string | undefined>();

  function open() {
    const code = inviteCode(invite);
    if (!code) {
      setProblem(FRONT_DOOR_COPY.badInvite);
      return;
    }
    router.push(`/join/${code}`);
  }

  return (
    <Door testID="welcome-screen">
      <PageTitle page={moving ? PAGE_TITLE.movingOn : PAGE_TITLE.welcome} />
      <Sign>
        {moving ? (
          <>
            <SignHeading title={MOVING_COPY.heading} body={MOVING_COPY.body(moving.houseName, moving.johns)} />
            <Button
              label={MOVING_COPY.start}
              icon={TruckIcon}
              href={`${DOOR.start}?from=${moving.fromHouse}`}
              testID="start-from"
            />
            <PassNote moving={moving} onChanged={() => void movingOn.refetch()} />
            <View style={styles.invite}>
              <SectionLabel>{MOVING_COPY.invite}</SectionLabel>
            </View>
          </>
        ) : (
          <SignHeading title={NO_HOUSE_COPY.heading} body={FRONT_DOOR_COPY.welcome} />
        )}
        <Field
          label={FRONT_DOOR_COPY.paste}
          hint={FRONT_DOOR_COPY.pasteHint}
          problem={problem}
          value={invite}
          onChangeText={(text) => {
            setInvite(text);
            setProblem(undefined);
          }}
          onSubmitEditing={open}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="go"
          testID="invite"
        />
        <Button
          label={FRONT_DOOR_COPY.open}
          onPress={open}
          disabled={!invite.trim()}
          variant={moving ? 'outline' : 'primary'}
          testID="open-invite"
        />
      </Sign>
      <DoorFoot>
        <TextButton href={DOOR.start} label={FRONT_DOOR_COPY.startInstead} chevron align="start" />
        <TextButton icon={LogOutIcon} label={SIGN_IN_COPY.signOut} onPress={() => void signOut()} align="start" />
      </DoorFoot>
    </Door>
  );
}

/**
 * The House Pass you bought, on the Moving on screen: it comes with you
 * (the default), with the choice of leaving it for the house you left; or,
 * once left, what happens to it there.
 */
function PassNote({ moving, onChanged }: { moving: MovingOn; onChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  if (moving.pass === 'left') return <Meta testID="pass-left">{MOVING_COPY.passLeft(moving.houseName)}</Meta>;
  if (moving.pass !== 'waiting') return null;
  const until = moving.houseKeepsUntil ? dateRange(moving.houseKeepsUntil, moving.houseKeepsUntil) : null;
  return (
    <View style={styles.pass}>
      <Meta testID="pass-comes">{MOVING_COPY.passComes(moving.houseName, until)}</Meta>
      <TextButton
        icon={TicketXIcon}
        label={MOVING_COPY.leavePass(moving.houseName)}
        align="start"
        disabled={pending}
        onPress={() => {
          setPending(true);
          setProblem(undefined);
          leavePass()
            .then(onChanged)
            .catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
            .finally(() => setPending(false));
        }}
        testID="leave-pass"
      />
      {problem ? <Alert message={problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pass: { gap: SPACE.xs },
  // The invite starts a second part of the sign.
  invite: { marginTop: SPACE.lg },
});
