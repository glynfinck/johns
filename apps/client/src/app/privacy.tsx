import { FRONT_DOOR_COPY, PAGE_TITLE, PRIVACY_COPY } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { GroupItem } from '@/components/group';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Body } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { SPACE } from '@/theme';

/**
 * What Jonz keeps and who sees it, in the web's /privacy words under
 * headings: what we keep, what we don't, who sees what, deleting your data.
 * Open to anyone, signed in or not; Back goes where you came from, or to the
 * front door (which, signed in, is your house).
 */
export default function Privacy() {
  return (
    <>
      <PageTitle page={PAGE_TITLE.privacy} />
      <Screen bar={<TitleBar title={PRIVACY_COPY.title} back="/" />} testID="privacy-screen">
        {FRONT_DOOR_COPY.privacy.map(({ heading, body }) => (
          <Section key={heading} label={heading}>
            <GroupItem>
              <View style={styles.words}>
                {body.map((paragraph) => (
                  <Body key={paragraph}>{paragraph}</Body>
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
});
