import type { NextRequest } from 'next/server';
import {
  handleWishlistGet,
  handleWishlistPost,
  handleWishlistClear,
} from '@/lib/storefront/wishlist-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleWishlistGet(request);
}

export async function POST(request: NextRequest) {
  return handleWishlistPost(request);
}

export async function DELETE(request: NextRequest) {
  return handleWishlistClear(request);
}
