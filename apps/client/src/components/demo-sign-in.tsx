import { DEMO_HOUSEMATES, STAGING_COPY, type DemoHousemate } from '@app/core';
import { UserIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { signInAsDemo } from '@/api/auth';
import { savedStagingPassword } from '@/api/staging';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Meta, SectionLabel } from '@/components/text';
import { SPACE } from '@/theme';

/**
 * Staging only (ON_STAGING): sign in as one of the demo house's four
 * housemates with the staging password, so one person can play the whole
 * house. Signing in moves on by itself, as any sign-in does.
 */
export function DemoSignIn() {
  const [password, setPassword] = useState(savedStagingPassword);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function signIn(who: DemoHousemate) {
    setBusy(who.email);
    setFailed(false);
    try {
      await signInAsDemo(who.email, password);
    } catch (reason) {
      console.warn('demo sign-in failed', reason);
      setFailed(true);
      setBusy(null);
    }
  }

  return (
    <View style={styles.demo} testID="demo-sign-in">
      <SectionLabel>{STAGING_COPY.demoLabel}</SectionLabel>
      <Meta>{STAGING_COPY.demoBody}</Meta>
      <Field
        label={STAGING_COPY.password}
        hint={STAGING_COPY.passwordHint}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        testID="demo-password"
      />
      {failed ? <Alert message={STAGING_COPY.failed} /> : null}
      {DEMO_HOUSEMATES.map((who) => (
        <Button
          key={who.email}
          variant="outline"
          icon={UserIcon}
          label={busy === who.email ? STAGING_COPY.busy : STAGING_COPY.as(who.name)}
          disabled={busy !== null || password.length === 0}
          onPress={() => void signIn(who)}
          testID={`demo-${who.name.toLowerCase()}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  demo: { gap: SPACE.sm },
});
