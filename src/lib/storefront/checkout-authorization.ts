import { isValidCartId } from './validation';

export type CheckoutOwner =
  | { kind: 'customer'; userId: number }
  | { kind: 'guest'; cartId: string };

export class CheckoutOwnershipError extends Error {
  readonly code: 'cart-required' | 'invalid-owner';

  constructor(code: 'cart-required' | 'invalid-owner') {
    super(code === 'cart-required'
      ? 'A server cart is required before checkout.'
      : 'The checkout owner is invalid.');
    this.name = 'CheckoutOwnershipError';
    this.code = code;
  }
}

/** Authenticated checkout always uses the exact Customer cart, never a guest UUID. */
export function resolveCheckoutOwner(
  customerUserId: number | null,
  guestCartId: string | null,
): CheckoutOwner {
  if (customerUserId !== null) {
    if (!Number.isSafeInteger(customerUserId) || customerUserId < 1) {
      throw new CheckoutOwnershipError('invalid-owner');
    }
    return { kind: 'customer', userId: customerUserId };
  }
  if (!guestCartId || !isValidCartId(guestCartId)) {
    throw new CheckoutOwnershipError('cart-required');
  }
  return { kind: 'guest', cartId: guestCartId };
}

export function customerOwnsSale(
  sale: { customerUserId: number | null; isOnline: boolean },
  customerUserId: number,
) {
  return sale.isOnline
    && Number.isSafeInteger(customerUserId)
    && customerUserId > 0
    && sale.customerUserId === customerUserId;
}
