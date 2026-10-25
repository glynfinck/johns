import {
  CATEGORIES,
  CATEGORY_LABEL,
  DOW_LABEL,
  JOHN_LIST_COPY,
  lidColour,
  NEW_JOHN,
  pointsLabel,
  weeklyEffort,
  type Category,
  type GroupDef,
  type HouseRules,
  type IsoDow,
  type JohnDef,
} from '@app/core';
import { CameraIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { archiveJohn, saveJohn } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Field } from '@/components/field';
import { LidSwatch } from '@/components/lid';
import { Sheet } from '@/components/sheet';
import { Body } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { useMove } from '@/hooks/use-move';
import { FONT, RADIUS, SPACE, useTheme } from '@/theme';

type Draft = Omit<JohnDef, 'id'> & { id?: string };

const KINDS = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));
const EFFORT = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const EVERY = [1, 2, 3, 4].map((n) => ({ value: n, label: JOHN_LIST_COPY.every[n] }));
const DAYS = (Object.entries(DOW_LABEL) as [string, string][]).map(([day, name]) => ({
  value: Number(day) as IsoDow,
  label: name.slice(0, 3),
  spoken: name,
}));

/** The house's list of Johns, as the web's. Admins add and edit; changes land in the next deal. */
export function JohnList({
  houseId,
  rules,
  johns,
  groups,
  editable,
}: {
  houseId: string;
  rules: HouseRules;
  johns: JohnDef[];
  groups: GroupDef[];
  editable: boolean;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<Draft | null>(null);
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;

  return (
    <View style={styles.stack}>
      {johns.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.secondary }]}>
          <Body>{JOHN_LIST_COPY.empty}</Body>
        </View>
      ) : (
        <View style={styles.list} testID="john-list">
          {johns.map((j) => (
            <View
              key={j.id}
              testID="john-def"
              style={[styles.row, { borderColor: colors.border, borderLeftColor: lidColour(colors, j.category) }]}
            >
              <View style={styles.grow}>
                <View style={styles.nameLine}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{j.name}</Text>
                  {j.needsPhoto ? (
                    <View role="img" aria-label={JOHN_LIST_COPY.needsPhoto}>
                      <CameraIcon size={14} color={colors.mutedForeground} aria-hidden />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {JOHN_LIST_COPY.when(j.everyWeeks, DOW_LABEL[j.dueDow], j.dueTime)}
                  {groupName(j.groupId) ? (
                    <Text style={[styles.bold, { color: colors.foreground }]}>{` · ${groupName(j.groupId)}`}</Text>
                  ) : null}
                </Text>
              </View>
              <Text style={[styles.points, { color: colors.foreground }]}>{pointsLabel(j.points)}</Text>
              {editable ? (
                <Button variant="ghost" icon={PencilIcon} label={JOHN_LIST_COPY.edit(j.name)} iconOnly onPress={() => setEditing(j)} />
              ) : null}
            </View>
          ))}
        </View>
      )}
      <Body muted style={styles.small}>
        {JOHN_LIST_COPY.perWeek(weeklyEffort(johns))}
      </Body>
      {editable ? (
        <View style={styles.start}>
          <Button
            variant="outline"
            icon={PlusIcon}
            label={JOHN_LIST_COPY.add}
            onPress={() => setEditing({ ...NEW_JOHN })}
            testID="add-john"
          />
        </View>
      ) : null}
      <Sheet
        visible={editing !== null}
        title={editing?.id ? JOHN_LIST_COPY.edit(editing.name) : JOHN_LIST_COPY.add}
        description={JOHN_LIST_COPY.hint}
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
    </View>
  );
}

/** One John's details: what it is, who shares it, how much effort, and when it's due. */
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

  async function save() {
    if (await move.run(() => saveJohn(houseId, rules, v, new Date()))) onDone();
  }

  async function remove() {
    if (v.id && (await move.run(() => archiveJohn(houseId, v.id!, new Date())))) onDone();
  }

  return (
    <View style={styles.form} testID="john-form">
      <Field
        label={JOHN_LIST_COPY.name}
        placeholder={JOHN_LIST_COPY.namePlaceholder}
        value={v.name}
        onChangeText={(name) => set({ name })}
        maxLength={60}
        testID="john-name"
      />
      <View style={styles.stackSm}>
        <Choice label={JOHN_LIST_COPY.kind} options={KINDS} value={v.category} onChange={(category: Category) => set({ category })} />
        <LidSwatch category={v.category} />
      </View>
      <View style={styles.stackSm}>
        <Choice
          label={JOHN_LIST_COPY.sharedBy}
          options={sharers}
          value={v.groupId ?? ''}
          onChange={(id) => set({ groupId: id || null })}
        />
        <Body muted style={styles.small}>
          {groups.length === 0 ? JOHN_LIST_COPY.noGroups : JOHN_LIST_COPY.groupOnly}
        </Body>
      </View>
      <Choice label={JOHN_LIST_COPY.effort} options={EFFORT} value={v.points} onChange={(points) => set({ points })} />
      <Choice label={JOHN_LIST_COPY.often} options={EVERY} value={v.everyWeeks} onChange={(everyWeeks) => set({ everyWeeks })} />
      <Choice label={JOHN_LIST_COPY.due} options={DAYS} value={v.dueDow} onChange={(dueDow) => set({ dueDow })} />
      <Field
        label={JOHN_LIST_COPY.by}
        value={v.dueTime}
        onChangeText={(dueTime) => set({ dueTime })}
        placeholder="21:00"
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        testID="john-time"
      />
      <Toggle
        label={JOHN_LIST_COPY.photo}
        hint={JOHN_LIST_COPY.photoHint}
        value={v.needsPhoto}
        onChange={(needsPhoto) => set({ needsPhoto })}
      />
      {move.problem ? <Alert message={move.problem} /> : null}
      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button
            label={move.pending ? JOHN_LIST_COPY.saving : v.id ? JOHN_LIST_COPY.save : JOHN_LIST_COPY.create}
            disabled={move.pending || !v.name.trim()}
            onPress={() => void save()}
            testID="save-john"
          />
        </View>
        {v.id ? (
          <Button variant="hazard" icon={Trash2Icon} label={JOHN_LIST_COPY.remove} disabled={move.pending} onPress={() => void remove()} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  stackSm: { gap: SPACE.sm },
  list: { gap: SPACE.sm },
  empty: { borderRadius: RADIUS, padding: SPACE.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderWidth: 1,
    borderLeftWidth: 6,
    borderRadius: RADIUS,
    paddingVertical: SPACE.sm,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    minHeight: 56,
  },
  grow: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  name: { flexShrink: 1, fontFamily: FONT.bold, fontSize: 15 },
  small: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 17 },
  bold: { fontFamily: FONT.bold },
  points: { fontFamily: FONT.black, fontSize: 14 },
  start: { alignItems: 'flex-start' },
  form: { gap: SPACE.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
