import { PAGE_TITLE, PRIVACY_POLICY } from '@app/core';

import { LegalPage } from '@/components/legal/legal-page';

/** jonz.app/privacy: what Jonz keeps, who sees it and how to delete it. Google, Microsoft, Apple, Stripe and the stores link here. */
export default function Privacy() {
  return <LegalPage page={PRIVACY_POLICY} tab={PAGE_TITLE.privacy} testID="privacy-screen" />;
}
