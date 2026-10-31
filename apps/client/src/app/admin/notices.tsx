import { ADMIN_COPY, noticeState, noticeToShow, noticeWindow, type Notice, type NoticeKind } from '@app/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MegaphoneIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { endNotice, ownerNotices, saveNotice, type SavedNotice } from '@/api/owner';
import { NoticeEditor } from '@/components/admin/notice-editor';
import { StartTiles } from '@/components/admin/start-tiles';
import { EmptyState } from '@/components/empty-state';
import { Fold } from '@/components/fold';
import { Group } from '@/components/group';
import { NoticePreview } from '@/components/notice-banner';
import { ReadFailed, Reading } from '@/components/read-state';
import { Row } from '@/components/row';
import { Columns, Screen, useColumns } from '@/components/screen';
import { Section } from '@/components/section';
import { Sheet } from '@/components/sheet';
import { Chip } from '@/components/status-mark';
import { Lead, Meta } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useToast } from '@/components/toast';
import { SPACE } from '@/theme';

const KIND_LABEL: Record<NoticeKind, string> = { status: 'Status', offer: 'Offer', news: 'News' };

/** What's being edited: a notice, a new one of a kind, or nothing. */
type Chosen = Notice | { start: NoticeKind } | null;
const isNew = (chosen: Chosen): chosen is { start: NoticeKind } => chosen !== null && 'start' in chosen;

/**
 * The owner's notices: what people see now, exactly as they see it, then
 * every notice by whether it's showing, starting later or over. The editor
 * sits in the side panel on a laptop and rises as a sheet on a phone.
 */
export default function NoticesPage() {
  const [chosen, setChosen] = useState<Chosen>(null);
  return (
    <Screen
      spreads
      bar={<TitleBar title="Notices" />}
      testID="admin-notices"
    >
      <Notices chosen={chosen} choose={setChosen} />
    </Screen>
  );
}

function Notices({ chosen, choose }: { chosen: Chosen; choose: (next: Chosen) => void }) {
  const two = useColumns();
  const toast = useToast();
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ['owner-notices'], queryFn: ownerNotices });
  const done = (message: string, copied: boolean) => {
    toast.show(copied ? message : ADMIN_COPY.copyFailed);
    void queryClient.invalidateQueries({ queryKey: ['owner-notices'] });
    void queryClient.invalidateQueries({ queryKey: ['notices'] });
    choose(null);
  };
  const save = useMutation({
    mutationFn: (notice: SavedNotice) => saveNotice(notice),
    onSuccess: ({ copied }) => done(ADMIN_COPY.saved, copied),
    onError: (error) => toast.show(error.message),
  });
  const end = useMutation({
    mutationFn: (id: string) => endNotice(id),
    onSuccess: ({ copied }) => done(ADMIN_COPY.ended, copied),
    onError: (error) => toast.show(error.message),
  });

  if (notices.isPending) return <Reading />;
  if (notices.isError) return <ReadFailed onRetry={() => void notices.refetch()} />;

  const editing = chosen === null || isNew(chosen) ? null : chosen;
  const kind = isNew(chosen) ? chosen.start : 'status';
  const editor = (
    <NoticeEditor
      // A fresh form for each notice chosen.
      key={editing?.id ?? `new-${kind}`}
      notice={editing}
      kind={kind}
      saving={save.isPending || end.isPending}
      onSave={(notice) => save.mutate(notice)}
      onEnd={editing && noticeState(editing, new Date()) !== 'ended' ? () => end.mutate(editing.id) : undefined}
    />
  );
  const list = <NoticeList notices={notices.data} chosen={two ? chosen : null} choose={choose} />;

  if (two) {
    return (
      <Columns
        main={list}
        side={
          <View style={styles.side} testID="notice-side">
            <Lead header>{editing ? ADMIN_COPY.editNotice : ADMIN_COPY.start[kind].title}</Lead>
            {editor}
          </View>
        }
      />
    );
  }
  return (
    <>
      {list}
      <Sheet
        visible={chosen !== null}
        title={editing ? ADMIN_COPY.editNotice : ADMIN_COPY.start[kind].title}
        onClose={() => choose(null)}
        testID="notice-sheet"
      >
        {editor}
      </Sheet>
    </>
  );
}

function NoticeList({ notices, chosen, choose }: { notices: Notice[]; chosen: Chosen; choose: (next: Chosen) => void }) {
  const now = new Date();
  const showing = noticeToShow(notices, {}, now);
  const live = notices.filter((notice) => noticeState(notice, now) === 'live');
  const later = notices.filter((notice) => noticeState(notice, now) === 'scheduled');
  const ended = notices.filter((notice) => noticeState(notice, now) === 'ended');
  const row = (notice: Notice) => (
    <Row
      key={notice.id}
      title={notice.title}
      meta={noticeWindow(notice, now)}
      trailing={<Chip label={KIND_LABEL[notice.kind]} tone={notice.kind === 'status' ? 'hazard' : 'quiet'} />}
      tint={chosen !== null && !isNew(chosen) && chosen.id === notice.id}
      chevron
      onPress={() => choose(notice)}
      testID={`notice-row-${notice.id}`}
    />
  );
  return (
    <>
      <Section label={ADMIN_COPY.whatPeopleSee} testID="what-people-see">
        {showing ? <NoticePreview notice={showing} /> : <Meta>{ADMIN_COPY.nothingShowing}</Meta>}
        <Meta>{ADMIN_COPY.onePerScreen}</Meta>
      </Section>
      {/* A new notice starts from what's happening, under what people see, not from a button up in the title bar. */}
      <Section label={ADMIN_COPY.tellEveryone}>
        <StartTiles chosen={isNew(chosen) ? chosen.start : null} onStart={(start) => choose({ start })} />
      </Section>
      {notices.length === 0 ? (
        <EmptyState icon={MegaphoneIcon} title={ADMIN_COPY.noNotices} body={ADMIN_COPY.noNoticesBody} />
      ) : null}
      {live.length > 0 ? (
        <Section label={ADMIN_COPY.showing} testID="notices-showing">
          <Group>{live.map(row)}</Group>
        </Section>
      ) : null}
      {later.length > 0 ? (
        <Section label={ADMIN_COPY.startingLater} testID="notices-later">
          <Group>{later.map(row)}</Group>
        </Section>
      ) : null}
      {ended.length > 0 ? (
        <Group>
          <Fold label={ADMIN_COPY.endedCount(ended.length)} testID="notices-ended">
            {ended.map(row)}
          </Fold>
        </Group>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  side: { gap: SPACE.lg },
});
