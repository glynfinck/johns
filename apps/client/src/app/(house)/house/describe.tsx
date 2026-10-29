import { PAGE_TITLE, SECTION_LABEL } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { SetupChat } from '@/components/house/setup-chat';
import { PageTitle } from '@/components/page-title';
import { Reading, ReadFailed } from '@/components/read-state';
import { TitleBar } from '@/components/title-bar';
import { useHouse } from '@/hooks/use-house';
import { useJohnList } from '@/hooks/use-john-list';
import { useMembership } from '@/hooks/use-membership';
import { GUTTER, useTheme } from '@/theme';

/**
 * Describe your house, pushed from Today's setup card and from an empty
 * John list: a chat with Jonz (Claude, or a starter list when Claude isn't
 * there) that drafts the Johns, and an admin keeps what they want of the
 * draft. Not a HousePage: the chat scrolls over a message box that stays
 * put above the keyboard.
 */
export default function DescribeScreen() {
  const { session, house } = useMembership();
  // The layout's guard only shows the house's screens with a house and a session.
  return <DescribeFor houseId={house!.id} userId={session!.user.id} />;
}

function DescribeFor({ houseId, userId }: { houseId: string; userId: string }) {
  const { colors } = useTheme();
  const { query, view } = useHouse(houseId, userId);
  const list = useJohnList(houseId);
  const retry = () => void Promise.all([query.refetch(), list.refetch()]);
  const ready = view !== null && list.data !== undefined;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="describe-screen">
      <TitleBar title={PAGE_TITLE.describe} back="/house" backLabel={SECTION_LABEL.house} />
      <PageTitle page={PAGE_TITLE.describe} />
      {ready ? (
        <SetupChat houseId={houseId} rules={view.snapshot.rules} groups={list.data.groups} people={view.snapshot.members} me={userId} />
      ) : (
        <View style={styles.reading}>{query.isError || list.isError ? <ReadFailed onRetry={retry} /> : <Reading />}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  reading: { padding: GUTTER },
});
