import { ADMIN_COPY, BIN_NIGHT, type QrShape } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { CheckIcon, CopyIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
          {factor.data.qr ? <QrCode qr={factor.data.qr} /> : null}
          {Platform.OS !== 'web' ? (
            <TextButton label={ADMIN_COPY.addToPasswords} onPress={() => void Linking.openURL(factor.data.uri)} />
          ) : null}
          {/* Never a silent gap: without a code to scan, say to type the key. */}
          <Meta testID={factor.data.qr ? undefined : 'admin-no-qr'}>{factor.data.qr ? ADMIN_COPY.copyKey : ADMIN_COPY.noQr}</Meta>
          <Text selectable style={[styles.key, { color: colors.foreground }]} testID="admin-key">
            {factor.data.secret.replace(/(.{4})/g, '$1 ').trim()}
          </Text>
          <CopyKey secret={factor.data.secret} />
          <CodeForm factorId={factor.data.id} label={ADMIN_COPY.added} onPassed={onPassed} />
        </>
      ) : null}
    </Frame>
  );
}

/**
 * Copies the key as it is, without the spaces that make it readable, which
 * every authenticator app accepts. The button says it's done for a few
 * seconds, like Copy link on the invite sheet.
 */
function CopyKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="outline"
      icon={copied ? CheckIcon : CopyIcon}
      label={copied ? ADMIN_COPY.keyCopied : ADMIN_COPY.copyKeyButton}
      onPress={() =>
        void Clipboard.setStringAsync(secret).then(
          () => setCopied(true),
          () => undefined, // Not allowed here: the key is on screen to select.
        )
      }
      testID="admin-copy-key"
    />
  );
}

const QR_SIZE = 200;

/**
 * The code to scan, centred in its own square. A QR code scans only dark on
 * light, so it keeps daylight's colours whatever the theme. Its quiet border
 * is part of the drawing, so the card needs no padding of its own.
 */
function QrCode({ qr }: { qr: QrShape }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.qr, { backgroundColor: BIN_NIGHT.light.card, borderColor: colors.border }]} testID="admin-qr">
      <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${qr.size} ${qr.size}`}>
        <Path d={qr.path} fill={BIN_NIGHT.light.cardForeground} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', paddingHorizontal: GUTTER + INSET, paddingTop: SPACE.xxl * 2 },
  column: { width: '100%', maxWidth: CONTENT_MAX / 1.4, gap: SPACE.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  qr: { alignSelf: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  key: { fontFamily: FONT.bold, fontSize: 17, letterSpacing: 2, ...TABULAR },
});
