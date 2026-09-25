'use client';

export const DEFAULT_CLIENT_TIMEOUT_MS = 10_000;

export type StorefrontErrorCode =
  | 'request-timeout'
  | 'request-aborted'
  | 'network-error'
  | 'invalid-response'
  | 'same-origin-required'
  | 'api-error';

export class StorefrontClientError extends Error {
  readonly status: number;
  readonly code: StorefrontErrorCode | string;
  readonly field?: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: StorefrontErrorCode | string;
      field?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'StorefrontClientError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'api-error';
    this.field = options.field;
    this.retryable = options.retryable ?? (this.status === 0 || this.status >= 500);
  }
}

export function isStorefrontClientError(error: unknown): error is StorefrontClientError {
  return error instanceof StorefrontClientError;
}

export function isStorefrontAuthenticationError(error: unknown): boolean {
  return isStorefrontClientError(error) && (error.status === 401 || error.status === 403);
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StorefrontClientError(`The storefront response is missing ${field}.`, {
      code: 'invalid-response',
    });
  }
  return value;
}

function optionalString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new StorefrontClientError('The storefront response contains an invalid image URL.', {
      code: 'invalid-response',
    });
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new StorefrontClientError(`The storefront response contains an invalid ${field}.`, {
      code: 'invalid-response',
    });
  }
  return parsed;
}

function quantity(value: unknown): number {
  const parsed = positiveInteger(value, 'quantity');
  if (parsed > 99) {
    throw new StorefrontClientError('The storefront returned a quantity above the supported limit.', {
      code: 'invalid-response',
    });
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new StorefrontClientError(`The storefront response contains an invalid ${field}.`, {
      code: 'invalid-response',
    });
  }
  return parsed;
}

function money(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new StorefrontClientError(`The storefront response contains an invalid ${field}.`, {
      code: 'invalid-response',
    });
  }
  return parsed;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new StorefrontClientError(`The storefront response is missing ${field}.`, {
      code: 'invalid-response',
    });
  }
  return value;
}

function responseRoot(value: unknown, key: 'cart' | 'wishlist'): JsonRecord {
  if (!isRecord(value)) {
    throw new StorefrontClientError('The storefront returned an invalid response.', {
      code: 'invalid-response',
    });
  }
  const nested = value[key];
  if (isRecord(nested)) return nested;
  if (key === 'cart' && isRecord(value.cart) === false && Array.isArray(value.items)) {
    return value;
  }
  if (key === 'wishlist' && Array.isArray(value.items)) {
    return value;
  }
  throw new StorefrontClientError(`The storefront response is missing ${key}.`, {
    code: 'invalid-response',
  });
}

function parseJson(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StorefrontClientError('The storefront returned invalid JSON.', {
      code: 'invalid-response',
    });
  }
}

function errorFromResponse(response: Response, payload: unknown): StorefrontClientError {
  const record = isRecord(payload) ? payload : {};
  const message = typeof record.error === 'string' && record.error.trim()
    ? record.error
    : `The storefront request failed (${response.status}).`;
  const code = typeof record.code === 'string' && record.code.trim() ? record.code : 'api-error';
  const field = typeof record.field === 'string' && record.field.trim() ? record.field : undefined;
  return new StorefrontClientError(message, {
    status: response.status,
    code,
    field,
    retryable: response.status >= 500 || response.status === 408 || response.status === 429,
  });
}

export type StorefrontRequestInit = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * All storefront requests are relative, same-origin requests. The explicit
 * origin check is intentional: it prevents a future caller from accidentally
 * sending session cookies to an external host.
 */
