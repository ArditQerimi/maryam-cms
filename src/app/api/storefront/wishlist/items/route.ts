import type { NextRequest } from 'next/server';
import {
  handleWishlistPost,
  handleWishlistRemove,
} from '@/lib/storefront/wishlist-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleWishlistPost(request);
}

export async function DELETE(request: NextRequest) {
  return handleWishlistRemove(request);
}
