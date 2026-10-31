import { ADMIN_COPY, daysUntil, deletionDay, FOCUS_SHELL_COPY, type PendingDeletion } from '@app/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailIcon, UserXIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deleteByEmail, deleteNow, ownerDeletions, stopDeletion } from '@/api/owner';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { ReadFailed, Reading } from '@/components/read-state';
import { Row, RowIcon } from '@/components/row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Sheet } from '@/components/sheet';
import { Meta } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useToast } from '@/components/toast';
import { useNow } from '@/hooks/use-now';
import { SPACE, TABULAR, useTheme } from '@/theme';

const KEY = ['owner-deletions'];

/**
 * Everyone waiting to be deleted, soonest first: who, their email (to match
 * a request), their house, and how long is left. Tapping one opens what can
 * be done: Delete now, when they've asked for it sooner, or Stop, when
 * they've changed their mind by email; each with a reason for the audit log.
 * Under the list, starting the 30 days for someone who emailed and can't
 * sign in. Every move writes the audit log, in the database.
 */
export default function DeletionsPage() {
  return (
    <Screen bar={<TitleBar title="Deletions" />} testID="admin-deletions">
      <Deletions />
    </Screen>
  );
}

function Deletions() {
  const now = useNow();
  const waiting = useQuery({ queryKey: KEY, queryFn: ownerDeletions });
  const [chosen, setChosen] = useState<PendingDeletion | null>(null);
  const [byEmail, setByEmail] = useState(false);
  if (waiting.isPending) return <Reading />;
  if (waiting.isError) return <ReadFailed onRetry={() => void waiting.refetch()} />;

  const people = waiting.data;
  return (
    <>
      {people.length === 0 ? (
        <EmptyState icon={UserXIcon} title={ADMIN_COPY.noDeletions} body={ADMIN_COPY.noDeletionsBody} testID="deletions-empty" />
      ) : (
        <Section label={ADMIN_COPY.waiting} right={ADMIN_COPY.deletionsMeta(people.length)}>
          {people.map((person) => (
            <Row
              key={person.userId}
              leading={<Avatar name={person.name} userId={person.userId} />}
              title={person.name}
              // The email on a line of its own, so a long one is cut at its end rather than broken in two.
              meta={[
                person.email,
                `${person.house ?? ADMIN_COPY.noHouse}, ${person.requestedBy === 'owner' ? ADMIN_COPY.startedByYou : ADMIN_COPY.askedInApp}`,
              ]
                .filter(Boolean)
                .join('\n')}
              metaLines={2}
              trailing={<Left iso={person.deleteAfter} now={now} />}
              onPress={() => setChosen(person)}
              chevron
              testID={`deletion-${person.userId}`}
            />
          ))}
        </Section>
      )}
      <Section label={ADMIN_COPY.byEmail}>
        <Row leading={<RowIcon icon={MailIcon} />} title={ADMIN_COPY.startDeleting} onPress={() => setByEmail(true)} chevron testID="delete-by-email" />
      </Section>
      <Meta>{ADMIN_COPY.auditNote}</Meta>

      <ChosenSheet key={chosen?.userId ?? 'none'} person={chosen} onClose={() => setChosen(null)} />
      <ByEmailSheet visible={byEmail} onClose={() => setByEmail(false)} />
    </>
  );
}

/** How long is left, at the row's end. */
function Left({ iso, now }: { iso: string; now: Date }) {
  const { type, colors } = useTheme();
  return <Text style={[type.meta, TABULAR, { color: colors.mutedForeground }]}>{ADMIN_COPY.goesIn(daysUntil(iso, now))}</Text>;
}

/** What can be done to one person's deletion: Delete now or Stop, and why. */
function ChosenSheet({ person, onClose }: { person: PendingDeletion | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState<'now' | 'stop' | null>(null);
  const done = (message: string) => {
    toast.show(message);
    void queryClient.invalidateQueries({ queryKey: KEY });
    void queryClient.invalidateQueries({ queryKey: ['owner-audit'] });
    onClose();
  };
  const now = useMutation({
    mutationFn: (userId: string) => deleteNow(userId, reason),
    onSuccess: () => done(ADMIN_COPY.deletingSoon),
  });
  const stop = useMutation({
    mutationFn: (userId: string) => stopDeletion(userId, reason),
    onSuccess: () => done(ADMIN_COPY.stopped),
  });
  const busy = now.isPending || stop.isPending;
  const problem = now.error?.message ?? stop.error?.message ?? null;
  if (!person) return null;

  const title =
    asking === 'now' ? ADMIN_COPY.deleteNowAsk(person.name) : asking === 'stop' ? ADMIN_COPY.stopAsk(person.name) : person.name;
  const description =
    asking === 'now'
      ? ADMIN_COPY.deleteNowBody
      : asking === 'stop'
        ? ADMIN_COPY.stopBody
        : `${person.email ?? ''}${person.email ? ', ' : ''}${ADMIN_COPY.goesIn(daysUntil(person.deleteAfter, new Date())).toLowerCase()} (${deletionDay(person.deleteAfter)})`;
  return (
    <Sheet visible title={title} description={description} onClose={onClose} testID="deletion-sheet">
      <Field
        label={ADMIN_COPY.reason}
        value={reason}
        onChangeText={setReason}
        placeholder={ADMIN_COPY.reasonPlaceholder}
        maxLength={500}
        testID="deletion-reason"
      />
      {problem ? <Alert message={problem} /> : null}
      <View style={styles.buttons}>
        {asking === null ? (
          <>
            <Button variant="hazard" label={ADMIN_COPY.deleteNow} onPress={() => setAsking('now')} testID="deletion-now" />
            <Button variant="outline" label={ADMIN_COPY.stop} onPress={() => setAsking('stop')} testID="deletion-stop" />
          </>
        ) : (
          <>
            <Button
              variant={asking === 'now' ? 'hazard' : 'primary'}
              label={asking === 'now' ? ADMIN_COPY.deleteNow : ADMIN_COPY.stop}
              disabled={busy}
              onPress={() => (asking === 'now' ? now : stop).mutate(person.userId)}
              testID="deletion-confirm"
            />
            <Button variant="outline" label={FOCUS_SHELL_COPY.cancel} disabled={busy} onPress={() => setAsking(null)} testID="deletion-cancel" />
          </>
        )}
      </View>
    </Sheet>
  );
}

/** Start the 30 days for someone who emailed and can't sign in. */
function ByEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const start = useMutation({
    mutationFn: () => deleteByEmail(email, reason),
    onSuccess: () => {
      toast.show(ADMIN_COPY.started);
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['owner-audit'] });
      setEmail('');
      setReason('');
      onClose();
    },
  });
  return (
    <Sheet visible={visible} title={ADMIN_COPY.byEmail} description={ADMIN_COPY.byEmailBody} onClose={onClose} testID="by-email-sheet">
      <Field
        label={ADMIN_COPY.email}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        testID="deletion-email"
      />
      <Field
        label={ADMIN_COPY.reason}
        value={reason}
        onChangeText={setReason}
        placeholder={ADMIN_COPY.reasonPlaceholder}
        maxLength={500}
        testID="deletion-email-reason"
      />
      {start.error ? <Alert message={start.error.message} /> : null}
      <Button
        label={ADMIN_COPY.startDeleting}
        disabled={!email.includes('@') || start.isPending}
        onPress={() => start.mutate()}
        testID="deletion-start"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: SPACE.sm },
});
