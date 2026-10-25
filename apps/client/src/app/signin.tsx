import { APP_NAME, SIGN_IN_COPY, signInReason, withAlpha, type SignInProvider } from '@app/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appleSignInAvailable, signInWithApple, signInWithGoogle, type SignInResult } from '@/api/auth';
import { Button } from '@/components/button';
import { GoogleIcon } from '@/components/google-icon';
import { Body, Heading } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { Wordmark } from '@/components/wordmark';
import { PRIVACY_URL } from '@/links';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * Sign in: Apple then Google on iOS, Google elsewhere. Once a session exists
 * the root layout's guard moves on to the signed-in screens by itself.
 */
export default function SignIn() {
  const { colors, scheme } = useTheme();
  // The web build comes back here from Google; a failure arrives as ?error=.
  const { error } = useLocalSearchParams<{ error?: string }>();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<SignInProvider | null>(null);
  const [failed, setFailed] = useState<SignInProvider | null>(error ? 'Google' : null);

  useEffect(() => {
    let active = true;
    appleSignInAvailable()
      .then((available) => {
        if (active) setApple(available);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function attempt(provider: SignInProvider, signIn: () => Promise<SignInResult>) {
    setBusy(provider);
    setFailed(null);
    try {
      // Redirected: the page is leaving for Google, so stay busy.
      if ((await signIn()) !== 'redirected') setBusy(null);
    } catch (reason) {
      console.warn(`${provider} sign-in failed`, reason);
      setFailed(provider);
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={APP_NAME} style={styles.home}>
            <Wordmark size={32} />
          </Pressable>
        </Link>

        <View>
          <Heading level={2}>{SIGN_IN_COPY.heading}</Heading>
          <Body muted style={styles.reason}>
            {apple ? SIGN_IN_COPY.eitherAccount : signInReason(null)}
          </Body>
        </View>

        {failed ? (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.alert, { backgroundColor: withAlpha(colors.hazard, 0.1) }]}
          >
            <Text style={[styles.alertText, { color: colors.hazard }]}>{SIGN_IN_COPY.failed(failed)}</Text>
          </View>
        ) : null}

        {apple ? (
          // Apple's own button: its look is Apple's rule, not Bin Night's.
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={RADIUS}
            style={styles.apple}
            onPress={() => void attempt('Apple', signInWithApple)}
            testID="apple-sign-in"
          />
        ) : null}

        <Button
          variant="outline"
          icon={GoogleIcon}
          label={busy === 'Google' ? SIGN_IN_COPY.googleBusy : SIGN_IN_COPY.google}
          disabled={busy !== null}
          onPress={() => void attempt('Google', signInWithGoogle)}
          testID="google-sign-in"
        />

        {apple ? <Body muted>{SIGN_IN_COPY.sameAccount}</Body> : null}

        <View style={styles.terms}>
          <Body muted style={styles.small}>
            {SIGN_IN_COPY.terms}
          </Body>
          <TextLink href={PRIVACY_URL} label={SIGN_IN_COPY.privacy} muted style={styles.small} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
    gap: SPACE.xl,
  },
  home: { alignSelf: 'flex-start' },
  reason: { marginTop: SPACE.xs },
  alert: { borderRadius: RADIUS, padding: SPACE.md },
  alertText: { fontFamily: FONT.bold, fontSize: 14, lineHeight: 20 },
  apple: { height: TAP, width: '100%' },
  terms: { gap: 0 },
  small: { fontSize: 12, lineHeight: 16 },
});
