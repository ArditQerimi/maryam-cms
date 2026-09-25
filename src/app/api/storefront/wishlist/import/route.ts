import type { NextRequest } from 'next/server';
import { handleWishlistImport } from '@/lib/storefront/wishlist-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleWishlistImport(request);
}
