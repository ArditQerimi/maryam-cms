import type { NextRequest } from 'next/server';
import { handleWishlistClear } from '@/lib/storefront/wishlist-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleWishlistClear(request);
}

export async function DELETE(request: NextRequest) {
  return handleWishlistClear(request);
}
