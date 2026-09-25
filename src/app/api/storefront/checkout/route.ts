import type { NextRequest } from 'next/server';
import { handleStorefrontCheckout } from '@/lib/storefront/checkout-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleStorefrontCheckout(request);
}
