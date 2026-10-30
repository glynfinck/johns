import { ADMIN_COPY, BIN_NIGHT } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { checkCode, enrollFactor, verifiedFactor } from '@/api/owner';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { ReadFailed, Reading } from '@/components/read-state';
import { Chip } from '@/components/status-mark';
import { Body, Meta, Title } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { Wordmark } from '@/components/wordmark';
import { CONTENT_MAX, FONT, GUTTER, INSET, SPACE, TABULAR, useTheme } from '@/theme';

/**
 * The second lock on the admin page: the owner's code from an authenticator
 * app. The first time, it adds the authenticator (a QR code to scan, or a key
 * to type); every time after, it asks for the code. Passing it raises this
 * session to aal2, which the database checks on every admin read and write.
 */
export function CodeGate({ onPassed }: { onPassed: () => void }) {
  const factor = useQuery({ queryKey: ['owner-factor'], queryFn: verifiedFactor, staleTime: Infinity });
  if (factor.isPending) return <Reading />;
  if (factor.isError) return <ReadFailed onRetry={() => void factor.refetch()} />;
  return factor.data ? <EnterCode factorId={factor.data} onPassed={onPassed} /> : <AddAuthenticator onPassed={onPassed} />;
}

function Frame({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: colors.background }]} testID="code-gate">
      <View style={styles.column}>
        <View style={styles.brand}>
          <Wordmark size={20} />
          <Chip label={ADMIN_COPY.owner} />
        </View>
        <Title>{title}</Title>
        <Body muted>{body}</Body>
        {children}
      </View>
    </View>
  );
}

function CodeForm({ factorId, label, onPassed }: { factorId: string; label: string; onPassed: () => void }) {
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const submit = async () => {
    setChecking(true);
    const ok = await checkCode(factorId, code);
    setChecking(false);
    if (ok) onPassed();
    else setProblem(ADMIN_COPY.wrongCode);
  };
  return (
    <>
      <Field
        label={ADMIN_COPY.codeLabel}
        value={code}
        onChangeText={(text) => {
          setCode(text.replace(/[^\d]/g, '').slice(0, 6));
          setProblem(undefined);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        problem={problem}
        onSubmitEditing={() => void submit()}
        testID="admin-code"
      />
      <Button label={label} onPress={() => void submit()} disabled={code.length !== 6 || checking} testID="admin-code-submit" />
    </>
  );
}

function EnterCode({ factorId, onPassed }: { factorId: string; onPassed: () => void }) {
  return (
    <Frame title={ADMIN_COPY.codeTitle} body={ADMIN_COPY.codeBody}>
      <CodeForm factorId={factorId} label={ADMIN_COPY.open} onPassed={onPassed} />
    </Frame>
  );
}

function AddAuthenticator({ onPassed }: { onPassed: () => void }) {
  const { colors } = useTheme();
  const factor = useQuery({ queryKey: ['owner-enroll'], queryFn: enrollFactor, staleTime: Infinity, gcTime: 0 });
  return (
    <Frame title={ADMIN_COPY.lockTitle} body={ADMIN_COPY.lockBody}>
      {factor.isPending ? <Reading /> : null}
      {factor.isError ? <ReadFailed onRetry={() => void factor.refetch()} /> : null}
      {factor.data ? (
        <>
          {/* A QR code scans only dark on light, so it keeps daylight's card whatever the theme. */}
          <View style={[styles.qr, { backgroundColor: BIN_NIGHT.light.card, borderColor: colors.border }]} testID="admin-qr">
            <SvgXml xml={factor.data.qrSvg} width={176} height={176} />
          </View>
          {Platform.OS !== 'web' ? (
            <TextButton label={ADMIN_COPY.addToPasswords} onPress={() => void Linking.openURL(factor.data.uri)} />
          ) : null}
          <Meta>{ADMIN_COPY.copyKey}</Meta>
          <Text selectable style={[styles.key, { color: colors.foreground }]} testID="admin-key">
            {factor.data.secret.replace(/(.{4})/g, '$1 ').trim()}
          </Text>
          <CodeForm factorId={factor.data.id} label={ADMIN_COPY.added} onPassed={onPassed} />
        </>
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', paddingHorizontal: GUTTER + INSET, paddingTop: SPACE.xxl * 2 },
  column: { width: '100%', maxWidth: CONTENT_MAX / 1.4, gap: SPACE.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  qr: { alignSelf: 'center', padding: SPACE.md, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  key: { fontFamily: FONT.bold, fontSize: 17, letterSpacing: 2, ...TABULAR },
});
