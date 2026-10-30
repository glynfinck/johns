import { ADMIN_COPY } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { auditEntry } from '@/api/owner';
import { AuditDetail } from '@/components/admin/audit-entry';
import { ReadFailed, Reading } from '@/components/read-state';
import { Screen } from '@/components/screen';
import { Meta } from '@/components/text';
import { TitleBar } from '@/components/title-bar';
import { useMembership } from '@/hooks/use-membership';

/** One audit entry as its own page: a phone's way in from the log. */
export default function AuditEntryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ownerId = useMembership().session?.user.id ?? null;
  const entry = useQuery({ queryKey: ['owner-audit', 'entry', id], queryFn: () => auditEntry(Number(id)) });
  return (
    <Screen bar={<TitleBar title={ADMIN_COPY.entry} back="/admin/audit" backLabel="Audit log" />} testID="admin-audit-entry">
      {entry.isPending ? (
        <Reading />
      ) : entry.isError ? (
        <ReadFailed onRetry={() => void entry.refetch()} />
      ) : entry.data ? (
        <AuditDetail entry={entry.data} ownerId={ownerId} />
      ) : (
        <Meta>{ADMIN_COPY.noEntry}</Meta>
      )}
    </Screen>
  );
}
