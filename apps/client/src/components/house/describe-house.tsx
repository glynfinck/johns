import {
  CATEGORIES,
  CATEGORY_LABEL,
  DESCRIPTION_MAX,
  HOUSE_DRAFT_COPY,
  membersLine,
  pointsLabel,
  scheduleLine,
  SETUP_COPY,
  STARTER_KINDS,
  starterDraft,
  type DraftResponse,
  type GroupDef,
  type HouseRules,
  type IsoDow,
  type StarterKind,
} from '@app/core';
import { router } from 'expo-router';
import { SparklesIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { keepDraft, requestDraft } from '@/api/draft';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { ChoiceRow } from '@/components/setup/choice-row';
import { Lead, Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMove } from '@/hooks/use-move';
import { INSET, SECTION_GAP, SPACE } from '@/theme';

type Person = { userId: string; name: string };

/** "Sam", "Sam and Priya", "Sam, Priya and Tom". */
function namesList(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Where the draft came from, for the line over it: Claude, a starter list picked, or one standing in for Claude. */
type Shown = DraftResponse & { picked: boolean };

/**
 * Describe your house: an admin writes a sentence or two and gets back a
 * draft John list, or picks a starter list. The draft is only shown: every
 * John starts ticked, the admin unticks any they don't want, and the amber
 * button adds the rest to the list (making any groups they need), then
 * opens the list. Nothing is written before that, and starting again
 * throws the draft away.
 */
export function DescribeHouse({
  houseId,
  rules,
  groups,
  people,
  me,
}: {
  houseId: string;
  rules: HouseRules;
  /** The house's groups already, so a drafted group with the same name is used as it is. */
  groups: GroupDef[];
  people: Person[];
  me: string;
}) {
  const move = useMove(houseId);
  const [description, setDescription] = useState('');
  const [shown, setShown] = useState<Shown | null>(null);
  const [keep, setKeep] = useState<number[]>([]);

  function show(next: Shown) {
    setShown(next);
    setKeep(next.draft.johns.map((_, i) => i));
  }

  async function draft() {
    let answer: DraftResponse | null = null;
    if (await move.run(async () => (answer = await requestDraft(houseId, description)))) show({ ...answer!, picked: false });
  }

  function pick(kind: StarterKind) {
    show({ draft: starterDraft(kind), source: 'starter', picked: true });
  }

  async function add() {
    if (!shown) return;
    if (await move.run(() => keepDraft(houseId, rules, shown.draft, keep, groups, new Date()))) router.dismissTo('/house/johns');
  }

  if (!shown) {
    return (
      <>
        <View style={styles.write} testID="describe-write">
          <Lead>{HOUSE_DRAFT_COPY.lead}</Lead>
          <Field
            label={HOUSE_DRAFT_COPY.field}
            placeholder={HOUSE_DRAFT_COPY.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={DESCRIPTION_MAX}
            hint={HOUSE_DRAFT_COPY.privacy}
            testID="describe-field"
          />
          {move.problem ? <Alert message={move.problem} /> : null}
          <Button
            icon={SparklesIcon}
            label={move.pending ? HOUSE_DRAFT_COPY.drafting : HOUSE_DRAFT_COPY.draft}
            onPress={() => void draft()}
            disabled={move.pending || description.trim().length < 10}
            testID="describe-draft"
          />
        </View>
        <Section label={HOUSE_DRAFT_COPY.orStart} testID="describe-starters">
          {STARTER_KINDS.map((kind) => (
            <Row
              key={kind}
              title={HOUSE_DRAFT_COPY.starter[kind].title}
              meta={HOUSE_DRAFT_COPY.starter[kind].meta}
              onPress={() => pick(kind)}
              disabled={move.pending}
              chevron
              testID={`starter-${kind}`}
            />
          ))}
        </Section>
      </>
    );
  }

  const { draft: d, source, picked } = shown;
  const lead =
    source === 'ai' ? HOUSE_DRAFT_COPY.drafted(d.johns.length) : picked ? HOUSE_DRAFT_COPY.fromStarter : HOUSE_DRAFT_COPY.offline;
  const toggle = (i: number) => setKeep((was) => (was.includes(i) ? was.filter((k) => k !== i) : [...was, i].sort((a, b) => a - b)));

  return (
    <>
      <View style={styles.lead} testID="describe-review">
        <Lead>{lead}</Lead>
        {d.note ? <Meta testID="describe-note">{d.note}</Meta> : null}
      </View>
      {CATEGORIES.map((category) => {
        const here = d.johns.map((j, i) => ({ j, i })).filter(({ j }) => j.category === category);
        if (here.length === 0) return null;
        return (
          <Section key={category} label={SETUP_COPY.kind(CATEGORY_LABEL[category], here.length)} testID={`draft-${category}`}>
            {here.map(({ j, i }) => (
              <ChoiceRow
                key={j.name}
                role="checkbox"
                label={j.name}
                meta={[scheduleLine({ ...j, dueDow: j.dueDow as IsoDow }, j.group), pointsLabel(j.points), j.why || null].filter(Boolean).join(' · ')}
                checked={keep.includes(i)}
                onPress={() => toggle(i)}
                metaLines={2}
                testID="draft-john"
              />
            ))}
          </Section>
        );
      })}
      {d.groups.length > 0 ? (
        <Section label={HOUSE_DRAFT_COPY.groupsLabel} testID="draft-groups">
          {d.groups.map((g) => (
            <Row
              key={g.name}
              title={g.name}
              meta={[
                g.memberIds.length > 0 ? membersLine(g.memberIds, people, me) : null,
                g.waitingFor.length > 0 ? HOUSE_DRAFT_COPY.waiting(namesList(g.waitingFor)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              testID="draft-group"
            />
          ))}
        </Section>
      ) : null}
      {d.groups.some((g) => g.memberIds.length === 0) ? (
        <Meta style={styles.groupNote}>
          {HOUSE_DRAFT_COPY.everyoneForNow(namesList(d.groups.filter((g) => g.memberIds.length === 0).map((g) => g.name)))}
        </Meta>
      ) : null}
      <View style={styles.foot}>
        {move.problem ? <Alert message={move.problem} /> : null}
        <Button
          label={move.pending ? HOUSE_DRAFT_COPY.keeping : HOUSE_DRAFT_COPY.keep(keep.length)}
          onPress={() => void add()}
          disabled={move.pending || keep.length === 0}
          testID="describe-keep"
        />
        <TextButton label={HOUSE_DRAFT_COPY.startAgain} onPress={() => setShown(null)} disabled={move.pending} testID="describe-again" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  write: { gap: SPACE.lg },
  lead: { gap: SPACE.sm },
  groupNote: { marginTop: SPACE.sm, paddingHorizontal: INSET },
  foot: { gap: SPACE.md, marginTop: SECTION_GAP },
});
