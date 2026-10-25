import { APP_NAME, SIGN_IN_COPY, signInReason, type SignInProvider } from '@app/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { appleSignInAvailable, signInWithApple, signInWithGoogle, type SignInResult } from '@/api/auth';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { GoogleIcon } from '@/components/google-icon';
import { Body, Heading } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { Wordmark } from '@/components/wordmark';
import { PRIVACY_URL } from '@/links';
import { RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * Sign-in: Apple then Google on iOS, Google elsewhere. The sign-in screen is
 * this on its own; a join link shows it in place, so the code survives.
 * `returnTo` is where the web comes back from Google; `failed` says Google
 * already turned the web back once.
 */
export function SignInPanel({ returnTo, failed: failedBefore = false }: { returnTo?: string; failed?: boolean }) {
  const { scheme } = useTheme();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<SignInProvider | null>(null);
  const [failed, setFailed] = useState<SignInProvider | null>(failedBefore ? 'Google' : null);

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
    <View style={styles.panel}>
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={APP_NAME} style={styles.home}>
          <Wordmark size={32} />
        </Pressable>
      </Link>

      <View>
        <Heading level={2}>{SIGN_IN_COPY.heading}</Heading>
        <Body muted style={styles.reason}>
          {apple && !returnTo ? SIGN_IN_COPY.eitherAccount : signInReason(returnTo)}
        </Body>
      </View>

      {failed ? <Alert message={SIGN_IN_COPY.failed(failed)} /> : null}

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
        onPress={() => void attempt('Google', () => signInWithGoogle(returnTo))}
        testID="google-sign-in"
      />

      {apple ? <Body muted>{SIGN_IN_COPY.sameAccount}</Body> : null}

      <View>
        <Body muted style={styles.small}>
          {SIGN_IN_COPY.terms}
        </Body>
        <TextLink href={PRIVACY_URL} label={SIGN_IN_COPY.privacy} muted style={styles.small} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: SPACE.xl },
  home: { alignSelf: 'flex-start' },
  reason: { marginTop: SPACE.xs },
  apple: { height: TAP, width: '100%' },
  small: { fontSize: 12, lineHeight: 16 },
});
