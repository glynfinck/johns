import { FOCUS_SHELL_COPY } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/components/alert';
import { Button, type ButtonIcon } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { SPACE } from '@/theme';

/**
 * "Are you sure?", for a move that can't be taken back or costs something
 * (Re-deal this week, Remove a housemate, Leave the house): the question as
 * the sheet's Lead, what it costs in a sentence, then the move and Cancel,
 * full width, the move first. `tone="hazard"` makes the move a hazard
 * outline (striking something out); `primary` makes it the sheet's one amber
 * button. `busy` holds both buttons while the move is on its way, and
 * `problem` is the refusal's sentence, shown above them.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  icon,
  tone = 'hazard',
  busy = false,
  problem,
  onConfirm,
  onClose,
  testID,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  icon?: ButtonIcon;
  tone?: 'primary' | 'hazard';
  busy?: boolean;
  problem?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  testID?: string;
}) {
  return (
    <Sheet visible={visible} title={title} description={body} onClose={onClose} testID={testID}>
      {problem ? <Alert message={problem} /> : null}
      <View style={styles.buttons}>
        <Button
          variant={tone}
          icon={icon}
          label={confirmLabel}
          disabled={busy}
          onPress={onConfirm}
          testID="confirm"
        />
        <Button variant="outline" label={FOCUS_SHELL_COPY.cancel} disabled={busy} onPress={onClose} testID="cancel" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: SPACE.sm, marginTop: SPACE.sm },
});
