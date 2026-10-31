import {
  codeProblem,
  EMAIL_SIGN_IN_COPY as COPY,
  emailAuthProblem,
  emailLooksRight,
  passwordProblem,
  type EmailStep,
} from '@app/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  confirmEmail,
  resendSignUpCode,
  resetPassword,
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from '@/api/email-auth';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { SPACE, useTheme } from '@/theme';

type Problem = { field?: 'email' | 'password' | 'code'; message: string };

/**
 * The sign-in sign's email part, under Google and Microsoft: sign in with
 * an email and password, make an account (a 6-digit code by email proves
 * the address), or reset a forgotten password the same way. Signing in moves
 * on by itself, as any sign-in does.
 */
export function EmailSignIn() {
  const { colors } = useTheme();
  const [step, setStep] = useState<EmailStep>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function go(next: EmailStep) {
    setStep(next);
    setProblem(null);
    setNote(null);
    setCode('');
    if (next !== 'confirm') setPassword('');
  }

  /** Checks what's typed, then runs `act`; a refusal from Supabase becomes words. */
  async function run(checks: (Problem | null)[], act: () => Promise<void>) {
    const first = checks.find(Boolean);
    if (first) return setProblem(first);
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      await act();
    } catch (reason) {
      console.warn('email sign-in failed', reason);
      const message = emailAuthProblem(reason as { code?: string; status?: number });
      // An unconfirmed account gets a fresh code, and the code step.
      if ((reason as { code?: string }).code === 'email_not_confirmed') {
        await resendSignUpCode(email).catch(() => undefined);
        setStep('confirm');
      }
      setProblem({ message });
    } finally {
      setBusy(false);
    }
  }

  const emailCheck = (): Problem | null => (emailLooksRight(email) ? null : { field: 'email', message: COPY.badEmail });
  const passwordCheck = (): Problem | null => {
    const message = passwordProblem(password);
    return message ? { field: 'password', message } : null;
  };
  const codeCheck = (): Problem | null => {
    const message = codeProblem(code);
    return message ? { field: 'code', message } : null;
  };
  const fieldProblem = (field: Problem['field']) => (problem && problem.field === field ? problem.message : undefined);

  const emailField = (
    <Field
      label={COPY.email}
      value={email}
      onChangeText={setEmail}
      problem={fieldProblem('email')}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      editable={!busy}
      testID="email-address"
    />
  );
  const codeField = (hint: string) => (
    <Field
      label={COPY.code}
      hint={hint}
      value={code}
      onChangeText={setCode}
      problem={fieldProblem('code')}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={9}
      editable={!busy}
      testID="email-code"
    />
  );
  const passwordField = (fresh: boolean) => (
    <Field
      label={step === 'reset' ? COPY.newPassword : COPY.password}
      hint={fresh ? COPY.passwordHint : undefined}
      value={password}
      onChangeText={setPassword}
      problem={fieldProblem('password')}
      secureTextEntry
      autoCapitalize="none"
      autoComplete={fresh ? 'new-password' : 'current-password'}
      textContentType={fresh ? 'newPassword' : 'password'}
      editable={!busy}
      testID="email-password"
    />
  );
  const loose = problem && !problem.field ? <Alert message={problem.message} /> : null;
  const told = note ? <Meta>{note}</Meta> : null;

  return (
    <View style={styles.email} testID="email-sign-in">
      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Meta>{COPY.or}</Meta>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      {step === 'sign-in' ? (
        <>
          {emailField}
          {passwordField(false)}
          {loose}
          <Button
            label={busy ? COPY.signInBusy : COPY.signIn}
            disabled={busy}
            onPress={() => void run([emailCheck(), password ? null : passwordCheck()], () => signInWithEmail(email, password))}
            testID="email-sign-in-button"
          />
          <TextButton label={COPY.toForgot} align="start" onPress={() => go('forgot')} disabled={busy} />
          <TextButton label={COPY.toSignUp} align="start" onPress={() => go('sign-up')} disabled={busy} testID="to-sign-up" />
        </>
      ) : null}

      {step === 'sign-up' ? (
        <>
          {emailField}
          {passwordField(true)}
          {loose}
          <Button
            label={busy ? COPY.signUpBusy : COPY.signUp}
            disabled={busy}
            onPress={() =>
              void run([emailCheck(), passwordCheck()], async () => {
                if ((await signUpWithEmail(email, password)) === 'code-sent') go('confirm');
              })
            }
            testID="email-sign-up-button"
          />
          <TextButton label={COPY.toSignIn} align="start" onPress={() => go('sign-in')} disabled={busy} />
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          {codeField(COPY.codeHint(email.trim()))}
          <Meta>{COPY.existingHint}</Meta>
          {loose}
          {told}
          <Button
            label={busy ? COPY.confirmBusy : COPY.confirm}
            disabled={busy}
            onPress={() => void run([codeCheck()], () => confirmEmail(email, code))}
            testID="email-confirm-button"
          />
          <TextButton
            label={COPY.resend}
            align="start"
            disabled={busy}
            onPress={() => void run([], async () => {
              await resendSignUpCode(email);
              setNote(COPY.resent);
            })}
          />
          <TextButton label={COPY.back} align="start" onPress={() => go('sign-in')} disabled={busy} />
        </>
      ) : null}

      {step === 'forgot' ? (
        <>
          <Meta>{COPY.forgotBody}</Meta>
          {emailField}
          {loose}
          <Button
            label={busy ? COPY.sendResetBusy : COPY.sendReset}
            disabled={busy}
            onPress={() =>
              void run([emailCheck()], async () => {
                await sendPasswordReset(email);
                go('reset');
              })
            }
            testID="email-forgot-button"
          />
          <TextButton label={COPY.back} align="start" onPress={() => go('sign-in')} disabled={busy} />
        </>
      ) : null}

      {step === 'reset' ? (
        <>
          {codeField(COPY.resetBody(email.trim()))}
          {passwordField(true)}
          {loose}
          {told}
          <Button
            label={busy ? COPY.resetBusy : COPY.reset}
            disabled={busy}
            onPress={() => void run([codeCheck(), passwordCheck()], () => resetPassword(email, code, password))}
            testID="email-reset-button"
          />
          <TextButton
            label={COPY.resend}
            align="start"
            disabled={busy}
            onPress={() => void run([], async () => {
              await sendPasswordReset(email);
              setNote(COPY.resent);
            })}
          />
          <TextButton label={COPY.back} align="start" onPress={() => go('sign-in')} disabled={busy} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  email: { gap: SPACE.sm, marginTop: SPACE.sm },
  or: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
