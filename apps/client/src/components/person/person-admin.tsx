import { firstName, PERSON_COPY } from '@app/core';
import { ShieldCheckIcon, ShieldOffIcon, UserMinusIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { Housemate } from '@/api/board';
import { removeMember, setRole } from '@/api/settings';
import { Alert } from '@/components/alert';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { useMove } from '@/hooks/use-move';
import { useTheme } from '@/theme';

/**
 * What an admin can do about a housemate, on their page: make them an admin
 * (or a housemate again) at once, and remove them from the house in hazard
 * words, after a confirm. Each goes through the calls House's members list
 * uses, and the database decides; a refusal is a sentence where it was made.
 */
export function PersonAdmin({ houseId, person }: { houseId: string; person: Housemate }) {
  const { colors } = useTheme();
  const role = useMove(houseId);
  const remove = useMove(houseId);
  const [confirming, setConfirming] = useState(false);
  const name = firstName(person.name);
  const admin = person.role === 'admin';

  return (
    <View>
      <Section label={PERSON_COPY.admin} testID="person-admin">
        <Row
          leading={<RowIcon icon={admin ? ShieldOffIcon : ShieldCheckIcon} />}
          title={admin ? PERSON_COPY.makeHousemate : PERSON_COPY.makeAdmin}
          meta={admin ? PERSON_COPY.makeHousemateMeta : PERSON_COPY.makeAdminMeta}
          disabled={role.pending}
          onPress={() => void role.run(() => setRole(houseId, person.userId, admin ? 'member' : 'admin'))}
          testID="toggle-admin"
        />
        {role.problem ? (
          <GroupItem>
            <Alert message={role.problem} />
          </GroupItem>
        ) : null}
        <Row
          leading={<UserMinusIcon size={24} color={colors.hazard} aria-hidden />}
          title={PERSON_COPY.remove(name)}
          tone="hazard"
          onPress={() => setConfirming(true)}
          testID="remove-person"
        />
      </Section>
      <ConfirmSheet
        visible={confirming}
        title={PERSON_COPY.removeTitle(name)}
        body={PERSON_COPY.removeBody(name)}
        confirmLabel={PERSON_COPY.removeConfirm(name)}
        icon={UserMinusIcon}
        busy={remove.pending}
        problem={remove.problem}
        onConfirm={() =>
          void remove.run(() => removeMember(houseId, person.userId)).then((done) => {
            if (done) setConfirming(false);
          })
        }
        onClose={() => setConfirming(false)}
        testID="remove-sheet"
      />
    </View>
  );
}
