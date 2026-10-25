import { MEMBERS_COPY } from '@app/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Housemate } from '@/api/board';
import { removeMember, setRole } from '@/api/settings';
import { Alert } from '@/components/alert';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { useMove } from '@/hooks/use-move';
import { FONT, SPACE, useTheme } from '@/theme';

/** Who lives here, as the web's list. Admins can promote, demote and ask someone to leave. */
export function MembersList({
  houseId,
  members,
  me,
  isAdmin,
}: {
  houseId: string;
  members: Housemate[];
  me: string;
  isAdmin: boolean;
}) {
  const { colors } = useTheme();
  const move = useMove(houseId);
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <View>
      {members.map((m, i) => (
        <View
          key={m.userId}
          testID="member"
          style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
        >
          <View style={styles.who}>
            <Avatar name={m.name} me={m.userId === me} />
            <View style={styles.grow}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
                {m.name}
                {m.userId === me ? <Text style={{ color: colors.mutedForeground }}>{` ${MEMBERS_COPY.you}`}</Text> : null}
              </Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>
                {m.role === 'admin' ? MEMBERS_COPY.admin : MEMBERS_COPY.housemate}
              </Text>
            </View>
          </View>
          {isAdmin && m.userId !== me ? (
            <View style={styles.actions}>
              {removing === m.userId ? (
                <>
                  <Button
                    variant="hazard"
                    label={MEMBERS_COPY.removeName(m.name)}
                    disabled={move.pending}
                    onPress={() => void move.run(() => removeMember(houseId, m.userId))}
                  />
                  <Button variant="ghost" label={MEMBERS_COPY.cancel} onPress={() => setRemoving(null)} />
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    label={m.role === 'admin' ? MEMBERS_COPY.makeHousemate : MEMBERS_COPY.makeAdmin}
                    disabled={move.pending}
                    onPress={() => void move.run(() => setRole(houseId, m.userId, m.role === 'admin' ? 'member' : 'admin'))}
                  />
                  <Button variant="ghost" label={MEMBERS_COPY.remove} onPress={() => setRemoving(m.userId)} />
                </>
              )}
            </View>
          ) : null}
        </View>
      ))}
      {move.problem ? <Alert message={move.problem} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  who: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: 15 },
  small: { fontFamily: FONT.regular, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
});
