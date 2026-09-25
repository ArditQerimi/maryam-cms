'use client';

import React from 'react';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { CompareProvider } from '@/context/CompareContext';

export default function ShopProviders({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <WishlistProvider>
        <CompareProvider>
          {children}
        </CompareProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
