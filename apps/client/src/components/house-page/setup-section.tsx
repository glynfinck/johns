import { FOCUS_SHELL_COPY, PAGE_TITLE } from '@app/core';
import { ListTodoIcon, PlaneIcon, ScrollTextIcon, UsersIcon } from 'lucide-react-native';

import { Row, RowIcon } from '@/components/row';
import { Section } from '@/components/section';
import type { HouseView } from '@/hooks/use-house';

/**
 * House setup: a row to each of the house's setup pages. For now just their
 * names; the lower House track adds each one's value (HOUSE_LOWER_COPY).
 * House's page mounts it with these props.
 */
export function SetupSection(_props: { houseId: string; userId: string; view: HouseView }) {
  return (
    <Section label={FOCUS_SHELL_COPY.setup}>
      <Row leading={<RowIcon icon={ListTodoIcon} />} title={PAGE_TITLE.johnList} href="/house/johns" chevron />
      <Row leading={<RowIcon icon={ScrollTextIcon} />} title={PAGE_TITLE.rules} href="/house/rules" chevron />
      <Row leading={<RowIcon icon={PlaneIcon} />} title={PAGE_TITLE.away} href="/house/away" chevron />
      <Row leading={<RowIcon icon={UsersIcon} />} title={PAGE_TITLE.groups} href="/house/groups" chevron />
    </Section>
  );
}
