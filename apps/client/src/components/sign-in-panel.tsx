import { googleReturn, SIGN_IN_COPY, signInLine, type SignInProvider } from '@app/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { appleSignInAvailable, signInWithApple, signInWithGoogle, type SignInResult } from '@/api/auth';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { DoorFoot, Sign, SignHeading } from '@/components/front-door/door';
import { GoogleIcon } from '@/components/google-icon';
import { Meta } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { RADIUS, SPACE, TAP, useTheme } from '@/theme';

/**
 * Sign-in: Apple then Google on iOS, Google elsewhere, on the page's taped
 * sign, with the small print under it. The sign-in screen is this on its
 * own; a join link shows it in place, so the code survives. `next` is where
 * signing in leads (the front door's choice, or the join link): the line
 * under the heading names it, and the web comes back from Google carrying it
 * (core's googleReturn). `failed` says Google already turned the web back once.
 */
export function SignInPanel({ next, failed: failedBefore = false }: { next?: string; failed?: boolean }) {
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
    <>
      <Sign testID="sign-in-panel">
        <SignHeading
          title={SIGN_IN_COPY.heading}
          body={signInLine(next, apple)}
        />

        {failed ? <Alert message={SIGN_IN_COPY.failed(failed)} /> : null}

        <View style={styles.ways}>
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
            onPress={() => void attempt('Google', () => signInWithGoogle(googleReturn(next)))}
            testID="google-sign-in"
          />

          {apple ? <Meta>{SIGN_IN_COPY.sameAccount}</Meta> : null}
        </View>
      </Sign>

      <DoorFoot>
        <Meta>{SIGN_IN_COPY.terms}</Meta>
        <TextLink href="/privacy" label={SIGN_IN_COPY.privacy} muted />
      </DoorFoot>
    </>
  );
}

const styles = StyleSheet.create({
  ways: { gap: SPACE.sm },
  apple: { height: TAP, width: '100%' },
});
