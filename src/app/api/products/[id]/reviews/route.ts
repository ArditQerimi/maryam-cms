import { NextResponse, type NextRequest } from 'next/server';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import * as schema from '@/db/schema-tenant';
import { getStorefrontContext, assertMutationOrigin } from '@/lib/storefront/context';
import { runStorefrontRoute } from '@/lib/storefront/http';
import { StorefrontError } from '@/lib/storefront/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 3;
const BODY_MIN = 10;
const BODY_MAX = 5000;

type Notice = 'created' | 'rate-limited' | 'invalid';

function reviewPath(productId: number, notice?: Notice) {
  const params = new URLSearchParams({ tab: 'reviews' });
  if (notice) params.set('reviewStatus', notice);
  return `/home/products/${productId}?${params.toString()}#reviews`;
}

function redirectTo(request: NextRequest, productId: number, notice?: Notice) {
  return NextResponse.redirect(new URL(reviewPath(productId, notice), request.url), 303);
}

function parseProductId(request: NextRequest) {
  // Path shape: /api/products/[id]/reviews
  const segment = request.nextUrl.pathname.split('/')[3] ?? '';
  if (!/^\d+$/.test(segment)) return null;
  const productId = Number(segment);
  return Number.isSafeInteger(productId) && productId > 0 ? productId : null;
}

/**
 * Review submissions arrive as plain HTML form posts (urlencoded) from the
 * product page. Signed-in customers only: one row per (product, customer),
 * re-submitting replaces their own review. Success and failure both bounce
 * back to the reviews tab with a `reviewStatus` notice the server renderer
 * turns into the submission status card.
 */
export async function POST(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const productId = parseProductId(request);
    if (!productId) {
      throw new StorefrontError(404, 'product-not-found', 'This product does not exist.');
    }

    let context;
    try {
      context = await getStorefrontContext(request, { allowGuest: false });
      assertMutationOrigin(request, context);
    } catch (error) {
      // A plain form post from an expired session should land on the sign-in
      // page for this product, not on a JSON error body.
      if (error instanceof StorefrontError && error.status === 401) {
        return NextResponse.redirect(
          new URL(
            `/home/login?returnTo=${encodeURIComponent(`/home/products/${productId}`)}`,
            request.url,
          ),
          303,
        );
      }
      throw error;
    }

    const form = await request.formData().catch(() => null);
    const ratingValue = typeof form?.get('rating') === 'string' ? form.get('rating') : '';
    const body = typeof form?.get('body') === 'string' ? (form.get('body') as string).trim() : '';
    const rating = Number(ratingValue);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return redirectTo(request, productId, 'invalid');
    }
    if (body.length < BODY_MIN || body.length > BODY_MAX) {
      return redirectTo(request, productId, 'invalid');
    }

    const customer = context.customer;
    if (!customer) {
      throw new StorefrontError(401, 'authentication-required', 'Sign in as a Customer to continue.');
    }

    // Light abuse throttling: a handful of *products* reviewed per customer
    // per hour. Each (product, customer) pair is a single row, so editing one
    // review again is not counted; flooding many different products is.
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
    const [recent] = await context.db
      .select({ total: count() })
      .from(schema.productReviews)
      .where(
        and(
          eq(schema.productReviews.userId, customer.id),
          gte(schema.productReviews.createdAt, windowStart),
        ),
      );
    if ((recent?.total ?? 0) >= RATE_LIMIT_PER_WINDOW) {
      return redirectTo(request, productId, 'rate-limited');
    }

    // Verified purchase = this customer has an online sale containing any
    // variant of this product (same visibility rule as order history).
    const [verifiedRow] = await context.db
      .select({ present: sql<number>`1` })
      .from(schema.saleItems)
      .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.saleItems.variantId))
      .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
      .where(
        and(
          eq(schema.sales.customerUserId, customer.id),
          eq(schema.sales.isOnline, true),
          eq(schema.productVariants.productId, productId),
        ),
      )
      .limit(1);

    const authorName = (customer.name || customer.email).trim().slice(0, 120);
    const values = {
      authorName,
      rating,
      body,
      status: 'approved' as const,
      verifiedPurchase: Boolean(verifiedRow),
      createdAt: new Date(),
    };

    await context.db
      .insert(schema.productReviews)
      .values({
        productId,
        userId: customer.id,
        ...values,
      })
      .onConflictDoUpdate({
        target: [schema.productReviews.productId, schema.productReviews.userId],
        set: values,
      });

    return redirectTo(request, productId, 'created');
  });
}
