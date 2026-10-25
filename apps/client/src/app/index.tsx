import { APP_NAME, FRONT_DOOR, SIGN_IN, TAGLINE, type FrontDoorPoint } from '@app/core';
import { CoinsIcon, MessagesSquareIcon, ShuffleIcon, type LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { HazardTape } from '@/components/hazard-tape';
import { Body, Eyebrow, Heading } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { Wordmark } from '@/components/wordmark';
import { PRIVACY_URL } from '@/links';
import { FONT, SPACE, useTheme } from '@/theme';

const ICON: Record<FrontDoorPoint, LucideIcon> = {
  deal: ShuffleIcon,
  stake: CoinsIcon,
  wall: MessagesSquareIcon,
};

/** The front door, signed out. Every way in leads to sign-in, as on the web. */
export default function FrontDoor() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // The web spreads the points into columns from Tailwind's `sm`.
  const wide = width >= 640;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Wordmark />
          <TextLink href={SIGN_IN} label={FRONT_DOOR.signIn} style={styles.signIn} />
        </View>

        <Card style={styles.hero}>
          <View style={styles.tape}>
            <HazardTape />
          </View>
          <Eyebrow>{FRONT_DOOR.eyebrow}</Eyebrow>
          <Heading style={[styles.headline, wide && styles.headlineWide]}>{FRONT_DOOR.headline}</Heading>
          <Body muted style={styles.tagline}>
            {TAGLINE}
          </Body>
          <View style={[styles.actions, wide && styles.actionsWide]}>
            <Button href={SIGN_IN} label={FRONT_DOOR.start} />
            <Button href={SIGN_IN} label={FRONT_DOOR.join} variant="outline" />
          </View>
        </Card>

        <View style={[styles.points, wide && styles.pointsWide]}>
          {FRONT_DOOR.points.map(({ key, title, body }) => {
            const Icon = ICON[key];
            return (
              <Card key={key} style={wide && styles.pointWide}>
                <Icon size={24} color={colors.foreground} aria-hidden />
                <Heading level={3} style={styles.pointTitle}>
                  {title}
                </Heading>
                <Body muted>{body}</Body>
              </Card>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Body muted>{APP_NAME}</Body>
          <TextLink href={PRIVACY_URL} label="Privacy" muted testID="privacy" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 1024, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The web's header link: small, bold, not underlined.
  signIn: { fontFamily: FONT.bold, fontSize: 14, textDecorationLine: 'none' },
  hero: { paddingTop: SPACE.xxl },
  tape: { position: 'absolute', top: 0, left: 0, right: 0 },
  headline: { marginTop: SPACE.md },
  headlineWide: { fontSize: 60, lineHeight: 57 },
  tagline: { marginTop: SPACE.lg, fontSize: 18, lineHeight: 27 },
  actions: { marginTop: SPACE.xl, gap: SPACE.md },
  actionsWide: { flexDirection: 'row' },
  points: { gap: SPACE.lg },
  pointsWide: { flexDirection: 'row' },
  pointWide: { flex: 1 },
  pointTitle: { marginTop: SPACE.md, marginBottom: SPACE.xs, textTransform: 'none' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, paddingTop: SPACE.xxl },
});
