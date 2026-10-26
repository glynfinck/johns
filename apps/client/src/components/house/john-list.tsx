import {
  CATEGORIES,
  CATEGORY_LABEL,
  DOW_LABEL,
  JOHN_LIST_COPY,
  johnFacts,
  johnsByKind,
  NEW_JOHN,
  pointsLabel,
  scheduleLine,
  SETUP_COPY,
  weeklyEffort,
  type Category,
  type GroupDef,
  type HouseRules,
  type IsoDow,
  type JohnDef,
} from '@app/core';
import { ListTodoIcon, PlusIcon, Trash2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { archiveJohn, saveJohn } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { Group, GroupItem } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { ChoiceRow } from '@/components/setup/choice-row';
import { PickRow } from '@/components/setup/pick-row';
import { Sheet } from '@/components/sheet';
import { Meta } from '@/components/text';
import { useMove } from '@/hooks/use-move';
import { INSET, LABEL_GAP, SECTION_GAP, SPACE } from '@/theme';

type Draft = Omit<JohnDef, 'id'> & { id?: string };

const KINDS = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));
const EFFORT = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: pointsLabel(i + 1) }));
const EVERY = [1, 2, 3, 4].map((n) => ({ value: n, label: JOHN_LIST_COPY.every[n] }));
const DAYS = (Object.entries(DOW_LABEL) as [string, string][]).map(([day, name]) => ({ value: Number(day) as IsoDow, label: name }));

/**
 * The house's list of Johns, a section per kind ("Kitchen · 3"), each John a
 * row: its lid dot, how often and when, and its points. Admins add and edit
 * in a sheet; everyone else reads a John's details there. Changes land in the
 * next deal. Several page children, so it goes straight in a Screen.
 */
