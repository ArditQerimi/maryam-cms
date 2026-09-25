import type { NextRequest } from 'next/server';
import { handleCartClear } from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCartClear(request);
}

export async function DELETE(request: NextRequest) {
  return handleCartClear(request);
}
