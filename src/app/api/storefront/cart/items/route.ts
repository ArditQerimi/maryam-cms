import type { NextRequest } from 'next/server';
import {
  handleCartPost,
  handleCartUpdate,
  handleCartRemove,
} from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCartPost(request);
}

export async function PATCH(request: NextRequest) {
  return handleCartUpdate(request);
}

export async function PUT(request: NextRequest) {
  return handleCartUpdate(request);
}

export async function DELETE(request: NextRequest) {
  return handleCartRemove(request);
}
