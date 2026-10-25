import { pageTitle } from '@app/core';
import Head from 'expo-router/head';

/** The browser tab's title for this screen: "Today · Johns", as the web's are. */
export function PageTitle({ page }: { page?: string }) {
  return (
    <Head>
      <title>{pageTitle(page)}</title>
    </Head>
  );
}
