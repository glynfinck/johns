import { firstName, GROUPS_COPY, type GroupDef } from '@app/core';
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Housemate } from '@/api/board';
import { deleteGroup, saveGroup } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Sheet } from '@/components/sheet';
import { Body, Eyebrow } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

type Draft = { id?: string; name: string; memberIds: string[] };

/**
 * Groups, as the web's: the parts of the house only some of you share. A
 * John can belong to one, and then only that group is handed it.
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
  const { colors } = useTheme();
  const [editing, setEditing] = useState<Draft | null>(null);
  const realName = (id: string) => people.find((p) => p.userId === id)?.name ?? '?';
  const nameOf = (id: string) => (id === me ? 'You' : firstName(realName(id)));

  return (
    <View style={styles.stack} testID="groups">
      {groups.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.secondary }]}>
          <Body>{GROUPS_COPY.empty}</Body>
        </View>
      ) : (
        <View style={styles.list}>
          {groups.map((g) => (
            <View key={g.id} testID="group" style={[styles.row, { borderColor: colors.border }]}>
              <UsersIcon size={16} color={colors.mutedForeground} aria-hidden />
              <View style={styles.grow}>
                <Text style={[styles.name, { color: colors.foreground }]}>{g.name}</Text>
                {g.memberIds.length === 0 ? (
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>{GROUPS_COPY.nobody}</Text>
                ) : (
                  <View style={styles.members}>
                    {g.memberIds.map((id) => (
                      <View key={id} style={styles.member}>
                        <Avatar name={realName(id)} me={id === me} size={20} />
                        <Text style={[styles.small, { color: colors.mutedForeground }]}>{nameOf(id)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              {editable ? (
                <Button
                  variant="ghost"
                  icon={PencilIcon}
                  label={GROUPS_COPY.edit(g.name)}
                  iconOnly
                  onPress={() => setEditing({ id: g.id, name: g.name, memberIds: g.memberIds })}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
      {editable ? (
        <View style={styles.start}>
          <Button
            variant="outline"
            icon={PlusIcon}
            label={GROUPS_COPY.add}
            onPress={() => setEditing({ name: '', memberIds: [] })}
            testID="add-group"
          />
        </View>
      ) : null}
      <Sheet
        visible={editing !== null}
        title={editing?.id ? GROUPS_COPY.edit(editing.name) : GROUPS_COPY.add}
        description={GROUPS_COPY.hint}
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
    </View>
  );
}

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
  const { colors } = useTheme();
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
      <Field
        label={GROUPS_COPY.name}
        placeholder={GROUPS_COPY.namePlaceholder}
        value={name}
        onChangeText={setName}
        maxLength={40}
        testID="group-name"
      />
      <View style={styles.list}>
        <Eyebrow>{GROUPS_COPY.who}</Eyebrow>
        {people.map((p) => {
          const on = picked.has(p.userId);
          return (
            <Pressable
              key={p.userId}
              accessibilityRole="checkbox"
              accessibilityLabel={p.userId === me ? 'You' : p.name}
              aria-checked={on}
              onPress={() => toggle(p.userId)}
              style={[styles.pick, { borderColor: on ? colors.foreground : colors.border }]}
            >
              <View
                aria-hidden
                style={[
                  styles.box,
                  on ? { backgroundColor: colors.foreground, borderColor: colors.foreground } : { borderColor: colors.input },
                ]}
              >
                {on ? <CheckIcon size={14} color={colors.background} strokeWidth={3} /> : null}
              </View>
              <Avatar name={p.name} me={p.userId === me} size={24} />
              <Text style={[styles.name, { color: colors.foreground }]}>{p.userId === me ? 'You' : p.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {move.problem ? <Alert message={move.problem} /> : null}
      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button
            label={move.pending ? GROUPS_COPY.saving : initial.id ? GROUPS_COPY.save : GROUPS_COPY.create}
            disabled={move.pending || picked.size === 0 || !name.trim()}
            onPress={() => void save()}
            testID="save-group"
          />
        </View>
        {initial.id ? (
          <Button variant="hazard" icon={Trash2Icon} label={GROUPS_COPY.remove} disabled={move.pending} onPress={() => void remove()} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  list: { gap: SPACE.sm },
  empty: { borderRadius: RADIUS, padding: SPACE.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingVertical: SPACE.sm,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    minHeight: 56,
  },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: 15 },
  small: { fontFamily: FONT.regular, fontSize: 12 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  member: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  start: { alignItems: 'flex-start' },
  form: { gap: SPACE.lg },
  pick: { minHeight: TAP, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: SPACE.md },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
