import type { NextRequest } from 'next/server';
import { handleCartImport } from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCartImport(request);
}
