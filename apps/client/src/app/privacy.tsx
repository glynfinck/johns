import { PAGE_TITLE, PRIVACY_COPY } from '@app/core';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/components/page-title';
import { Body, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { SPACE, useTheme } from '@/theme';

/** What Johns keeps and who sees it, as the web's /privacy. Open to anyone, signed in or not. */
export default function Privacy() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <PageTitle page={PAGE_TITLE.privacy} />
      <ScrollView contentContainerStyle={styles.page}>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Johns" style={styles.home}>
            <Wordmark />
          </Pressable>
        </Link>
        <Heading>{PRIVACY_COPY.title}</Heading>
        <View style={styles.text}>
          {PRIVACY_COPY.paragraphs.map((p) => (
            <Body key={p}>{p}</Body>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 672, alignSelf: 'center', padding: SPACE.xl, gap: SPACE.xl },
  home: { alignSelf: 'flex-start' },
  text: { gap: SPACE.lg },
});
