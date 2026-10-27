import { HOUSE_PAGE_COPY, stakeRules, type HouseRules } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Group, GroupItem } from '@/components/group';
import { Sheet } from '@/components/sheet';
import { Body, RowTitle } from '@/components/text';

/**
 * How points and the stake work, in plain words with the house's own
 * amounts: points, the Stake, immunity, swaps and fair shares, one to an
 * item in one group.
 */
export function RulesSheet({
  visible,
  onClose,
  rules,
  awayMakeup,
}: {
  visible: boolean;
  onClose: () => void;
  rules: HouseRules;
  awayMakeup: number;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={HOUSE_PAGE_COPY.rulesTitle} flush testID="rules-sheet">
      <Group>
        {stakeRules(rules, awayMakeup).map((rule) => (
          <GroupItem key={rule.label}>
            <View style={styles.rule}>
              <RowTitle>{rule.label}</RowTitle>
              <Body>{rule.body}</Body>
            </View>
          </GroupItem>
        ))}
      </Group>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rule: { gap: 2 },
});
