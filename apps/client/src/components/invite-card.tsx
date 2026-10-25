import { INVITE_COPY } from '@app/core';
import { Share2Icon } from 'lucide-react-native';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Body, Eyebrow } from '@/components/text';
import { SITE_URL } from '@/links';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

/** The join link, ready for the group chat: the system share sheet, and the code to read out. */
export function InviteCard({ code, houseName }: { code: string; houseName: string }) {
  const { colors } = useTheme();
  const url = `${SITE_URL}/join/${code}`;

  async function share() {
    try {
      await Share.share({ title: INVITE_COPY.shareTitle(houseName), message: url, url });
    } catch {
      // Cancelled, or no share sheet (a desktop browser): the link is on screen to copy.
    }
  }

  return (
    <Card style={styles.card}>
      <Eyebrow>{INVITE_COPY.heading}</Eyebrow>
      <Body>{INVITE_COPY.body}</Body>
      <Text selectable style={[styles.url, { backgroundColor: colors.secondary, color: colors.foreground }]} testID="invite-url">
        {url}
      </Text>
      <Body muted style={styles.code}>
        {`${INVITE_COPY.code} `}
        <Text style={[styles.codeValue, { color: colors.foreground }]}>{code}</Text>
      </Body>
      <View>
        <Button icon={Share2Icon} label={INVITE_COPY.share} onPress={() => void share()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  url: { borderRadius: RADIUS, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, fontSize: 13, fontFamily: FONT.medium },
  code: { fontSize: 13 },
  codeValue: { fontFamily: FONT.black, letterSpacing: 2 },
});
