'use client';

import React from 'react';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { CompareProvider } from '@/context/CompareContext';

export default function ShopProviders({
  children,
  customerSession = true,
}: {
  children: React.ReactNode;
  /**
   * False when nobody (or a staff account) is signed in as a customer: the
   * account wishlist/compare endpoints would only answer 401, so the lists
   * stay local without asking the server on every page.
   */
  customerSession?: boolean;
}) {
  return (
    <CartProvider>
      <WishlistProvider customerSession={customerSession}>
        <CompareProvider customerSession={customerSession}>
          {children}
        </CompareProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
