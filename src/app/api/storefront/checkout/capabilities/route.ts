import type { NextRequest } from 'next/server';
import { handleStorefrontCheckoutCapabilities } from '@/lib/storefront/checkout-capabilities-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStorefrontCheckoutCapabilities(request);
}
