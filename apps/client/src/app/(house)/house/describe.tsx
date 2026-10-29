import { PAGE_TITLE, passUnlocked, SECTION_LABEL } from '@app/core';
import { useState } from 'react';
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
 * The chat with Jonz. For a new house it's Describe your house, pushed
 * from Today's setup card and the empty John list: Jonz (Claude, or a
 * starter list when Claude isn't there) drafts the Johns. For a house with
 * a list it's Ask Jonz, from the sparkles in the title bar: Jonz changes the
 * list (a House Pass extra). Either way an admin applies what they want. Not a HousePage: the chat scrolls over a message box that stays
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
  // Ask Jonz for a house with a list, Describe your house for a new one: fixed on the first read, so adding Johns doesn't retitle it.
  const [title, setTitle] = useState<string | null>(null);
  if (ready && title === null) setTitle(list.data.johns.length > 0 ? PAGE_TITLE.ask : PAGE_TITLE.describe);
  const page = title ?? PAGE_TITLE.ask;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="describe-screen">
      <TitleBar title={page} back="/house" backLabel={SECTION_LABEL.house} />
      <PageTitle page={page} />
      {ready ? (
        <SetupChat
          houseId={houseId}
          rules={view.snapshot.rules}
          johns={list.data.johns}
          groups={list.data.groups}
          people={view.snapshot.members}
          me={userId}
          passOpen={passUnlocked(view.snapshot.house.pass, view.now)}
        />
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
