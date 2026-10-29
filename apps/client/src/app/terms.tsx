import { PAGE_TITLE, TERMS } from '@app/core';

import { LegalPage } from '@/components/legal/legal-page';

/** jonz.app/terms: the Terms of Service, the House Pass's included. Google, Microsoft, Apple, Stripe and the stores link here. */
export default function Terms() {
  return <LegalPage page={TERMS} tab={PAGE_TITLE.terms} testID="terms-screen" />;
}
