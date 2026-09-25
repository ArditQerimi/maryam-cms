import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review your storefront cart and prepare contact, delivery, and payment details.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShopCheckoutPage() {
  // No submit adapter is passed intentionally. CheckoutClient keeps the place
  // order action disabled until POST /api/storefront/checkout exists.
  return <CheckoutClient />;
}