export async function storefrontRequest<T>(
  path: string,
  init: StorefrontRequestInit = {},
): Promise<T> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    throw new StorefrontClientError('Storefront requests require a browser.', {
      code: 'network-error',
    });
  }

  const origin = window.location.origin;
  const url = new URL(path, origin);
  if (url.origin !== origin) {
    throw new StorefrontClientError('Storefront requests must remain on the current origin.', {
      code: 'same-origin-required',
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = init.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    let body: string | undefined;
    if (init.body !== undefined) {
      try {
        body = JSON.stringify(init.body);
      } catch {
        throw new StorefrontClientError('The storefront request body could not be encoded.', {
          code: 'network-error',
        });
      }
    }

    const response = await fetch(url.toString(), {
      method: init.method ?? 'GET',
      credentials: 'include',
      cache: 'no-store',
      mode: 'same-origin',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body,
      signal: controller.signal,
    });
    const payload = parseJson(await response.text());
    if (!response.ok) throw errorFromResponse(response, payload);
    return payload as T;
  } catch (error) {
    if (error instanceof StorefrontClientError) throw error;
    if (timedOut) {
      throw new StorefrontClientError('The storefront request timed out. Please retry.', {
        code: 'request-timeout',
        retryable: true,
      });
    }
    if (controller.signal.aborted || (externalSignal?.aborted ?? false)) {
      throw new StorefrontClientError('The storefront request was cancelled.', {
        code: 'request-aborted',
        retryable: true,
      });
    }
    throw new StorefrontClientError('The storefront could not be reached. Please retry.', {
      code: 'network-error',
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export type StorefrontCartLine = {
  serverItemId: number;
  productId: number;
  variantId: number;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  available: boolean;
};

export type StorefrontCartSnapshot = {
  owner: 'guest' | 'customer';
  items: StorefrontCartLine[];
  mergeAvailable: boolean;
  imported: boolean;
  merged: boolean;
};

function mapCartLine(value: unknown): StorefrontCartLine {
  if (!isRecord(value)) {
    throw new StorefrontClientError('The storefront returned an invalid cart line.', {
      code: 'invalid-response',
    });
  }
  const product = isRecord(value.product) ? value.product : null;
  const variant = isRecord(value.variant) ? value.variant : null;
  if (!product || !variant) {
    throw new StorefrontClientError('The storefront returned incomplete cart product data.', {
      code: 'invalid-response',
    });
  }

  const productId = positiveInteger(value.productId, 'productId');
  const nestedProductId = positiveInteger(product.id, 'product.id');
  if (nestedProductId !== productId) {
    throw new StorefrontClientError('The storefront returned inconsistent cart product IDs.', {
      code: 'invalid-response',
    });
  }
  const variantId = positiveInteger(value.variantId, 'variantId');
  const nestedVariantId = positiveInteger(variant.id, 'variant.id');
  if (nestedVariantId !== variantId) {
    throw new StorefrontClientError('The storefront returned inconsistent cart variant IDs.', {
      code: 'invalid-response',
    });
  }

  const unitPrice = value.unitPrice === undefined
    ? money(variant.price, 'variant.price')
    : money(value.unitPrice, 'unitPrice');

  return {
    serverItemId: positiveInteger(value.id, 'cart item id'),
    productId,
    variantId,
    name: requiredString(product.name, 'product.name'),
    imageUrl: optionalString(product.imageUrl),
    price: unitPrice,
    quantity: quantity(value.quantity),
    available: requiredBoolean(value.available, 'response availability'),
  };
}

export function mapCartResponse(payload: unknown): StorefrontCartSnapshot {
  const root = responseRoot(payload, 'cart');
  if (root.owner !== 'guest' && root.owner !== 'customer') {
    throw new StorefrontClientError('The storefront returned an invalid cart owner.', {
      code: 'invalid-response',
    });
  }
  if (!Array.isArray(root.items)) {
    throw new StorefrontClientError('The storefront response is missing cart items.', {
      code: 'invalid-response',
    });
  }

  return {
    owner: root.owner,
    items: root.items.map(mapCartLine),
    mergeAvailable: booleanValue(root.mergeAvailable, false),
    imported: booleanValue(payload && isRecord(payload) ? payload.imported : false, false),
    merged: booleanValue(payload && isRecord(payload) ? payload.merged : false, false),
  };
}

export type StorefrontWishlistRow = {
  productId: number;
  variantId: null;
  name: string;
  imageUrl: string;
  price: number;
  priceAvailable: boolean;
  stockQuantity: number;
  available: boolean;
  addedAt: string;
};

export type StorefrontWishlistSnapshot = {
  items: StorefrontWishlistRow[];
  count: number;
  imported: boolean;
};

function mapWishlistRow(value: unknown): StorefrontWishlistRow {
  if (!isRecord(value) || !isRecord(value.product)) {
    throw new StorefrontClientError('The storefront returned an invalid wishlist row.', {
      code: 'invalid-response',
    });
  }
  const productId = positiveInteger(value.productId, 'productId');
  const nestedProductId = positiveInteger(value.product.id, 'product.id');
  if (nestedProductId !== productId) {
    throw new StorefrontClientError('The storefront returned inconsistent wishlist product IDs.', {
      code: 'invalid-response',
    });
  }
  const rawPrice = value.product.price;
  const hasPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== '';
  return {
    productId,
    variantId: null,
    name: requiredString(value.product.name, 'product.name'),
    imageUrl: optionalString(value.product.imageUrl),
    price: hasPrice ? money(rawPrice, 'product.price') : 0,
    priceAvailable: hasPrice,
    stockQuantity: nonNegativeInteger(value.product.stockQuantity, 'product.stockQuantity'),
    available: requiredBoolean(value.available, 'response availability'),
    addedAt: requiredString(value.addedAt, 'addedAt'),
  };
}

export function mapWishlistResponse(payload: unknown): StorefrontWishlistSnapshot {
  const root = responseRoot(payload, 'wishlist');
  if (!Array.isArray(root.items)) {
    throw new StorefrontClientError('The storefront response is missing wishlist items.', {
      code: 'invalid-response',
    });
  }
  const items = root.items.map(mapWishlistRow);
  return {
    items,
    count: typeof root.count === 'number' && Number.isInteger(root.count) && root.count >= 0
      ? root.count
      : items.length,
    imported: booleanValue(payload && isRecord(payload) ? payload.imported : false, false),
  };
}

export type CartFingerprintLine = {
  productId: number | string;
  variantId: number | string | null;
  quantity: number;
};

export function cartFingerprint(lines: readonly CartFingerprintLine[]): string {
  return JSON.stringify(
    [...lines]
      .sort((left, right) => {
        const product = String(left.productId).localeCompare(String(right.productId), undefined, { numeric: true });
        if (product !== 0) return product;
        return String(left.variantId).localeCompare(String(right.variantId), undefined, { numeric: true });
      })
      .map((line) => [line.productId, line.variantId, line.quantity]),
  );
}

export type CartServerLine = {
  productId: number;
  variantId: number;
  quantity: number;
};

export const storefrontCartApi = {
  get: (signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/cart', { signal }),
  add: (line: CartServerLine, signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/cart/items', {
    method: 'POST',
    body: line,
    signal,
  }),
  update: (itemId: number, nextQuantity: number, signal?: AbortSignal) => storefrontRequest<unknown>(
    `/api/storefront/cart/items/${encodeURIComponent(String(itemId))}`,
    { method: 'PATCH', body: { quantity: nextQuantity }, signal },
  ),
  remove: (itemId: number, signal?: AbortSignal) => storefrontRequest<unknown>(
    `/api/storefront/cart/items/${encodeURIComponent(String(itemId))}`,
    { method: 'DELETE', body: {}, signal },
  ),
  clear: (signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/cart', {
    method: 'DELETE',
    body: {},
    signal,
  }),
  import: (items: readonly CartServerLine[], signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/cart/import', {
    method: 'POST',
    body: { items },
    signal,
  }),
  merge: (signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/cart/merge', {
    method: 'POST',
    body: {},
    signal,
  }),
};

export const storefrontWishlistApi = {
  get: (signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/wishlist', { signal }),
  add: (productId: number, signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/wishlist/items', {
    method: 'POST',
    body: { productId },
    signal,
  }),
  remove: (productId: number, signal?: AbortSignal) => storefrontRequest<unknown>(
    `/api/storefront/wishlist/items/${encodeURIComponent(String(productId))}`,
    { method: 'DELETE', body: {}, signal },
  ),
  clear: (signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/wishlist', {
    method: 'DELETE',
    body: {},
    signal,
  }),
  import: (productIds: readonly number[], signal?: AbortSignal) => storefrontRequest<unknown>('/api/storefront/wishlist/import', {
    method: 'POST',
    body: { productIds },
    signal,
  }),
};
