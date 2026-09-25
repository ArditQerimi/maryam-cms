import type { NextRequest, NextResponse } from 'next/server';
import { isValidCartId } from './validation';

export const CART_COOKIE_NAME = 'storefront_cart';
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function getCartCookie(request: NextRequest) {
  const value = request.cookies.get(CART_COOKIE_NAME)?.value;
  return isValidCartId(value) ? value : null;
}

export function setCartCookie(response: NextResponse, cartId: string, secure: boolean) {
  // Deliberately omit Domain: this is a host-only cookie. HttpOnly keeps the
  // bearer UUID out of client JavaScript, while SameSite=Lax limits CSRF use.
  response.cookies.set({
    name: CART_COOKIE_NAME,
    value: cartId,
    httpOnly: true,
    secure: secure || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export function clearCartCookie(response: NextResponse, secure: boolean) {
  response.cookies.set({
    name: CART_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: secure || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
