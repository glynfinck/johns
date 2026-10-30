import { ADMIN_PAGES } from '@app/core';
import { Redirect } from 'expo-router';

/** /admin opens on its first page. */
export default function AdminIndex() {
  return <Redirect href={ADMIN_PAGES[0].path as never} />;
}
