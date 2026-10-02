import { StorefrontInputError } from './errors';

export const MAX_CART_LINE_QUANTITY = 99;
export const MAX_CART_ITEMS = 100;
export const MAX_CART_TOTAL_QUANTITY = 9_999;
export const MAX_IMPORT_ITEMS = 100;
export const MAX_WISHLIST_ITEMS = 100;
/** Signed-in comparison lists mirror the UI's side-by-side slots (4). */
export const MAX_COMPARE_ITEMS = 4;
export const MAX_STOREFRONT_BODY_BYTES = 128 * 1024;

export type CartLineInput = {
  productId: number;
  variantId: number;
  quantity: number;
};

export type CartAddInput = CartLineInput;
export type CartUpdateInput = {
  itemId: number;
  quantity: number;
};
export type CartRemoveInput = {
  itemId: number;
};
export type CartImportInput = {
  items: CartLineInput[];
};
export type WishlistAddInput = {
  productId: number;
};
export type WishlistRemoveInput = {
  productId: number;
};
export type WishlistImportInput = {
  productIds: number[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accept JSON numbers and legacy JSON strings, but never fractional/boolean values. */
export function parsePositiveInteger(
  value: unknown,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    throw new StorefrontInputError(`${field} must be a positive integer.`, field);
  }

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new StorefrontInputError(`${field} must be a positive integer.`, field);
  }

  return parsed;
}

function requiredId(record: Record<string, unknown>, property: string, field = property) {
  return parsePositiveInteger(record[property], field);
}

function readAliasedInteger(
  record: Record<string, unknown>,
  property: string,
  alias: string,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  const hasProperty = record[property] !== undefined && record[property] !== null;
  const hasAlias = record[alias] !== undefined && record[alias] !== null;
  if (hasProperty && hasAlias) {
    const propertyValue = parsePositiveInteger(record[property], field, maximum);
    const aliasValue = parsePositiveInteger(record[alias], field, maximum);
    if (propertyValue !== aliasValue) {
      throw new StorefrontInputError(`${field} and its legacy alias must match.`, field);
    }
    return propertyValue;
  }
  return parsePositiveInteger(record[property] ?? record[alias], field, maximum);
}

function cartLineFromRecord(value: unknown, index: number): CartLineInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError(`items[${index}] must be an object.`, `items[${index}]`);
  }
  if (value.variantId === undefined || value.variantId === null) {
    throw new StorefrontInputError(
      `items[${index}].variantId is required; import never chooses a default variant.`,
      `items[${index}].variantId`,
    );
  }

  return {
    productId: readAliasedInteger(value, 'productId', 'id', `items[${index}].productId`),
    variantId: requiredId(value, 'variantId', `items[${index}].variantId`),
    quantity: (value.quantity === undefined || value.quantity === null) &&
      (value.qty === undefined || value.qty === null)
      ? 1
      : readAliasedInteger(
        value,
        'quantity',
        'qty',
        `items[${index}].quantity`,
        MAX_CART_LINE_QUANTITY,
      ),
  };
}

export function parseCartAddInput(value: unknown): CartAddInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError('A JSON object is required.', 'body');
  }

  if (value.variantId === undefined || value.variantId === null) {
    throw new StorefrontInputError('variantId is required; the server never chooses a default variant.', 'variantId');
  }

  return {
    productId: readAliasedInteger(value, 'productId', 'id', 'productId'),
    variantId: requiredId(value, 'variantId'),
    quantity: (value.quantity === undefined || value.quantity === null) &&
      (value.qty === undefined || value.qty === null)
      ? 1
      : readAliasedInteger(value, 'quantity', 'qty', 'quantity', MAX_CART_LINE_QUANTITY),
  };
}

export function parseCartUpdateInput(value: unknown): CartUpdateInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError('A JSON object is required.', 'body');
  }

  const itemIdValue = value.itemId ?? value.cartItemId ?? value.id;
  return {
    itemId: parsePositiveInteger(itemIdValue, 'itemId'),
    quantity: readAliasedInteger(value, 'quantity', 'qty', 'quantity', MAX_CART_LINE_QUANTITY),
  };
}

export function parseCartRemoveInput(value: unknown): CartRemoveInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError('A JSON object is required.', 'body');
  }

  const itemIdValue = value.itemId ?? value.cartItemId ?? value.id;
  return {
    itemId: parsePositiveInteger(itemIdValue, 'itemId'),
  };
}

