import { normaliseJoinCode, NO_HOUSE_COPY, SIGN_IN_COPY } from '@app/core';
import { router } from 'expo-router';
import { HomeIcon, LogOutIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Field } from '@/components/field';
import { PageTitle } from '@/components/page-title';
import { Body, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { SPACE, useTheme } from '@/theme';

/**
 * Signed in, in no house: start one, or join one with the code from a
 * housemate's link (a link opened on the phone lands on the join screen
 * itself). Signing out is here too, for whoever signed in with the wrong
 * account.
 */
export default function Welcome() {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | undefined>();

  function join() {
    const tidy = normaliseJoinCode(code);
    if (!tidy) {
      setProblem(NO_HOUSE_COPY.badCode);
      return;
    }
    router.push(`/join/${tidy}`);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <PageTitle />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Wordmark />
        <View>
          <Heading>{NO_HOUSE_COPY.heading}</Heading>
          <Body muted style={styles.body}>
            {NO_HOUSE_COPY.body}
          </Body>
        </View>

        <Button href="/house/new" label={NO_HOUSE_COPY.start} icon={HomeIcon} />

        <Card style={styles.join}>
          <Field
            label={NO_HOUSE_COPY.code}
            hint={NO_HOUSE_COPY.codeHint}
            problem={problem}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setProblem(undefined);
            }}
            onSubmitEditing={join}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={12}
            returnKeyType="go"
            testID="join-code"
          />
          <Button variant="outline" label={NO_HOUSE_COPY.join} onPress={join} disabled={!code.trim()} />
        </Card>

        <View style={styles.leave}>
          <Button variant="ghost" icon={LogOutIcon} label={SIGN_IN_COPY.signOut} onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 512, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  body: { marginTop: SPACE.sm },
  join: { gap: SPACE.lg },
  leave: { alignItems: 'flex-start' },
});
