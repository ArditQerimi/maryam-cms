import type { NextRequest } from 'next/server';
import { handleCompareImport } from '@/lib/storefront/compare-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCompareImport(request);
}
