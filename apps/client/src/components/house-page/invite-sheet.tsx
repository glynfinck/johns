import { HOUSE_PAGE_COPY, INVITE_COPY } from '@app/core';
import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { SectionLabel } from '@/components/text';
import { SITE_URL } from '@/links';
import { SPACE, useTheme } from '@/theme';

/** What the web build can do with a link: the browser's clipboard and share sheet, where it has them. */
interface WebNavigator {
  clipboard?: { writeText: (text: string) => Promise<void> };
  share?: unknown;
}

function webNavigator(): WebNavigator | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { navigator?: WebNavigator }).navigator;
}

/**
 * Inviting housemates, a brand moment: the join code large and spaced in
 * the road sign's caps, the link under it, then the sheet's one amber
 * "Share invite" (the system share sheet, as the old invite card) and, on
 * the web, "Copy link". A phone has no clipboard module, and its share
 * sheet has a Copy of its own, so there it's Share invite alone; a browser
 * with no share sheet copies the link from Share invite instead.
 */
export function InviteSheet({
  visible,
  onClose,
  code,
  houseName,
}: {
  visible: boolean;
  onClose: () => void;
  code: string;
  houseName: string;
}) {
  const { colors, type } = useTheme();
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/join/${code}`;
  const web = webNavigator();

  async function share() {
    if (web && typeof web.share !== 'function') return copy();
    try {
      await Share.share({ title: INVITE_COPY.shareTitle(houseName), message: url, url });
    } catch {
      // Cancelled: the link is on screen to copy.
    }
  }

  async function copy() {
    const clipboard = web?.clipboard;
    if (!clipboard) return;
    try {
      await clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Not allowed (an insecure page, say): the link is on screen to select.
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      title={HOUSE_PAGE_COPY.invite}
      description={HOUSE_PAGE_COPY.inviteBody}
      testID="invite-sheet"
    >
      <View style={styles.sign}>
        <SectionLabel>{HOUSE_PAGE_COPY.code}</SectionLabel>
        <Text selectable style={[type.title, styles.code]} testID="invite-code">
          {code}
        </Text>
        <Text selectable numberOfLines={1} style={[type.meta, { color: colors.mutedForeground }]} testID="invite-url">
          {url}
        </Text>
      </View>
      <View style={styles.buttons}>
        <Button icon={Share2Icon} label={HOUSE_PAGE_COPY.shareInvite} onPress={() => void share()} testID="share-invite" />
        {web?.clipboard ? (
          <Button
            variant="outline"
            icon={copied ? CheckIcon : CopyIcon}
            label={copied ? INVITE_COPY.copied : HOUSE_PAGE_COPY.copyLink}
            onPress={() => void copy()}
            testID="copy-link"
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sign: { gap: SPACE.xs, marginTop: SPACE.sm },
  // The code to read out across a room: the title's caps, spaced wide.
  code: { letterSpacing: 6 },
  buttons: { gap: SPACE.sm, marginTop: SPACE.md },
});
