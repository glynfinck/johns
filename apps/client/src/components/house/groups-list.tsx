import { firstName, GROUPS_COPY, membersLine, SETUP_COPY, type GroupDef } from '@app/core';
import { PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Housemate } from '@/api/board';
import { deleteGroup, saveGroup } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Group, GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { ChoiceRow } from '@/components/setup/choice-row';
import { Sheet } from '@/components/sheet';
import { Meta } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { INSET, LABEL_GAP, SECTION_GAP, SPACE } from '@/theme';

type Draft = { id?: string; name: string; memberIds: string[] };

/**
 * Groups: the parts of the house only some of you share. A John can belong
 * to one, and then only that group is handed it. Each group is a row (its
 * name, who's in it), which an admin opens to change; with none yet, a
 * sentence on what a group is for. Several page children, so it goes
 * straight in a Screen.
 */
export function GroupsList({
  houseId,
  groups,
  people,
  me,
  editable,
}: {
  houseId: string;
  groups: GroupDef[];
  people: Housemate[];
  me: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const add = () => setEditing({ name: '', memberIds: [] });

  return (
    <>
      {groups.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={SETUP_COPY.noGroups}
          body={GROUPS_COPY.empty}
          action={editable ? <Button icon={PlusIcon} label={SETUP_COPY.addGroup} onPress={add} testID="add-group" /> : undefined}
          testID="groups"
        />
      ) : (
        <View style={styles.noted} testID="groups">
          <Group>
            {groups.map((g) => {
              const members = membersLine(g.memberIds, people, me);
              return (
                <Row
                  key={g.id}
                  leading={<RowIcon icon={UsersIcon} />}
                  title={g.name}
                  meta={members}
                  chevron={editable}
                  onPress={editable ? () => setEditing({ id: g.id, name: g.name, memberIds: g.memberIds }) : undefined}
                  accessibilityLabel={editable ? `${GROUPS_COPY.edit(g.name)}, ${members}` : undefined}
                  testID="group"
                />
              );
            })}
            {editable ? <Row leading={<RowIcon icon={PlusIcon} />} title={SETUP_COPY.addGroup} onPress={add} testID="add-group" /> : null}
          </Group>
          <Meta style={styles.note}>{SETUP_COPY.groupsNote}</Meta>
        </View>
      )}
      <Sheet
        visible={editing !== null}
        title={editing?.id ? GROUPS_COPY.edit(editing.name) : SETUP_COPY.addGroup}
        description={GROUPS_COPY.hint}
        flush
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <GroupForm
            key={editing.id ?? 'new'}
            houseId={houseId}
            initial={editing}
            people={people}
            me={me}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </>
  );
}

/** A group's name and who's in it, a row each to tick by first name, then Save (the sheet's one amber button) and Delete. */
function GroupForm({
  houseId,
  initial,
  people,
  me,
  onDone,
}: {
  houseId: string;
  initial: Draft;
  people: Housemate[];
  me: string;
  onDone: () => void;
}) {
  const move = useMove(houseId);
  const [name, setName] = useState(initial.name);
  const [picked, setPicked] = useState(() => new Set(initial.memberIds));
  const toggle = (id: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    if (await move.run(() => saveGroup(houseId, { id: initial.id, name, members: [...picked] }))) onDone();
  }

  async function remove() {
    if (initial.id && (await move.run(() => deleteGroup(initial.id!)))) onDone();
  }

  return (
    <View style={styles.form} testID="group-form">
      <Group>
        <GroupItem>
          <Field
            label={GROUPS_COPY.name}
            placeholder={GROUPS_COPY.namePlaceholder}
            value={name}
            onChangeText={setName}
            maxLength={40}
            testID="group-name"
          />
        </GroupItem>
      </Group>
      <Section label={GROUPS_COPY.who}>
        {people.map((p) => (
          <ChoiceRow
            key={p.userId}
            role="checkbox"
            label={p.userId === me ? SETUP_COPY.you : firstName(p.name)}
            checked={picked.has(p.userId)}
            leading={<Avatar name={p.name} me={p.userId === me} />}
            onPress={() => toggle(p.userId)}
          />
        ))}
      </Section>
      <View style={styles.actions}>
        {move.problem ? <Alert message={move.problem} /> : null}
        <Button
          label={move.pending ? GROUPS_COPY.saving : initial.id ? GROUPS_COPY.save : GROUPS_COPY.create}
          disabled={move.pending || picked.size === 0 || !name.trim()}
          onPress={() => void save()}
          testID="save-group"
        />
        {initial.id ? (
          <Button variant="hazard" icon={Trash2Icon} label={GROUPS_COPY.remove} disabled={move.pending} onPress={() => void remove()} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noted: { gap: LABEL_GAP },
  // A line under a group, on the leading edge.
  note: { paddingHorizontal: INSET },
  form: { gap: SECTION_GAP },
  actions: { paddingHorizontal: INSET, gap: SPACE.sm },
});