export function JohnList({
  houseId,
  rules,
  johns,
  groups,
  editable,
  whoAdds,
}: {
  houseId: string;
  rules: HouseRules;
  johns: JohnDef[];
  groups: GroupDef[];
  editable: boolean;
  /** An empty list, to someone who can't add to it: who will ("Sam will add the Johns."). */
  whoAdds?: string;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [reading, setReading] = useState<JohnDef | null>(null);
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;
  const add = () => setEditing({ ...NEW_JOHN });

  return (
    <>
      {johns.length === 0 ? (
        <EmptyState
          icon={ListTodoIcon}
          title={SETUP_COPY.noJohns}
          body={editable ? SETUP_COPY.noJohnsBody : whoAdds}
          action={editable ? <Button icon={PlusIcon} label={JOHN_LIST_COPY.add} onPress={add} testID="add-john" /> : undefined}
        />
      ) : (
        johnsByKind(johns).map((kind) => (
          <Section key={kind.category} label={kind.label} testID={`kind-${kind.category}`}>
            {kind.johns.map((j) => {
              const line = scheduleLine(j, groupName(j.groupId));
              return (
                <Row
                  key={j.id}
                  title={j.name}
                  lid={j.category}
                  meta={line}
                  trailing={pointsLabel(j.points)}
                  onPress={() => (editable ? setEditing(j) : setReading(j))}
                  accessibilityLabel={editable ? `${JOHN_LIST_COPY.edit(j.name)}, ${line}, ${pointsLabel(j.points)}` : undefined}
                  testID="john-def"
                />
              );
            })}
          </Section>
        ))
      )}
      {johns.length > 0 ? (
        <View style={styles.foot}>
          {editable ? (
            <Group>
              <Row leading={<RowIcon icon={PlusIcon} />} title={JOHN_LIST_COPY.add} onPress={add} testID="add-john" />
            </Group>
          ) : null}
          <Meta style={styles.note}>{JOHN_LIST_COPY.perWeek(weeklyEffort(johns))}</Meta>
        </View>
      ) : null}
      <Sheet
        visible={editing !== null}
        title={editing?.id ? JOHN_LIST_COPY.edit(editing.name) : JOHN_LIST_COPY.add}
        description={JOHN_LIST_COPY.hint}
        flush
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <JohnForm
            key={editing.id ?? 'new'}
            houseId={houseId}
            rules={rules}
            initial={editing}
            groups={groups}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
      <Sheet visible={reading !== null} title={reading?.name} flush onClose={() => setReading(null)} testID="john-facts">
        {reading ? (
          <Group>
            {johnFacts(reading, groupName(reading.groupId)).map((fact) => (
              <Row key={fact.label} title={fact.label} trailing={fact.value} testID="john-fact" />
            ))}
          </Group>
        ) : null}
      </Sheet>
    </>
  );
}

/**
 * One John's details, in groups of rows: its name; what it is and who shares
 * it, with a line on what sharing means; then how much effort, how often,
 * when it's due and whether the tick needs a photo. Save is the sheet's one
 * amber button.
 */
function JohnForm({
  houseId,
  rules,
  initial,
  groups,
  onDone,
}: {
  houseId: string;
  rules: HouseRules;
  initial: Draft;
  groups: GroupDef[];
  onDone: () => void;
}) {
  const move = useMove(houseId);
  const [v, setV] = useState(initial);
  const set = (patch: Partial<Draft>) => setV((old) => ({ ...old, ...patch }));
  const sharers = [{ value: '', label: JOHN_LIST_COPY.everyone }, ...groups.map((g) => ({ value: g.id, label: g.name }))];
  // What "Shared by" means, under it: how to share with fewer when there's no
  // group yet, and what a group's John does once one is picked.
  const sharing = groups.length === 0 ? JOHN_LIST_COPY.noGroups : v.groupId ? JOHN_LIST_COPY.groupOnly : null;

  async function save() {
    if (await move.run(() => saveJohn(houseId, rules, v, new Date()))) onDone();
  }

  async function remove() {
    if (v.id && (await move.run(() => archiveJohn(houseId, v.id!, new Date())))) onDone();
  }

  return (
    <View style={styles.form} testID="john-form">
      <Group>
        <GroupItem>
          <Field
            label={JOHN_LIST_COPY.name}
            placeholder={JOHN_LIST_COPY.namePlaceholder}
            value={v.name}
            onChangeText={(name) => set({ name })}
            maxLength={60}
            testID="john-name"
          />
        </GroupItem>
      </Group>
      <View style={styles.noted}>
        <Group>
          <PickRow label={JOHN_LIST_COPY.kind} options={KINDS} value={v.category} onChange={(category: Category) => set({ category })} />
          <PickRow label={JOHN_LIST_COPY.sharedBy} options={sharers} value={v.groupId ?? ''} onChange={(id) => set({ groupId: id || null })} />
        </Group>
        {sharing ? (
          <Meta style={styles.note} testID="sharing-note">
            {sharing}
          </Meta>
        ) : null}
      </View>
      <Group>
        <PickRow label={JOHN_LIST_COPY.effort} options={EFFORT} value={v.points} onChange={(points) => set({ points })} />
        <PickRow label={JOHN_LIST_COPY.often} options={EVERY} value={v.everyWeeks} onChange={(everyWeeks) => set({ everyWeeks })} />
        <PickRow label={JOHN_LIST_COPY.due} options={DAYS} value={v.dueDow} onChange={(dueDow) => set({ dueDow })} />
        <GroupItem>
          <Field
            label={JOHN_LIST_COPY.by}
            value={v.dueTime}
            onChangeText={(dueTime) => set({ dueTime })}
            placeholder="21:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            testID="john-time"
          />
        </GroupItem>
        <ChoiceRow
          role="checkbox"
          label={JOHN_LIST_COPY.photo}
          meta={SETUP_COPY.photoMeta}
          checked={v.needsPhoto}
          onPress={() => set({ needsPhoto: !v.needsPhoto })}
          testID="john-photo"
        />
      </Group>
      <View style={styles.actions}>
        {move.problem ? <Alert message={move.problem} /> : null}
        <Button
          label={move.pending ? JOHN_LIST_COPY.saving : v.id ? JOHN_LIST_COPY.save : JOHN_LIST_COPY.create}
          disabled={move.pending || !v.name.trim()}
          onPress={() => void save()}
          testID="save-john"
        />
        {v.id ? (
          <Button variant="hazard" icon={Trash2Icon} label={JOHN_LIST_COPY.remove} disabled={move.pending} onPress={() => void remove()} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { gap: LABEL_GAP },
  // A line under a group, on the leading edge.
  note: { paddingHorizontal: INSET },
  noted: { gap: LABEL_GAP },
  form: { gap: SECTION_GAP },
  actions: { paddingHorizontal: INSET, gap: SPACE.sm },
});
