import { APP_NAME, FRONT_DOOR, TAGLINE, type FrontDoorPoint } from '@app/core';
import { Link } from 'expo-router';
import { CoinsIcon, MessagesSquareIcon, ShuffleIcon, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { HazardTape } from '@/components/hazard-tape';
import { Body, Eyebrow, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { SPACE, TAP, useTheme } from '@/theme';

const ICON: Record<FrontDoorPoint, LucideIcon> = {
  deal: ShuffleIcon,
  stake: CoinsIcon,
  wall: MessagesSquareIcon,
};

const PRIVACY_URL = 'https://johns.glyn.dev/privacy';

/** The front door, signed out. Sign-in arrives in Phase 4 of docs/specs/native-migration.md. */
export default function FrontDoor() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // The web spreads the points into columns from Tailwind's `sm`.
  const wide = width >= 640;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Wordmark />

        <Card style={styles.hero}>
          <View style={styles.tape}>
            <HazardTape />
          </View>
          <Eyebrow>{FRONT_DOOR.eyebrow}</Eyebrow>
          <Heading style={[styles.headline, wide && styles.headlineWide]}>{FRONT_DOOR.headline}</Heading>
          <Body muted style={styles.tagline}>
            {TAGLINE}
          </Body>
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
          <Link href={PRIVACY_URL} asChild>
            <Pressable accessibilityRole="link" style={styles.linkTarget} testID="privacy">
              <Body muted style={styles.link}>
                Privacy
              </Body>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 1024, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  hero: { paddingTop: SPACE.xxl },
  tape: { position: 'absolute', top: 0, left: 0, right: 0 },
  headline: { marginTop: SPACE.md },
  headlineWide: { fontSize: 60, lineHeight: 57 },
  tagline: { marginTop: SPACE.lg, fontSize: 18, lineHeight: 27 },
  points: { gap: SPACE.lg },
  pointsWide: { flexDirection: 'row' },
  pointWide: { flex: 1 },
  pointTitle: { marginTop: SPACE.md, marginBottom: SPACE.xs, textTransform: 'none' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, paddingTop: SPACE.xxl },
  linkTarget: { minHeight: TAP, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
});
