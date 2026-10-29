import { APP_NAME, DOOR, FRONT_DOOR, FRONT_DOOR_COPY, SIGN_IN, SIGN_IN_COPY, signInPath } from '@app/core';
import { CoinsIcon, ListTodoIcon, ShuffleIcon, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/button';
import { Door, DoorFoot, Sign } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { Body, Heading, Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { TextLink } from '@/components/text-link';
import { CONTENT_MAX, LEADING, ROW_GAP, SPACE, useTheme } from '@/theme';

type Point = (typeof FRONT_DOOR_COPY.points)[number]['key'];

const ICON: Record<Point, LucideIcon> = {
  list: ListTodoIcon,
  share: ShuffleIcon,
  stake: CoinsIcon,
};

/** From this width the two ways in sit side by side. */
const SIDE_BY_SIDE = 560;

/**
 * The front door, signed out: the wordmark, the taped sign with the big caps
 * headline, three plain sentences, and the two ways in. Each way in goes
 * through sign-in carrying where it leads (`next`), so starting a house lands
 * on naming it, and an invite on pasting it.
 */
export default function FrontDoor() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const sideBySide = width >= SIDE_BY_SIDE;

  return (
    <Door
      home
      maxWidth={CONTENT_MAX}
      right={<TextButton href={SIGN_IN} label={FRONT_DOOR.signIn} align="end" testID="sign-in" />}
      testID="front-door"
    >
      <PageTitle />
      <Sign>
        <Heading>{FRONT_DOOR.headline}</Heading>
        <View style={styles.points}>
          {FRONT_DOOR_COPY.points.map(({ key, body }) => {
            const Icon = ICON[key];
            return (
              <View key={key} style={styles.point}>
                <View style={styles.icon}>
                  <Icon size={24} color={colors.foreground} aria-hidden />
                </View>
                <Body style={styles.words}>{body}</Body>
              </View>
            );
          })}
        </View>
        <View style={[styles.ways, sideBySide && styles.waysSideBySide]}>
          <Button href={signInPath(DOOR.start)} label={FRONT_DOOR_COPY.start} testID="start" />
          <Button href={signInPath(DOOR.invite)} label={FRONT_DOOR_COPY.invite} variant="outline" testID="invite" />
        </View>
      </Sign>
      <DoorFoot>
        <View style={styles.foot}>
          <Meta>{APP_NAME}</Meta>
          <TextLink href="/privacy" label={SIGN_IN_COPY.privacy} muted testID="privacy" />
          <TextLink href="/terms" label={SIGN_IN_COPY.termsLink} muted testID="terms" />
        </View>
      </DoorFoot>
    </Door>
  );
}

const styles = StyleSheet.create({
  points: { gap: SPACE.lg },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: ROW_GAP },
  // The icon sits on the first line's middle, in the row's leading slot.
  icon: { width: LEADING, alignItems: 'center' },
  words: { flex: 1 },
  ways: { gap: SPACE.sm },
  waysSideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
});
