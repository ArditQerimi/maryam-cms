import type { NextRequest } from 'next/server';
import { handleCartRemove, handleCartUpdate } from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CartItemRouteContext = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, context: CartItemRouteContext) {
  const { itemId } = await context.params;
  return handleCartUpdate(request, itemId);
}

export async function DELETE(request: NextRequest, context: CartItemRouteContext) {
  const { itemId } = await context.params;
  return handleCartRemove(request, itemId);
}
