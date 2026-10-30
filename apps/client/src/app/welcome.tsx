import { DOOR, FRONT_DOOR_COPY, inviteCode, MOVING_COPY, NO_HOUSE_COPY, PAGE_TITLE, SIGN_IN_COPY } from '@app/core';
import { router } from 'expo-router';
import { LogOutIcon, TruckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Door, DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { SectionLabel } from '@/components/text';
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
  const moving = useMovingOn().data ?? null;
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

const styles = StyleSheet.create({
  // The invite starts a second part of the sign.
  invite: { marginTop: SPACE.lg },
});
