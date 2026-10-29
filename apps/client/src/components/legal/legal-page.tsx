import type { LegalPage as Page } from '@app/core';
import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GroupItem } from '@/components/group';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Body, Meta } from '@/components/text';
import { TextLink } from '@/components/text-link';
import { TitleBar } from '@/components/title-bar';
import { SPACE } from '@/theme';

/**
 * The Privacy Policy or the Terms: the date and the lead, then each section
 * under its heading, its paragraphs in one card and its links under them. A
 * paragraph starting "• " is a list item, set in from the rest. Open to
 * anyone, signed in or not; Back goes where you came from, or to the front
 * door (which, signed in, is your house).
 */
export function LegalPage({ page, tab, testID }: { page: Page; tab: string; testID: string }) {
  return (
    <>
      <PageTitle page={tab} />
      <Screen bar={<TitleBar title={page.title} back="/" />} testID={testID}>
        <View style={styles.words}>
          <Meta>{page.updated}</Meta>
          <Body>{page.lead}</Body>
        </View>
        {page.sections.map(({ heading, body, links }) => (
          <Section key={heading} label={heading}>
            <GroupItem>
              <View style={styles.words}>
                {body.map((paragraph) =>
                  paragraph.startsWith('• ') ? (
                    <Body key={paragraph} style={styles.item}>
                      {paragraph}
                    </Body>
                  ) : (
                    <Body key={paragraph}>{paragraph}</Body>
                  ),
                )}
                {links?.map(({ label, href }) => (
                  <TextLink key={href} href={href as Href} label={label} muted />
                ))}
              </View>
            </GroupItem>
          </Section>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  words: { gap: SPACE.md },
  item: { paddingLeft: SPACE.md },
});
