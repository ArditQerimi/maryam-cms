import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { hasCustomerSessionAudience } from '@/lib/auth-validation';
import CheckoutPanel from './CheckoutPanel';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review your storefront cart and prepare contact, delivery, and payment details.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ShopCheckoutPage() {
  // Visitors (guests) may browse and fill a cart, but orders are for
  // registered customers only — guests are sent to sign in and brought
  // straight back here after authenticating.
  const session = await getSession();
  if (!session || !hasCustomerSessionAudience(session)) {
    redirect('/home/login?returnTo=/home/checkout');
  }

  // CheckoutPanel (client) wires the submit adapter that runs the checkout
  // contract: capabilities → cart sync → quote re-check → POST /api/storefront/checkout.
  return <CheckoutPanel />;
}
