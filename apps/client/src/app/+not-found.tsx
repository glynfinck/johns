import { NOT_FOUND_COPY, PAGE_TITLE } from '@app/core';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PageTitle } from '@/components/page-title';
import { Body, Heading } from '@/components/text';
import { Wordmark } from '@/components/wordmark';
import { SPACE, useTheme } from '@/theme';

/** A link to nowhere, as the web's not-found page: say so, and the way back. */
export default function NotFound() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <PageTitle page={PAGE_TITLE.notFound} />
      <View style={styles.page}>
        <Wordmark />
        <Heading level={2}>{NOT_FOUND_COPY.title}</Heading>
        <Body muted>{NOT_FOUND_COPY.body}</Body>
        <View style={styles.start}>
          <Button href="/" label={NOT_FOUND_COPY.back} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 384, alignSelf: 'center', justifyContent: 'center', padding: SPACE.xl, gap: SPACE.lg },
  start: { alignItems: 'flex-start' },
});
