import { StorefrontInputError } from './errors';
import {
  MAX_CART_ITEMS,
  MAX_CART_LINE_QUANTITY,
  MAX_CART_TOTAL_QUANTITY,
  MAX_WISHLIST_ITEMS,
  parsePositiveInteger,
  type CartLineInput,
} from './validation';

export type MergeLimits = {
  maxLineQuantity: number;
  maxItems: number;
  maxTotalQuantity: number;
};

export const DEFAULT_CART_MERGE_LIMITS: MergeLimits = {
  maxLineQuantity: MAX_CART_LINE_QUANTITY,
  maxItems: MAX_CART_ITEMS,
  maxTotalQuantity: MAX_CART_TOTAL_QUANTITY,
};

function validateLine(line: CartLineInput, field: string): CartLineInput {
  return {
    productId: parsePositiveInteger(line.productId, `${field}.productId`),
    variantId: parsePositiveInteger(line.variantId, `${field}.variantId`),
    quantity: parsePositiveInteger(line.quantity, `${field}.quantity`, MAX_CART_LINE_QUANTITY),
  };
}

/**
 * Merge two server-owned line sets. Client payloads never carry prices or
 * display data; this function only combines validated product/variant IDs and
 * quantities. A conflicting product for one variant is rejected rather than
 * guessed, and overflow fails closed instead of silently inflating a cart.
 */
export function mergeCartLines(
  existing: CartLineInput[],
  incoming: CartLineInput[],
  limits: MergeLimits = DEFAULT_CART_MERGE_LIMITS,
): CartLineInput[] {
  const merged = new Map<string, CartLineInput>();
  const variantProducts = new Map<number, number>();

  const add = (rawLine: CartLineInput, field: string) => {
    const line = validateLine(rawLine, field);
    const priorProduct = variantProducts.get(line.variantId);
    if (priorProduct !== undefined && priorProduct !== line.productId) {
      throw new StorefrontInputError('A variant cannot belong to two products.', field);
    }
    variantProducts.set(line.variantId, line.productId);

    const key = `${line.productId}:${line.variantId}`;
    const prior = merged.get(key);
    const quantity = (prior?.quantity || 0) + line.quantity;
    if (quantity > limits.maxLineQuantity) {
      throw new StorefrontInputError(
        `Quantity for a cart item cannot exceed ${limits.maxLineQuantity}.`,
        `${field}.quantity`,
      );
    }

    merged.set(key, { ...line, quantity });
  };

  existing.forEach((line, index) => add(line, `existing[${index}]`));
  incoming.forEach((line, index) => add(line, `incoming[${index}]`));

  if (merged.size > limits.maxItems) {
    throw new StorefrontInputError(`A cart cannot contain more than ${limits.maxItems} items.`, 'items');
  }

  const totalQuantity = [...merged.values()].reduce((sum, line) => sum + line.quantity, 0);
  if (totalQuantity > limits.maxTotalQuantity) {
    throw new StorefrontInputError(
      `A cart cannot contain more than ${limits.maxTotalQuantity} total units.`,
      'items',
    );
  }

  return [...merged.values()].sort((left, right) => {
    if (left.productId !== right.productId) return left.productId - right.productId;
    return left.variantId - right.variantId;
  });
}

export function mergeWishlistProductIds(
  existing: number[],
  incoming: number[],
  maxItems = MAX_WISHLIST_ITEMS,
) {
  const ids = new Set<number>();
  [...existing, ...incoming].forEach((value, index) => {
    ids.add(parsePositiveInteger(value, `productIds[${index}]`));
  });
  if (ids.size > maxItems) {
    throw new StorefrontInputError(`A wishlist cannot contain more than ${maxItems} items.`, 'items');
  }
  return [...ids].sort((left, right) => left - right);
}
