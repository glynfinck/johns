import { WALL_COPY } from '@app/core';
import { MegaphoneIcon } from 'lucide-react-native';

import { Group } from '@/components/group';
import { Row, RowIcon } from '@/components/row';
import type { HouseView } from '@/hooks/use-house';

/**
 * House's third section: the Wall's latest, and the way to all of it. For
 * now one row to the whole Wall; the lower House track builds the latest
 * four events here (WALL_FEED_COPY, HOUSE_LOWER_COPY). House's page mounts
 * it with these props.
 */
export function WallSection(_props: { houseId: string; userId: string; view: HouseView }) {
  return (
    <Group>
      <Row leading={<RowIcon icon={MegaphoneIcon} />} title={WALL_COPY.title} href="/house/wall" chevron testID="to-wall" />
    </Group>
  );
}
