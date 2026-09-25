import type { NextRequest } from 'next/server';
import {
  handleCartGet,
  handleCartPost,
  handleCartUpdate,
  handleCartClear,
} from '@/lib/storefront/cart-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCartGet(request);
}

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
  return handleCartClear(request);
}
