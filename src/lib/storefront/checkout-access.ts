import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const ORDER_CONFIRMATION_PATH = '/shop/order-confirmation';
export const ORDER_ACCESS_COOKIE_NAME = 'storefront_order_access';
export const ORDER_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const ORDER_ACCESS_TTL_MS = ORDER_ACCESS_MAX_AGE_SECONDS * 1_000;

const ACCESS_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^v1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;

function assertAccessSecret(secret: string) {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Order access secret is invalid.');
  }
}

export function createOrderAccessMaterial(
  secret: string,
  tenantSubdomain: string,
  accessId: string = randomUUID(),
) {
  assertAccessSecret(secret);
  if (!tenantSubdomain || !ACCESS_ID_PATTERN.test(accessId)) {
    throw new Error('Order access material is invalid.');
  }

  const signature = createHmac('sha256', secret)
    .update(`storefront-order-access:v1:${tenantSubdomain}:${accessId}`)
    .digest('base64url');
  const token = `v1.${accessId}.${signature}`;
  return {
    accessId,
    token,
    tokenHash: hashOrderAccessToken(token),
  };
}

export function hashOrderAccessToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function orderAccessMaterialMatchesHash(
  secret: string,
  tenantSubdomain: string,
  accessId: string,
  expectedTokenHash: string,
) {
  const material = createOrderAccessMaterial(secret, tenantSubdomain, accessId);
  const expected = Buffer.from(expectedTokenHash, 'hex');
  const derived = Buffer.from(material.tokenHash, 'hex');
  return expected.length === derived.length
    && timingSafeEqual(expected, derived)
    ? material
    : null;
}

export function isValidOrderAccessToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

export function getOrderAccessCookie(request: NextRequest) {
  const value = request.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
  return isValidOrderAccessToken(value) ? value : null;
}

export function setOrderAccessCookie(
  response: NextResponse,
  token: string,
  secure: boolean,
) {
  if (!isValidOrderAccessToken(token)) throw new Error('Order access token is invalid.');

  // Host-only (no Domain), HttpOnly, and separate from storefront_cart. Restrict
  // the bearer capability to the confirmation route that actually consumes it.
  response.cookies.set({
    name: ORDER_ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: secure || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: ORDER_CONFIRMATION_PATH,
    maxAge: ORDER_ACCESS_MAX_AGE_SECONDS,
  });
}
