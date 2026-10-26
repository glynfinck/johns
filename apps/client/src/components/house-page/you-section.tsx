import { HOUSE_COPY } from '@app/core';
import { useState } from 'react';

import { GroupItem } from '@/components/group';
import { MeCard } from '@/components/house/me-card';
import { Section } from '@/components/section';
import type { HouseView } from '@/hooks/use-house';

/**
 * You: your name, reminders, the look and signing out. For now the old
 * MeCard in a group (leaving too, until LeaveSection takes it); the lower
 * House track rebuilds it as rows (HOUSE_LOWER_COPY). House's page mounts it
 * with these props.
 */
export function YouSection({ houseId, userId, view }: { houseId: string; userId: string; view: HouseView }) {
  // Kept here, not in MeCard, so "Saved" outlasts the card being drawn
  // again with the new name.
  const [nameSaved, setNameSaved] = useState(false);
  if (!view.me) return null;
  return (
    <Section label={HOUSE_COPY.you}>
      <GroupItem>
        <MeCard key={view.me.name} houseId={houseId} userId={userId} name={view.me.name} saved={nameSaved} onSaved={setNameSaved} />
      </GroupItem>
    </Section>
  );
}
