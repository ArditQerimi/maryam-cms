import { NextResponse, type NextRequest } from 'next/server';
import { StorefrontInputError, isStorefrontError } from './errors';
import { assertBodySize } from './validation';

export function noStoreJson<T>(body: T, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Vary', 'Origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const bodyText = await request.text();
  assertBodySize(request.headers.get('content-length'), bodyText);
  if (!bodyText.trim()) return {};

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new StorefrontInputError('Request body must be valid JSON.', 'body');
  }
}

export function storefrontErrorResponse(error: unknown) {
  if (isStorefrontError(error)) {
    const body: {
      error: string;
      code: string;
      field?: string;
    } = {
      error: error.message,
      code: error.code,
    };
    if (error instanceof StorefrontInputError && error.field) {
      body.field = error.field;
    }
    return noStoreJson(body, error.status);
  }

  console.error('[Storefront API] Unexpected error', error);
  return noStoreJson(
    {
      error: 'The storefront service is temporarily unavailable.',
      code: 'storefront-unavailable',
    },
    500,
  );
}

export async function runStorefrontRoute(work: () => Promise<NextResponse>) {
  try {
    return await work();
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
