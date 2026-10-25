import { REACTABLE, REACTION_LABEL, REACTIONS, relative, WALL_COPY, type ReactionKind, type WallEvent, type WallIcon, type WallLine } from '@app/core';
import {
  BadgeCheckIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  CheckIcon,
  EyeIcon,
  FlagIcon,
  FlameIcon,
  GavelIcon,
  PlaneIcon,
  RepeatIcon,
  ShieldIcon,
  SparklesIcon,
  ThumbsUpIcon,
  UserPlusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { HazardTape } from '@/components/hazard-tape';
import { Body } from '@/components/text';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '@/theme';

// Core says what happened and which icon fits; these draw it.
const ICON: Record<WallIcon, LucideIcon> = {
  check: CheckIcon,
  x: XIcon,
  flag: FlagIcon,
  gavel: GavelIcon,
  shield: ShieldIcon,
  repeat: RepeatIcon,
  plane: PlaneIcon,
  'user-plus': UserPlusIcon,
  'calendar-check': CalendarCheckIcon,
  banknote: BanknoteIcon,
  'badge-check': BadgeCheckIcon,
};

// Icons, not emoji: the house style has none.
const REACTION_ICON: Record<ReactionKind, LucideIcon> = {
  nice: ThumbsUpIcon,
  fire: FlameIcon,
  sparkle: SparklesIcon,
  eyes: EyeIcon,
};

/**
 * One thing the house did, as the web's Wall shows it: who, in words, when,
 * the photo receipt if there is one, and the reactions.
 */
export function WallEventCard({
  event,
  line,
  person,
  photoUrl,
  now,
  onReact,
}: {
  event: WallEvent;
  line: WallLine;
  /** Whose event it is, for the plate; null for the house's own (a month closing). */
  person: { name: string; me: boolean } | null;
  photoUrl: string | null;
  now: Date;
  onReact: (kind: ReactionKind, on: boolean) => void;
}) {
  const { colors } = useTheme();
  const Icon = ICON[line.icon];
  const tint = line.tone === 'good' ? colors.good : line.tone === 'hazard' ? colors.hazard : colors.foreground;
  const john = String(event.data.name ?? 'the John');

  return (
    <View testID="wall-event" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {line.tone === 'hazard' ? <HazardTape width={6} height="100%" /> : null}
      <View style={styles.body}>
        {person ? (
          <Avatar name={person.name} me={person.me} />
        ) : (
          <View aria-hidden style={[styles.plate, { backgroundColor: colors.secondary }]}>
            <Icon size={16} color={colors.foreground} />
          </View>
        )}
        <View style={styles.text}>
          <View style={styles.line}>
            <Icon size={16} color={tint} aria-hidden />
            <Text style={[styles.sentence, { color: colors.foreground }]}>
              {line.parts.map((part, i) => (
                <Text key={i} style={part.bold ? styles.bold : undefined}>
                  {part.text}
                </Text>
              ))}
            </Text>
          </View>
          <Body muted style={styles.when}>
            {relative(event.createdAt, now)}
          </Body>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              accessibilityLabel={WALL_COPY.photoOf(john)}
              resizeMode="cover"
              style={[styles.photo, { borderColor: colors.border }]}
              testID="wall-photo"
            />
          ) : null}
          {REACTABLE.has(event.kind) ? <ReactionBar reactions={event.reactions} onReact={onReact} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Four reactions, each a toggle: yours in hi-vis, with how many in the house chose it. */
export function ReactionBar({
  reactions,
  onReact,
}: {
  reactions: WallEvent['reactions'];
  onReact: (kind: ReactionKind, on: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.reactions}>
      {REACTIONS.map((kind) => {
        const r = reactions[kind];
        const ReactionIcon = REACTION_ICON[kind];
        const ink = r.mine ? colors.onHivis : colors.mutedForeground;
        return (
          <Pressable
            key={kind}
            // A toggle, as a button that says whether it's yours ("selected").
            accessibilityRole="button"
            accessibilityLabel={REACTION_LABEL[kind]}
            accessibilityState={{ selected: r.mine }}
            onPress={() => onReact(kind, !r.mine)}
            style={[
              styles.reaction,
              r.mine
                ? { backgroundColor: colors.hivis, borderColor: colors.foreground }
                : { backgroundColor: 'transparent', borderColor: colors.border },
            ]}
          >
            <ReactionIcon size={16} color={ink} aria-hidden />
            {r.count > 0 ? <Text style={[styles.count, { color: ink }]}>{r.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS * 1.4, overflow: 'hidden' },
  body: { flex: 1, flexDirection: 'row', gap: SPACE.md, padding: SPACE.lg },
  plate: { width: 32, height: 32, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  sentence: { flex: 1, fontFamily: FONT.regular, fontSize: 15, lineHeight: 20 },
  bold: { fontFamily: FONT.bold },
  when: { marginTop: 2, fontSize: 12 },
  photo: { marginTop: SPACE.md, width: '100%', aspectRatio: 4 / 3, maxHeight: 384, borderRadius: RADIUS, borderWidth: 1 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  reaction: {
    minHeight: TAP - 4,
    minWidth: TAP - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS,
  },
  count: { fontFamily: FONT.extrabold, fontSize: 12 },
});
