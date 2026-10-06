'use client';

import { useRouter } from 'next/navigation';
import CheckoutClient from './CheckoutClient';
import { submitCheckout } from './submit-checkout';

/**
 * Client boundary composing CheckoutClient with the concrete HTTP submit
 * adapter. The page (server component) renders this so no function crosses
 * the RSC boundary.
 */
export default function CheckoutPanel() {
  const router = useRouter();
  return (
    <CheckoutClient
      submitCheckout={submitCheckout}
      onCheckoutSuccess={(confirmation) => {
        // Root-relative paths only; the confirmation page offers (and auto-opens) WhatsApp.
        const path = confirmation.confirmationPath;
        if (path.startsWith('/') && !path.startsWith('//')) router.push(path);
      }}
    />
  );
}