export function parseCartImportInput(value: unknown): CartImportInput {
  const body = isRecord(value) ? value : Array.isArray(value) ? { items: value } : null;
  if (!body) {
    throw new StorefrontInputError('A JSON object or array is required.', 'body');
  }

  if (body.items !== undefined && !Array.isArray(body.items)) {
    throw new StorefrontInputError('items must be an array.', 'items');
  }
  if (isRecord(body.cart) && body.cart.items !== undefined && !Array.isArray(body.cart.items)) {
    throw new StorefrontInputError('cart.items must be an array.', 'cart.items');
  }
  const rawItems = Array.isArray(body.items)
    ? body.items
    : isRecord(body.cart) && Array.isArray(body.cart.items)
      ? body.cart.items
      : undefined;

  // Accept a single legacy line as a convenience, but still require the
  // server to resolve both IDs below.
  const hasLegacyLineFields =
    body.productId !== undefined ||
    body.id !== undefined ||
    body.variantId !== undefined ||
    body.quantity !== undefined ||
    body.qty !== undefined;
  const items = rawItems === undefined
    ? (hasLegacyLineFields ? [body] : [])
    : rawItems;

  if (items.length > MAX_IMPORT_ITEMS) {
    throw new StorefrontInputError(`At most ${MAX_IMPORT_ITEMS} cart items may be imported.`, 'items');
  }

  return {
    items: items.map((item, index) => cartLineFromRecord(item, index)),
  };
}

export function parseWishlistAddInput(value: unknown): WishlistAddInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError('A JSON object is required.', 'body');
  }

  return { productId: readAliasedInteger(value, 'productId', 'id', 'productId') };
}

export function parseWishlistRemoveInput(value: unknown): WishlistRemoveInput {
  if (!isRecord(value)) {
    throw new StorefrontInputError('A JSON object is required.', 'body');
  }

  return { productId: readAliasedInteger(value, 'productId', 'id', 'productId') };
}

export function parseWishlistImportInput(value: unknown): WishlistImportInput {
  const body = isRecord(value) ? value : Array.isArray(value) ? { items: value } : null;
  if (!body) {
    throw new StorefrontInputError('A JSON object or array is required.', 'body');
  }

  if (body.items !== undefined && !Array.isArray(body.items)) {
    throw new StorefrontInputError('items must be an array.', 'items');
  }
  if (body.productIds !== undefined && !Array.isArray(body.productIds)) {
    throw new StorefrontInputError('productIds must be an array.', 'productIds');
  }
  const rawItems = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.productIds)
      ? body.productIds
      : undefined;

  const items = rawItems === undefined ? [] : rawItems;
  if (items.length > MAX_WISHLIST_ITEMS) {
    throw new StorefrontInputError(`At most ${MAX_WISHLIST_ITEMS} wishlist items may be imported.`, 'items');
  }

  const productIds = items.map((item, index) => {
    if (typeof item === 'number' || typeof item === 'string') {
      return parsePositiveInteger(item, `items[${index}]`);
    }
    if (!isRecord(item)) {
      throw new StorefrontInputError(`items[${index}] must be a product id or object.`, `items[${index}]`);
    }
    return readAliasedInteger(item, 'productId', 'id', `items[${index}].productId`);
  });

  return { productIds: [...new Set(productIds)] };
}

export function parseRequestAction(value: unknown) {
  if (!isRecord(value)) return 'add';
  const action = value.action;
  if (action === undefined) return 'add';
  if (
    action === 'add' ||
    action === 'update' ||
    action === 'remove' ||
    action === 'clear' ||
    action === 'import' ||
    action === 'merge'
  ) {
    return action;
  }
  throw new StorefrontInputError('Unsupported cart action.', 'action');
}

const CART_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCartId(value: string | null | undefined): value is string {
  return typeof value === 'string' && CART_UUID.test(value);
}

export function assertBodySize(contentLength: string | null, bodyText: string) {
  const declaredLength = contentLength ? Number(contentLength) : Number.NaN;
  if (Number.isFinite(declaredLength) && declaredLength > MAX_STOREFRONT_BODY_BYTES) {
    throw new StorefrontInputError('Request body is too large.', 'body');
  }
  if (bodyText.length > MAX_STOREFRONT_BODY_BYTES) {
    throw new StorefrontInputError('Request body is too large.', 'body');
  }
}
