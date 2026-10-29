import {
  CATEGORIES,
  CHAT_MAX_MESSAGES,
  DOW_LABEL,
  HOUSE_DRAFT_COPY,
  MESSAGE_MAX,
  membersLine,
  pointsLabel,
  scheduleLine,
  STARTER_KINDS,
  starterDraft,
  type ChatAsk,
  type ChatMessage,
  type GroupDef,
  type HouseDraft,
  type HouseRules,
  type IsoDow,
  type StarterKind,
} from '@app/core';
import { router } from 'expo-router';
import { ArrowUpIcon, CheckIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { keepDraft, sendChat } from '@/api/draft';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Group } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import { Segmented } from '@/components/segmented';
import { ChoiceRow } from '@/components/setup/choice-row';
import { Body, Meta } from '@/components/text';
import { TextButton } from '@/components/text-button';
import { useMove } from '@/hooks/use-move';
import { CONTENT_MAX, GUTTER, INSET, RADIUS, SECTION_GAP, SPACE, TAP, useTheme } from '@/theme';

type Person = { userId: string; name: string };

/**
 * One line of the chat: what the admin said, what Jonz said back (with a
 * question to tap an answer to, and the draft when that turn changed it),
 * or the Johns being added.
 */
type Turn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; ask: ChatAsk | null; draft: HouseDraft | null }
  | { role: 'done'; added: number };

/** How many of the draft's Johns show before "See all". */
const FOLDED = 3;

