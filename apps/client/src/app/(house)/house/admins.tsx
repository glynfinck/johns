import { ADMINS_COPY, firstName, HISTORY_COPY, SECTION_LABEL } from '@app/core';
import { ShieldCheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Housemate } from '@/api/board';
import { setRole } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { Group, GroupItem } from '@/components/group';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { Row, RowIcon } from '@/components/row';
import { Screen } from '@/components/screen';
import { ChoiceRow } from '@/components/setup/choice-row';
import { Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { TitleBar } from '@/components/title-bar';
import { useHouse, type HouseView } from '@/hooks/use-house';
import { useMembership } from '@/hooks/use-membership';
import { useMove } from '@/hooks/use-move';
import { usePull } from '@/hooks/use-refresh';
import { useUndoOffer } from '@/hooks/use-undo-offer';
import { INSET, SECTION_GAP } from '@/theme';

/**
 * Admins, pushed from House's setup: who looks after the house, one row
 * each, and "Add an admin", which picks from the housemates who aren't one.
 * An admin can step another down with Remove at once, as Make admin is at
 * once, and either offers Undo in the toast; the house always keeps one
 * (the database checks), and the only admin leaves from House by handing
 * over. Housemates see the list without the buttons.
 */
export default function AdminsScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <AdminsFor houseId={house!.id} userId={session!.user.id} />;
}

function AdminsFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { query, view } = useHouse(houseId, userId);
  const { refreshing, pull } = usePull(houseId, query.refetch);
  return (
    <Screen
      bar={<TitleBar title={ADMINS_COPY.title} back="/house" backLabel={SECTION_LABEL.house} />}
      refreshing={refreshing}
      onRefresh={pull}
      testID="admins-screen"
    >
      <PageTitle page={ADMINS_COPY.title} />
      {view ? (
        <Admins houseId={houseId} userId={userId} view={view} />
      ) : query.isError ? (
        <ReadFailed onRetry={() => void query.refetch()} />
      ) : (
        <Reading />
      )}
    </Screen>
  );
}

function Admins({ houseId, userId, view }: { houseId: string; userId: string; view: HouseView }) {
  const role = useMove(houseId);
  const offer = useUndoOffer(houseId);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const { members } = view.snapshot;
  const admins = members.filter((m) => m.role === 'admin');
  const others = members.filter((m) => m.role !== 'admin');
  const amAdmin = view.me?.role === 'admin';

  function change(person: Housemate, to: 'admin' | 'member') {
    const name = firstName(person.name);
    return role.run(() => setRole(houseId, person.userId, to)).then((done) => {
      if (done) offer(to === 'admin' ? HISTORY_COPY.madeAdmin(name) : HISTORY_COPY.madeHousemate(name), 'role', person.userId);
      return done;
    });
  }

  const chosen = others.find((m) => m.userId === pick) ?? null;
  return (
    <View style={styles.stack}>
      <Group testID="admins-list">
        {admins.map((m) => (
          <Row
            key={m.userId}
            leading={<Avatar name={m.name} me={m.userId === userId} />}
            title={m.userId === userId ? `${m.name} · ${ADMINS_COPY.started}` : m.name}
            trailing={
              amAdmin && admins.length > 1 && m.userId !== userId ? (
                <TextButton
                  label={ADMINS_COPY.remove}
                  accessibilityLabel={ADMINS_COPY.removeLabel(firstName(m.name))}
                  disabled={role.pending}
                  onPress={() => void change(m, 'member')}
                  testID="remove-admin"
                />
              ) : undefined
            }
            testID="admin-row"
          />
        ))}
        {amAdmin ? (
          <Row
            leading={<RowIcon icon={ShieldCheckIcon} />}
            title={ADMINS_COPY.add}
            meta={others.length === 0 ? ADMINS_COPY.everyoneIs : undefined}
            disabled={others.length === 0}
            onPress={() => {
              setPick(null);
              setAdding(true);
            }}
            testID="add-admin"
          />
        ) : null}
        {role.problem && !adding ? (
          <GroupItem>
            <Alert message={role.problem} />
          </GroupItem>
        ) : null}
      </Group>
      <Meta style={styles.note}>{admins.length === 1 && amAdmin ? `${ADMINS_COPY.note} ${ADMINS_COPY.onlyAdmin}` : ADMINS_COPY.note}</Meta>
      <ConfirmSheet
        visible={adding}
        title={ADMINS_COPY.addTitle}
        body={ADMINS_COPY.addBody}
        confirmLabel={chosen ? ADMINS_COPY.make(firstName(chosen.name)) : null}
        icon={ShieldCheckIcon}
        tone="primary"
        busy={role.pending}
        problem={role.problem}
        onConfirm={() =>
          void change(chosen!, 'admin').then((done) => {
            if (done) setAdding(false);
          })
        }
        onClose={() => setAdding(false)}
        testID="add-admin-sheet"
      >
        <Group>
          {others.map((m) => (
            <ChoiceRow
              key={m.userId}
              role="radio"
              label={m.name}
              leading={<Avatar name={m.name} userId={m.userId} />}
              checked={pick === m.userId}
              onPress={() => setPick(m.userId)}
              testID="admin-pick"
            />
          ))}
        </Group>
      </ConfirmSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SECTION_GAP / 2 },
  note: { paddingHorizontal: INSET },
});
