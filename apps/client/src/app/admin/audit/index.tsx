import { ADMIN_COPY, auditByDay, type AuditEntry } from '@app/core';
import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollTextIcon } from 'lucide-react-native';
import { useState } from 'react';

import { auditPage } from '@/api/owner';
import { AuditDetail, AuditRow } from '@/components/admin/audit-entry';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Group } from '@/components/group';
import { ReadFailed, Reading } from '@/components/read-state';
import { Columns, Screen, useColumns } from '@/components/screen';
import { Section } from '@/components/section';
import { TitleBar } from '@/components/title-bar';
import { useMembership } from '@/hooks/use-membership';

/**
 * The audit log: everything done on the admin pages, newest first, by day.
 * It's a timeline, so older entries load as you scroll, 50 at a time, each
 * read starting from the last entry shown; Load older does the same for a
 * keyboard, or when the page is too short to scroll. On a laptop the entry
 * chosen sits in the side panel; on a phone it opens as its own page.
 */
export default function AuditPage() {
  const log = useInfiniteQuery({
    queryKey: ['owner-audit'],
    queryFn: ({ pageParam }) => auditPage(pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.more ? (last.entries[last.entries.length - 1]?.id ?? null) : null),
  });
  const older = () => {
    if (log.hasNextPage && !log.isFetchingNextPage) void log.fetchNextPage();
  };
  return (
    <Screen spreads bar={<TitleBar title="Audit log" />} onNearEnd={older} testID="admin-audit">
      <AuditLog log={log} older={older} />
    </Screen>
  );
}

type Log = UseInfiniteQueryResult<InfiniteData<Awaited<ReturnType<typeof auditPage>>>>;

function AuditLog({ log, older }: { log: Log; older: () => void }) {
  const two = useColumns();
  const ownerId = useMembership().session?.user.id ?? null;
  const [chosen, setChosen] = useState<number | null>(null);
  if (log.isPending) return <Reading />;
  if (log.isError) return <ReadFailed onRetry={() => void log.refetch()} />;

  const entries: AuditEntry[] = log.data.pages.flatMap((page) => page.entries);
  if (entries.length === 0) {
    return <EmptyState icon={ScrollTextIcon} title={ADMIN_COPY.noAudit} body={ADMIN_COPY.noAuditBody} testID="audit-empty" />;
  }
  const shown = entries.find((entry) => entry.id === chosen) ?? entries[0];
  const open = (entry: AuditEntry) => (two ? setChosen(entry.id) : router.push(`/admin/audit/${entry.id}` as never));

  const list = (
    <>
      {auditByDay(entries).map(({ day, entries: those }) => (
        <Section key={day} label={day} right={ADMIN_COPY.auditMeta(those.length)}>
          <Group>
            {those.map((entry) => (
              <AuditRow key={entry.id} entry={entry} ownerId={ownerId} chosen={two && entry.id === shown.id} onPress={() => open(entry)} />
            ))}
          </Group>
        </Section>
      ))}
      {log.isFetchingNextPage ? (
        <Reading label={ADMIN_COPY.loadingOlder} />
      ) : log.hasNextPage ? (
        <Button label={ADMIN_COPY.loadOlder} variant="outline" onPress={older} testID="audit-older" />
      ) : null}
    </>
  );
  return two ? <Columns main={list} side={<AuditDetail entry={shown} ownerId={ownerId} />} /> : list;
}
