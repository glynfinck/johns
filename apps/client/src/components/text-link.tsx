import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { Body } from '@/components/text';
import { TAP } from '@/theme';

/**
 * A link in running text, with a whole thumb's height to land on however
 * small the words. External URLs open in the browser.
 */
export function TextLink({
  href,
  label,
  muted,
  style,
  testID,
}: {
  href: Href;
  label: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.target} testID={testID}>
        <Body muted={muted} style={[styles.label, style]}>
          {label}
        </Body>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: TAP, justifyContent: 'center' },
  label: { textDecorationLine: 'underline' },
});
