import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { Body, Meta } from '@/components/text';
import { TAP } from '@/theme';

/**
 * A link in running text, with a whole thumb's height to land on however
 * small the words. External URLs open in the browser. `small` sets it at
 * Meta's size, for a link in the small print beside Meta words.
 */
export function TextLink({
  href,
  label,
  muted,
  small,
  style,
  testID,
}: {
  href: Href;
  label: string;
  muted?: boolean;
  small?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.target} testID={testID}>
        {small ? (
          <Meta style={[styles.label, style]}>{label}</Meta>
        ) : (
          <Body muted={muted} style={[styles.label, style]}>
            {label}
          </Body>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: TAP, justifyContent: 'center' },
  label: { textDecorationLine: 'underline' },
});
