import { DOOR, FRONT_DOOR_COPY, inviteCode, NO_HOUSE_COPY, SIGN_IN_COPY } from '@app/core';
import { router } from 'expo-router';
import { LogOutIcon } from 'lucide-react-native';
import { useState } from 'react';

import { signOut } from '@/api/auth';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Door, DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { TextButton } from '@/components/text-button';

/**
 * Signed in, in no house: the fallback, and where "I've got an invite"
 * lands. One field takes the invite as it came, a whole link or the code
 * alone, and opens the join screen for it (a link opened on the phone lands
 * there itself). Starting a house instead is a tap away, and signing out is
 * here for whoever signed in with the wrong account.
 */
export default function Welcome() {
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
      <PageTitle />
      <Sign>
        <SignHeading title={NO_HOUSE_COPY.heading} body={FRONT_DOOR_COPY.welcome} />
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
        <Button label={FRONT_DOOR_COPY.open} onPress={open} disabled={!invite.trim()} testID="open-invite" />
      </Sign>
      <DoorFoot>
        <TextButton href={DOOR.start} label={FRONT_DOOR_COPY.startInstead} chevron align="start" />
        <TextButton icon={LogOutIcon} label={SIGN_IN_COPY.signOut} onPress={() => void signOut()} align="start" />
      </DoorFoot>
    </Door>
  );
}
