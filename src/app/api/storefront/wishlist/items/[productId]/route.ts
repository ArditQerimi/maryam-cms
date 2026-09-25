import type { NextRequest } from 'next/server';
import { handleWishlistRemove } from '@/lib/storefront/wishlist-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WishlistItemRouteContext = {
  params: Promise<{ productId: string }>;
};

export async function DELETE(request: NextRequest, context: WishlistItemRouteContext) {
  const { productId } = await context.params;
  return handleWishlistRemove(request, productId);
}
