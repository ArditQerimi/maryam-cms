import type { NextRequest } from 'next/server';
import { handleCartMerge } from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCartMerge(request);
}
