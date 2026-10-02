import type { NextRequest } from 'next/server';
import { handleCompareRemove } from '@/lib/storefront/compare-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CompareItemRouteContext = {
  params: Promise<{ productId: string }>;
};

export async function DELETE(request: NextRequest, context: CompareItemRouteContext) {
  const { productId } = await context.params;
  return handleCompareRemove(request, productId);
}
