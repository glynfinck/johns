import { useRef } from 'react';

import type { ButtonIcon } from '@/components/button';
import { Group } from '@/components/group';
import { Row } from '@/components/row';
import { Sheet } from '@/components/sheet';
import { useTheme } from '@/theme';

/** One thing a screen's menu can do. `tone="hazard"` for one that strikes something out. */
export interface MenuAction {
  label: string;
  icon?: ButtonIcon;
  onPress: () => void;
  tone?: 'ink' | 'hazard';
  testID?: string;
}

/**
 * The "•••" menu (TitleBar's MoreButton opens it): a small sheet with one row
 * per action. Choosing one puts the menu away, and the action runs once the
 * menu has gone (on iOS, when its slide out ends), so an action that opens a
 * sheet of its own (a confirm) never meets this one on its way out.
 */
export function ActionMenu({
  visible,
  onClose,
  actions,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  actions: readonly MenuAction[];
  testID?: string;
}) {
  const { colors } = useTheme();
  const chosen = useRef<(() => void) | null>(null);

  function dismissed() {
    const run = chosen.current;
    chosen.current = null;
    run?.();
  }

  return (
    <Sheet visible={visible} onClose={onClose} onDismissed={dismissed} flush testID={testID}>
      <Group>
        {actions.map(({ label, icon: Icon, onPress, tone = 'ink', testID: actionID }) => (
          <Row
            key={label}
            title={label}
            tone={tone}
            leading={Icon ? <Icon size={24} color={tone === 'hazard' ? colors.hazard : colors.foreground} aria-hidden /> : undefined}
            onPress={() => {
              chosen.current = onPress;
              onClose();
            }}
            testID={actionID}
          />
        ))}
      </Group>
    </Sheet>
  );
}
