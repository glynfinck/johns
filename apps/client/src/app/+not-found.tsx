import { NOT_FOUND_COPY, PAGE_TITLE } from '@app/core';

import { Button } from '@/components/button';
import { Door, Sign, SignHeading } from '@/components/front-door/door';
import { PageTitle } from '@/components/page-title';
import { useMembership } from '@/hooks/use-membership';

/**
 * A link to nowhere, as the web's not-found page, on the front door's
 * pavement: say so, and the way back. Signed in, that's your Johns; signed
 * out, there are none yet, so it's the front door.
 */
export default function NotFound() {
  const { session } = useMembership();
  return (
    <Door testID="not-found-screen">
      <PageTitle page={PAGE_TITLE.notFound} />
      <Sign>
        <SignHeading title={NOT_FOUND_COPY.title} body={NOT_FOUND_COPY.body} />
        <Button href="/" label={session ? NOT_FOUND_COPY.back : NOT_FOUND_COPY.backToDoor} />
      </Sign>
    </Door>
  );
}
