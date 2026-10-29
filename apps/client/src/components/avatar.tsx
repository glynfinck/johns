import { initials } from '@app/core';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useOnTint } from '@/components/row';
import { usePhoto } from '@/hooks/photos';
import { useTheme } from '@/theme';

/** Initials are never smaller than 12, so neither is a plate smaller than this. */
const SMALLEST = 24;

/**
 * A housemate on a round plate: the photo from the account they signed in
 * with (Google's, or Microsoft's), found by `userId` among the house's
 * people. Without one, or while it won't load, their initials: theirs on the
 * neutral tint (on the card colour where the row itself is tinted, so the
 * plate still shows), yours on an ink plate with light letters (never
 * amber). 32 in a row's leading slot, 24 in a header, and never smaller
 * than 24.
 */
export function Avatar({
  name,
  userId,
  me = false,
  size: asked = 32,
}: {
  name: string;
  userId?: string | null;
  me?: boolean;
  size?: number;
}) {
  const { colors, type } = useTheme();
  const onTint = useOnTint();
  const size = Math.max(asked, SMALLEST);
  const photo = usePhoto(userId);
  // The address that failed, so a new photo gets its own try.
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = photo !== null && photo !== broken;
  return (
    <View
      aria-hidden
      testID={me ? 'avatar-me' : 'avatar'}
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: me ? colors.foreground : onTint ? colors.card : colors.secondary,
        },
      ]}
    >
      {showPhoto ? (
        <Image
          testID="avatar-photo"
          source={{ uri: photo }}
          // Google's photo addresses refuse some pages that send a referrer.
          referrerPolicy="no-referrer"
          onError={() => setBroken(photo)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[type.initials, styles.letters, { color: me ? colors.card : colors.secondaryForeground }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Overpass's caps sit high in their line, so the letters come down a little.
  letters: { paddingTop: 2 },
});
