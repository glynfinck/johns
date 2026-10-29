import { withAlpha } from '@app/core';
import { CheckIcon, ChevronDownIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Group } from '@/components/group';
import { Row } from '@/components/row';
import { Sheet } from '@/components/sheet';
import { FONT, GROUP_RADIUS, SPACE, TAP, useTheme, WIDE } from '@/theme';

export interface PickOption<T extends string> {
  value: T;
  label: string;
  /** What a screen reader says, where `label` is short for it. */
  spoken?: string;
}

/** How wide the menu is beside the page. */
const MENU = 240;

/**
 * One of a few ways for a section to show itself, chosen from a menu: the
 * Table's This week | October. In the section's header it sits where a
 * TextButton (See all) would, and looks like one: the chosen one's name in
 * Body Bold ink, with a ⌄ after it, on a thumb-tall target whose padding is
 * pulled out so the words end at the header's edge. It opens the choices
 * as rows, the chosen one tinted and ticked: on a phone in a sheet, as the
 * "•••" menu does, and from WIDE in a menu dropped from the words over the
 * page, put away by a tap anywhere else or Escape. Choosing one puts it
 * away. To a screen reader the words are a button that opens a menu, and
 * the choices are a radio group that `label` names; each says its `spoken`
 * name where what it shows is short for one.
 */
export function PickMenu<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: readonly PickOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  testID?: string;
}) {
  const { colors, scheme, type } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Where the menu drops from: under the words, its right edge on theirs.
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const words = useRef<View>(null);
  const chosen = options.find((option) => option.value === value) ?? options[0];

  function show() {
    if (!wide) {
      setOpen(true);
      return;
    }
    words.current?.measureInWindow((x, y, w, h) => {
      setPlace({ top: y + h, right: width - x - w });
      setOpen(true);
    });
  }
  function close() {
    setOpen(false);
    setPlace(null);
  }
  function pick(next: T) {
    close();
    if (next !== value) onChange(next);
  }

  const choices = (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID ? `${testID}-choices` : undefined}>
      <Group>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Row
              key={option.value}
              title={option.label}
              accessibilityLabel={option.spoken}
              selected={on}
              trailing={on ? <CheckIcon size={20} color={colors.foreground} aria-hidden /> : undefined}
              onPress={() => pick(option.value)}
              testID={testID ? `${testID}-${option.value}` : undefined}
            />
          );
        })}
      </Group>
    </View>
  );

  return (
    <>
      <Pressable
        ref={words}
        accessibilityRole="button"
        accessibilityLabel={chosen?.spoken ?? chosen?.label}
        accessibilityState={{ expanded: open }}
        aria-haspopup="menu"
        onPress={show}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        style={[styles.words, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text numberOfLines={1} style={[type.body, styles.bold]}>
          {chosen?.label}
        </Text>
        <ChevronDownIcon size={16} color={colors.foreground} aria-hidden />
      </Pressable>
      {wide ? (
        // On the web a closed react-native-web Modal holds on to focus until it has gone, as the Sheet's does, so a closed menu goes at once.
        open && place ? (
          <Modal visible transparent animationType="none" onRequestClose={close} aria-label={label}>
            <View style={StyleSheet.absoluteFill}>
              {/* Anywhere else puts it away: for a pointer only, as a sheet's scrim is; Escape does it for a keyboard. */}
              <View
                aria-hidden
                onStartShouldSetResponder={() => true}
                onResponderRelease={close}
                style={StyleSheet.absoluteFill}
                testID={testID ? `${testID}-away` : undefined}
              />
              <View
                testID={testID ? `${testID}-menu` : undefined}
                style={[
                  styles.menu,
                  {
                    top: place.top + SPACE.xs,
                    right: Math.max(place.right, SPACE.sm),
                    borderColor: colors.border,
                    // The page's one thing that floats: a soft shadow lifts it off the rows under it.
                    boxShadow: `0 8px 24px ${withAlpha(scheme === 'dark' ? '#000000' : colors.foreground, scheme === 'dark' ? 0.5 : 0.16)}`,
                  },
                ]}
              >
                {choices}
              </View>
            </View>
          </Modal>
        ) : null
      ) : (
        <Sheet visible={open} onClose={close} label={label} flush testID={testID ? `${testID}-sheet` : undefined}>
          {choices}
        </Sheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  words: {
    minHeight: TAP,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    // As an end-aligned TextButton's: the words end at the header's edge.
    marginRight: -SPACE.md,
  },
  bold: { fontFamily: FONT.bold },
  menu: {
    position: 'absolute',
    width: MENU,
    borderRadius: GROUP_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