/** "Sam", "Sam and Priya", "Sam, Priya and Tom". */
function namesList(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Roughly how many points a week the kept Johns come to; on-call ones aren't counted, as nobody knows how often they'll come up. */
function pointsAWeek(draft: HouseDraft, keep: readonly number[]): number {
  return Math.round(
    keep.reduce((sum, i) => {
      const j = draft.johns[i];
      return j && j.when !== 'on_call' ? sum + (j.points * j.perWeek) / j.everyWeeks : sum;
    }, 0),
  );
}

/**
 * Describe your house, as a chat: Jonz asks, the admin answers in words or
 * by tapping a quick answer or a day, and the draft list shows in the chat
 * as a card, every John ticked. Each message after that changes the draft
 * ("oven every month"); the card opens into the whole list, and the amber
 * button adds the ticked Johns (making any groups they need). Nothing is
 * written before that. The cards are the app's own rows, buttons and day
 * picker, so the draft looks as the list will.
 */
export function SetupChat({
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
  const { colors, type } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const keeping = useMove(houseId);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<HouseDraft | null>(null);
  const [keep, setKeep] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const done = turns.some((t) => t.role === 'done');
  const busy = sending || keeping.pending;
  // The draft card sits under the turn that last changed the draft; only Jonz's last question can be answered.
  const draftAt = turns.findLastIndex((t) => t.role === 'assistant' && t.draft !== null);
  const last = turns.at(-1);
  const ask = !busy && last?.role === 'assistant' ? last.ask : null;

  function answered(reply: Turn & { role: 'assistant' }, said: Turn[]) {
    setTurns([...said, reply]);
    if (reply.draft) {
      setDraft(reply.draft);
      setKeep(reply.draft.johns.map((_, i) => i));
    }
  }

  async function send(words: string) {
    const said = words.trim();
    if (!said || busy || done) return;
    const before = turns;
    const next: Turn[] = [...turns, { role: 'user', text: said }];
    setTurns(next);
    setText('');
    setProblem(null);
    setSending(true);
    try {
      const messages: ChatMessage[] = next
        .flatMap((t) => (t.role === 'done' || !t.text ? [] : [{ role: t.role, text: t.text }]))
        .slice(-CHAT_MAX_MESSAGES);
      const answer = await sendChat(houseId, messages, draft);
      answered({ role: 'assistant', text: answer.reply, ask: answer.ask, draft: answer.draft }, next);
    } catch (reason) {
      // Refused (too many today, say): what was said goes back in the box to try again.
      setTurns(before);
      setText(said);
      setProblem(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSending(false);
    }
  }

  function pick(kind: StarterKind) {
    const said: Turn[] = [...turns, { role: 'user', text: HOUSE_DRAFT_COPY.starter[kind].title }];
    answered({ role: 'assistant', text: HOUSE_DRAFT_COPY.fromStarter, ask: null, draft: starterDraft(kind) }, said);
  }

  async function add() {
    if (!draft) return;
    let added = 0;
    if (await keeping.run(async () => (added = await keepDraft(houseId, rules, draft, keep, groups, new Date())))) {
      setTurns((was) => [...was, { role: 'done', added }]);
      setDraft(null);
    }
  }

  const toggle = (i: number) => setKeep((was) => (was.includes(i) ? was.filter((k) => k !== i) : [...was, i].sort((a, b) => a - b)));

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        testID="chat"
      >
        <View style={styles.said} testID="chat-greeting">
          <Body>{HOUSE_DRAFT_COPY.greeting}</Body>
          {turns.length === 0 ? (
            <>
              <Meta>{HOUSE_DRAFT_COPY.orStart}</Meta>
              <View style={styles.choices}>
                {STARTER_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    variant="outline"
                    label={HOUSE_DRAFT_COPY.starter[kind].title}
                    spoken={`${HOUSE_DRAFT_COPY.starter[kind].title}: ${HOUSE_DRAFT_COPY.starter[kind].meta}`}
                    onPress={() => pick(kind)}
                    testID={`starter-${kind}`}
                  />
                ))}
              </View>
              <Meta>{HOUSE_DRAFT_COPY.privacy}</Meta>
            </>
          ) : null}
        </View>

        {turns.map((turn, at) => {
          if (turn.role === 'user') {
            return (
              <View key={at} style={[styles.bubble, { backgroundColor: colors.secondary }]} testID="chat-user">
                <Body>{turn.text}</Body>
              </View>
            );
          }
          if (turn.role === 'done') {
            return (
              <Group key={at} testID="chat-done">
                <Row
                  title={HOUSE_DRAFT_COPY.added(turn.added)}
                  meta={HOUSE_DRAFT_COPY.addedMeta}
                  leading={<RowIcon icon={CheckIcon} />}
                  onPress={() => router.dismissTo('/house/johns')}
                  accessibilityLabel={`${HOUSE_DRAFT_COPY.added(turn.added)}. ${HOUSE_DRAFT_COPY.openList}`}
                  chevron
                  testID="chat-open-list"
                />
              </Group>
            );
          }
          return (
            <View key={at} style={styles.said}>
              {turn.text ? <Body testID="chat-reply">{turn.text}</Body> : null}
              {/* The question's answers sit under the question, over the draft it's about. */}
              {turn === last && ask ? <AskCard ask={ask} weekStarts={rules.weekStarts} onAnswer={(a) => void send(a)} /> : null}
              {at === draftAt && draft ? (
                <DraftCard
                  draft={draft}
                  keep={keep}
                  open={open}
                  onOpen={setOpen}
                  onToggle={toggle}
                  onKeep={() => void add()}
                  pending={keeping.pending}
                  problem={keeping.problem}
                  people={people}
                  me={me}
                />
              ) : null}
            </View>
          );
        })}

        {sending ? <Meta testID="chat-thinking">{HOUSE_DRAFT_COPY.thinking}</Meta> : null}
      </ScrollView>

      {done ? null : (
        <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.composerLine}>
            {problem ? <Alert message={problem} /> : null}
            <View style={styles.box}>
              <TextInput
                accessibilityLabel={HOUSE_DRAFT_COPY.message}
                placeholder={draft ? HOUSE_DRAFT_COPY.placeholderChange : HOUSE_DRAFT_COPY.placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => void send(text)}
                submitBehavior="submit"
                maxLength={MESSAGE_MAX}
                multiline
                numberOfLines={1}
                style={[
                  styles.input,
                  { fontFamily: type.body.fontFamily, fontSize: type.body.fontSize },
                  { borderColor: colors.mutedForeground, color: colors.foreground, backgroundColor: colors.card },
                ]}
                testID="chat-input"
              />
              <Button
                variant="outline"
                icon={ArrowUpIcon}
                iconOnly
                label={HOUSE_DRAFT_COPY.send}
                onPress={() => void send(text)}
                disabled={busy || !text.trim()}
                testID="chat-send"
              />
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Jonz's question, answered with a tap: a few quick answers as buttons, or a day as the app's day picker. */
function AskCard({ ask, weekStarts, onAnswer }: { ask: ChatAsk; weekStarts: IsoDow; onAnswer: (answer: string) => void }) {
  if (ask.kind === 'choices') {
    return (
      <View style={styles.choices} testID="ask-choices">
        {ask.options.map((option) => (
          <Button key={option} variant="outline" label={option} onPress={() => onAnswer(option)} testID="ask-choice" />
        ))}
      </View>
    );
  }
  const days = Array.from({ length: 7 }, (_, k) => (((weekStarts - 1 + k) % 7) + 1) as IsoDow);
  return (
    <Segmented<number>
      equal
      label={HOUSE_DRAFT_COPY.pickDay}
      value={0}
      options={days.map((d) => ({ value: d, label: DOW_LABEL[d].slice(0, 3), spoken: DOW_LABEL[d] }))}
      onChange={(d) => onAnswer(DOW_LABEL[d as IsoDow])}
      testID="ask-day"
    />
  );
}

/**
 * The draft, in the chat: its first few Johns as the setup checklist shows
 * them, every one ticked, opening into the whole list with its groups. The
 * amber button adds the ticked ones.
 */
function DraftCard({
  draft,
  keep,
  open,
  onOpen,
  onToggle,
  onKeep,
  pending,
  problem,
  people,
  me,
}: {
  draft: HouseDraft;
  keep: number[];
  open: boolean;
  onOpen: (open: boolean) => void;
  onToggle: (i: number) => void;
  onKeep: () => void;
  pending: boolean;
  problem: string | null;
  people: Person[];
  me: string;
}) {
  const all = draft.johns.map((j, i) => ({ j, i }));
  // Opened, the Johns go in the list's own order: kitchen first, then the bathrooms, and so on.
  const shown = open ? CATEGORIES.flatMap((c) => all.filter(({ j }) => j.category === c)) : all.slice(0, FOLDED);
  const waiting = draft.groups.filter((g) => g.memberIds.length === 0);
  return (
    <View style={styles.card} testID="draft-card">
      <Section label={HOUSE_DRAFT_COPY.draftLabel} right={HOUSE_DRAFT_COPY.draftMeta(keep.length, pointsAWeek(draft, keep))}>
        {shown.map(({ j, i }) => (
          <ChoiceRow
            key={`${i}-${j.name}`}
            role="checkbox"
            label={j.name}
            meta={[scheduleLine({ ...j, dueDow: j.dueDow as IsoDow }, j.group), pointsLabel(j.points), j.why || null].filter(Boolean).join(' · ')}
            checked={keep.includes(i)}
            onPress={() => onToggle(i)}
            disabled={pending}
            metaLines={2}
            testID="draft-john"
          />
        ))}
      </Section>
      {draft.johns.length > FOLDED ? (
        <TextButton
          label={open ? HOUSE_DRAFT_COPY.showLess : HOUSE_DRAFT_COPY.seeAll(draft.johns.length)}
          onPress={() => onOpen(!open)}
          testID="draft-see-all"
        />
      ) : null}
      {open && draft.groups.length > 0 ? (
        <Section label={HOUSE_DRAFT_COPY.groupsLabel} testID="draft-groups">
          {draft.groups.map((g) => (
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
      {open && waiting.length > 0 ? (
        <Meta style={styles.inset}>{HOUSE_DRAFT_COPY.everyoneForNow(namesList(waiting.map((g) => g.name)))}</Meta>
      ) : null}
      {draft.note ? (
        <Meta style={styles.inset} testID="draft-note">
          {draft.note}
        </Meta>
      ) : null}
      {problem ? <Alert message={problem} /> : null}
      <Button
        label={pending ? HOUSE_DRAFT_COPY.keeping : HOUSE_DRAFT_COPY.keep(keep.length)}
        onPress={onKeep}
        disabled={pending || keep.length === 0}
        testID="describe-keep"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  chat: {
    width: '100%',
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    paddingBottom: SECTION_GAP,
    gap: SPACE.xl,
  },
  said: { gap: SPACE.md },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  // What the admin said: on the tint, to the right, as a chosen button sits.
  bubble: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: RADIUS, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  card: { gap: SPACE.md },
  inset: { paddingHorizontal: INSET },
  composer: { borderTopWidth: StyleSheet.hairlineWidth },
  composerLine: {
    width: '100%',
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingVertical: SPACE.sm,
    gap: SPACE.sm,
  },
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  input: {
    flex: 1,
    minHeight: TAP,
    maxHeight: 132,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: SPACE.md,
    paddingTop: 13,
    paddingBottom: 13,
  },
});
