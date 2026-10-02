import type { NextRequest } from 'next/server';
import {
  handleCompareGet,
  handleComparePost,
  handleCompareClear,
} from '@/lib/storefront/compare-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCompareGet(request);
}

export async function POST(request: NextRequest) {
  return handleComparePost(request);
}

export async function DELETE(request: NextRequest) {
  return handleCompareClear(request);
}
