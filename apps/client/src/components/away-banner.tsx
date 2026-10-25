import { addDaysTo, AWAY_COPY, currentOrNext, dateRange, type AwayPeriod } from '@app/core';
import { PlaneIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Body } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { FONT, SPACE, useTheme } from '@/theme';

/**
 * Your time away on Today, as the web's banner: when you're gone (or until
 * when, once you are), and what your share does meanwhile. Only a trip
 * that's on now or starts within a fortnight.
 */
export function AwayBanner({
  periods,
  me,
  today,
  makeup,
}: {
  periods: AwayPeriod[];
  me: string;
  today: string;
  makeup: number;
}) {
  const { colors } = useTheme();
  const trip = currentOrNext(periods, me, today);
  if (!trip || trip.startsOn > addDaysTo(today, 14)) return null;
  const now = trip.startsOn <= today;
  return (
    <Card style={styles.card}>
      <View testID="away-banner" accessibilityLabel={AWAY_COPY.yours} style={styles.row}>
        <PlaneIcon size={20} color={colors.foreground} aria-hidden />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {AWAY_COPY.banner(now ? dateRange(trip.endsOn, trip.endsOn) : dateRange(trip.startsOn, trip.endsOn), now)}
          </Text>
          <Body muted style={styles.body}>
            {AWAY_COPY.bannerBody(makeup)}
          </Body>
        </View>
        <TextLink href="/house" label={AWAY_COPY.change} style={styles.link} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: FONT.extrabold, fontSize: 14 },
  body: { fontSize: 14, lineHeight: 20 },
  link: { fontFamily: FONT.bold, fontSize: 12 },
});
