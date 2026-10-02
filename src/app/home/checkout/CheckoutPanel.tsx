'use client';

import CheckoutClient from './CheckoutClient';
import { submitCheckout } from './submit-checkout';

/**
 * Client boundary composing CheckoutClient with the concrete HTTP submit
 * adapter. The page (server component) renders this so no function crosses
 * the RSC boundary.
 */
export default function CheckoutPanel() {
  return <CheckoutClient submitCheckout={submitCheckout} />;
}
