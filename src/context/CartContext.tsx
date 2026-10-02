'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  cartFingerprint,
  isStorefrontAuthenticationError,
  isStorefrontClientError,
  mapCartResponse,
  StorefrontClientError,
  storefrontCartApi,
  type CartServerLine,
  type StorefrontCartLine,
  type StorefrontCartSnapshot,
} from '@/lib/storefront/client/commerce-api';

export const CART_STORAGE_KEY = 'dreamstore_cart';
export const CART_SERVER_MIGRATION_KEY = 'dreamstore_cart_server_migration_v1';
export const DEFAULT_CART_MAX_QUANTITY = 99;
export const MAX_CART_QUANTITY = DEFAULT_CART_MAX_QUANTITY;

export type ProductId = number | string;
export type VariantId = ProductId | null;
export type CommerceHydrationStatus = 'loading' | 'ready' | 'error';
export type CommerceSyncStatus = 'local-only' | 'syncing' | 'synced' | 'error';
export type CommerceStorageScope = 'local' | 'session' | 'legacy-local' | 'memory' | 'unavailable';

/**
 * The canonical line model used by the storefront.
 *
 * `id` and `qty` are deliberately retained as deprecated aliases because a
 * few older shop surfaces still read them while they are migrated to the
 * backend-shaped fields. New code should use productId, variantId, and
 * quantity.
 */
export type CartItem = {
  productId: ProductId;
  variantId: VariantId;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  /** Server cart-line identity, populated after the storefront API is connected. */
  serverItemId?: number;
  /** Server availability flag; local drafts may omit it. */
  available?: boolean;
  /** @deprecated Use productId. */
  id: ProductId;
  /** @deprecated Use quantity. */
  qty: number;
};

export type CartItemInput = {
  productId?: ProductId;
  variantId?: VariantId;
  /** @deprecated Use productId. */
  id?: ProductId;
  name: string;
  price: number;
  quantity?: number;
  serverItemId?: number;
  available?: boolean;
  /** @deprecated Use quantity. */
  qty?: number;
  imageUrl: string;
};

export type CartItemSelector =
  | ProductId
  | { productId: ProductId; variantId?: VariantId }
  | { id: ProductId; variantId?: VariantId };

type CartCommand =
  | {
      kind: 'add' | 'update';
      productId: ProductId;
      variantId: VariantId;
      desiredQuantity: number;
      revision: number;
      key: string;
    }
  | {
      kind: 'remove';
      productId: ProductId;
      variantId: VariantId;
      revision: number;
      key: string;
    }
  | { kind: 'clear'; revision: number }
  | {
      kind: 'import';
      lines: CartServerLine[];
      localItems: CartItem[];
      fingerprint: string;
      baseline: Record<string, number>;
      revision: number;
    }
  | { kind: 'reconcile'; localItems: CartItem[]; revision: number };

type CartMigrationMarker = {
  version: 1;
  state: 'claimed' | 'complete';
  fingerprint: string;
  owner?: 'guest' | 'customer';
  baseline?: Record<string, number>;
};

export type CartMutationResult = {
  ok: boolean;
  changed: boolean;
  message?: string;
  reason?: 'invalid' | 'ambiguous' | 'not-found' | 'limit' | 'sync' | 'variant-unavailable';
};

type RecordValue = Record<string, unknown>;

type NormalizedInput = {
  item: CartItem;
  requestedQuantity: number;
  quantityWasCapped: boolean;
};

type ParsedQuantity = {
  value: number;
  wasCapped: boolean;
};

type StoredListResult = {
  items: CartItem[];
  hadInvalidEntries: boolean;
  hadCappedEntries: boolean;
};

type StorageReadResult = StoredListResult & {
  raw: string | null;
  available: boolean;
  readError: boolean;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): ProductId | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parseVariantId(value: unknown): { valid: boolean; value: VariantId } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: null };
  }
  const parsed = parseId(value);
  return parsed === null ? { valid: false, value: null } : { valid: true, value: parsed };
}

function parsePrice(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseServerItemId(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseQuantity(value: unknown, maxQuantity: number): ParsedQuantity | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return {
    value: Math.min(parsed, maxQuantity),
    wasCapped: parsed > maxQuantity,
  };
}

function parseProductId(record: RecordValue): ProductId | null {
  const hasCanonical = record.productId !== undefined && record.productId !== null;
  const hasLegacy = record.id !== undefined && record.id !== null;
  const canonical = hasCanonical ? parseId(record.productId) : null;
  const legacy = hasLegacy ? parseId(record.id) : null;

  if (hasCanonical && canonical === null) return null;
  if (hasLegacy && legacy === null) return null;
  if (hasCanonical && hasLegacy && canonical !== legacy) return null;
  return canonical ?? legacy;
}

function readQuantity(record: RecordValue, maxQuantity: number): ParsedQuantity | null {
  const hasCanonical = record.quantity !== undefined;
  const hasLegacy = record.qty !== undefined;
  const canonical = hasCanonical ? parseQuantity(record.quantity, maxQuantity) : null;
  const legacy = hasLegacy ? parseQuantity(record.qty, maxQuantity) : null;

  if (hasCanonical && canonical === null) return null;
  if (hasLegacy && legacy === null) return null;
  if (hasCanonical && hasLegacy && canonical?.value !== legacy?.value) return null;

  const parsed = canonical ?? legacy ?? parseQuantity(1, maxQuantity);
  if (!parsed) return null;
  return {
    value: parsed.value,
    wasCapped: Boolean(canonical?.wasCapped || legacy?.wasCapped),
  };
}

function makeCartItem(
  productId: ProductId,
  variantId: VariantId,
  name: string,
  price: number,
  quantity: number,
  imageUrl: string,
  serverItemId?: number,
  available?: boolean,
): CartItem {
  const item: CartItem = {
    productId,
    variantId,
    name,
    price,
    quantity,
    imageUrl,
    id: productId,
    qty: quantity,
  };
  if (serverItemId !== undefined) item.serverItemId = serverItemId;
  if (available !== undefined) item.available = available;
  return item;
}

function normalizeInput(input: CartItemInput, maxQuantity: number): NormalizedInput | null {
  if (!isRecord(input)) return null;

  const productId = parseProductId(input);
  if (productId === null) return null;

  const variant = parseVariantId(input.variantId);
  if (!variant.valid) return null;

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return null;

  const price = parsePrice(input.price);
  if (price === null) return null;

  const imageUrl = input.imageUrl === undefined || input.imageUrl === null ? '' : input.imageUrl;
  if (typeof imageUrl !== 'string') return null;

  const hasCanonicalQuantity = input.quantity !== undefined;
  const hasLegacyQuantity = input.qty !== undefined;
  if (hasCanonicalQuantity && hasLegacyQuantity && input.quantity !== input.qty) return null;

  const requested = readQuantity(input, maxQuantity);
  if (!requested) return null;

  return {
    item: makeCartItem(
      productId,
      variant.value,
      name,
      price,
      requested.value,
      imageUrl,
      parseServerItemId(input.serverItemId),
      typeof input.available === 'boolean' ? input.available : undefined,
    ),
    requestedQuantity: requested.value,
    quantityWasCapped: requested.wasCapped,
  };
}

function lineKey(productId: ProductId, variantId: VariantId): string {
  return JSON.stringify([
    typeof productId,
    productId,
    typeof variantId,
    variantId,
  ]);
}

function normalizeStoredList(value: unknown, maxQuantity: number): StoredListResult {
  if (!Array.isArray(value)) {
    return { items: [], hadInvalidEntries: true, hadCappedEntries: false };
  }

  const items: CartItem[] = [];
  const indexes = new Map<string, number>();
  let hadInvalidEntries = false;
  let hadCappedEntries = false;

  for (const rawItem of value) {
    if (!isRecord(rawItem)) {
      hadInvalidEntries = true;
      continue;
    }

    const productId = parseProductId(rawItem);
    if (productId === null) {
      hadInvalidEntries = true;
      continue;
    }

    const variant = parseVariantId(rawItem.variantId);
    if (!variant.valid) {
      hadInvalidEntries = true;
      continue;
    }

    const name = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';
    const price = parsePrice(rawItem.price);
    const quantity = readQuantity(rawItem, maxQuantity);
    if (!name || price === null || !quantity) {
      hadInvalidEntries = true;
      continue;
    }

    const imageUrl = rawItem.imageUrl === undefined || rawItem.imageUrl === null ? '' : rawItem.imageUrl;
    if (typeof imageUrl !== 'string') {
      hadInvalidEntries = true;
      continue;
    }

    hadCappedEntries ||= quantity.wasCapped;
    const key = lineKey(productId, variant.value);
    const existingIndex = indexes.get(key);
    const item = makeCartItem(
      productId,
      variant.value,
      name,
      price,
      quantity.value,
      imageUrl,
      parseServerItemId(rawItem.serverItemId),
      typeof rawItem.available === 'boolean' ? rawItem.available : undefined,
    );

    if (existingIndex === undefined) {
      indexes.set(key, items.length);
      items.push(item);
      continue;
    }

    const existing = items[existingIndex];
    const mergedQuantity = Math.min(existing.quantity + item.quantity, maxQuantity);
    hadCappedEntries ||= existing.quantity + item.quantity > maxQuantity;
    items[existingIndex] = makeCartItem(
      productId,
      variant.value,
      name,
      price,
      mergedQuantity,
      imageUrl,
      existing.serverItemId,
      existing.available,
    );
  }

  return { items, hadInvalidEntries, hadCappedEntries };
}

function serializeCartItems(items: readonly CartItem[]) {
  return items.map((item) => {
    const serialized: Omit<CartItem, 'id' | 'qty'> = {
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
    };
    if (item.serverItemId !== undefined) serialized.serverItemId = item.serverItemId;
    if (item.available !== undefined) serialized.available = item.available;
    return serialized;
  });
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCartStorage(maxQuantity: number): StorageReadResult {
  const storage = getLocalStorage();
  if (!storage) {
    return {
      items: [],
      raw: null,
      available: false,
      readError: true,
      hadInvalidEntries: false,
      hadCappedEntries: false,
    };
  }

  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (raw === null) {
      return {
        items: [],
        raw: null,
        available: true,
        readError: false,
        hadInvalidEntries: false,
        hadCappedEntries: false,
      };
    }

    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStoredList(parsed, maxQuantity);
    return { ...normalized, raw, available: true, readError: false };
  } catch {
    return {
      items: [],
      raw: null,
      available: false,
      readError: true,
      hadInvalidEntries: true,
      hadCappedEntries: false,
    };
  }
}

export type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItemInput) => CartMutationResult;
  removeFromCart: (selector: CartItemSelector, variantId?: VariantId) => CartMutationResult;
  updateQty: (selector: CartItemSelector, quantity: number, variantId?: VariantId) => CartMutationResult;
  clearCart: () => void;
  replaceCart: (items: readonly CartItemInput[]) => CartMutationResult;
  totalItems: number;
  subtotal: number;
  maxQuantity: number;
  maxCartQuantity: number;
  isHydrated: boolean;
  hydrated: boolean;
  hydrationStatus: CommerceHydrationStatus;
  isHydrating: boolean;
  isLoading: boolean;
  loading: boolean;
  isPending: boolean;
  pending: boolean;
  error: string | null;
  storageError: string | null;
  /** Optional integration hooks for callers that coordinate additional sync work. */
  setSyncPending: (pending: boolean) => void;
  setSyncError: (message: string | null) => void;
  storageScope: CommerceStorageScope;
  syncStatus: CommerceSyncStatus;
  isServerSynced: boolean;
  isLocalOnly: boolean;
  serverOwner: 'guest' | 'customer' | null;
  serverError: string | null;
  hasLocalDraft: boolean;
  refreshFromServer: () => void;
  retrySync: () => void;
  retryHydration: () => void;
  clearError: () => void;
  isInCart: (selector: CartItemSelector) => boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizeSelector(
  selector: CartItemSelector,
  explicitVariantId?: VariantId,
): { productId: ProductId; variantId: VariantId; exactVariant: boolean } | null {
  if (typeof selector === 'string' || typeof selector === 'number') {
    return {
      productId: selector,
      variantId: explicitVariantId ?? null,
      exactVariant: explicitVariantId !== undefined,
    };
  }

  if (!isRecord(selector)) return null;
  const productId = parseProductId(selector);
  if (productId === null) return null;
  const hasVariant = Object.prototype.hasOwnProperty.call(selector, 'variantId');
  const variant = parseVariantId(selector.variantId);
  if (!variant.valid) return null;

  return {
    productId,
    variantId: explicitVariantId ?? variant.value,
    exactVariant: hasVariant || explicitVariantId !== undefined,
  };
}

function findSelectedIndex(items: readonly CartItem[], selector: CartItemSelector, explicitVariantId?: VariantId): number {
  const normalized = normalizeSelector(selector, explicitVariantId);
  if (!normalized) return -1;

  const candidates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.productId === normalized.productId);

  if (normalized.exactVariant) {
    return candidates.find(({ item }) => item.variantId === normalized.variantId)?.index ?? -1;
  }

  if (candidates.length === 1) return candidates[0].index;
  return candidates.find(({ item }) => item.variantId === null)?.index ?? -1;
}

function toServerId(value: ProductId | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function cartItemFromServerLine(line: StorefrontCartLine): CartItem {
  return makeCartItem(
    line.productId,
    line.variantId,
    line.name,
    line.price,
    line.quantity,
    line.imageUrl,
    line.serverItemId,
    line.available,
  );
}

function cartLineSnapshot(items: readonly CartItem[]): Record<string, number> {
  return Object.fromEntries(items.map((item) => [lineKey(item.productId, item.variantId), item.quantity]));
}

function localCartFingerprint(items: readonly CartItem[]): string {
  return cartFingerprint(items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  })));
}

function mergeServerMetadata(localItems: readonly CartItem[], serverItems: readonly CartItem[]): CartItem[] {
  const serverByKey = new Map(serverItems.map((item) => [lineKey(item.productId, item.variantId), item]));
  return localItems.map((item) => {
    const exact = serverByKey.get(lineKey(item.productId, item.variantId));
    const serverItem = exact ?? getServerLine(serverItems, item.productId, item.variantId);
    if (!serverItem) {
      const draft = { ...item };
      delete draft.serverItemId;
      return draft;
    }
    return {
      ...item,
      productId: serverItem.productId,
      variantId: serverItem.variantId,
      name: serverItem.name,
      price: serverItem.price,
      imageUrl: serverItem.imageUrl,
      serverItemId: serverItem.serverItemId,
      available: serverItem.available,
      id: serverItem.productId,
    };
  });
}

function getServerLine(items: readonly CartItem[], productId: ProductId, variantId: VariantId) {
  const key = lineKey(productId, variantId);
  const exact = items.find((item) => lineKey(item.productId, item.variantId) === key);
  if (exact) return exact;
  const numericProductId = toServerId(productId);
  const numericVariantId = toServerId(variantId);
  if (numericProductId === null || numericVariantId === null) return undefined;
  return items.find(
    (item) => toServerId(item.productId) === numericProductId && toServerId(item.variantId) === numericVariantId,
  );
}

function errorText(error: unknown, fallback: string): string {
  return isStorefrontClientError(error) && error.message.trim() ? error.message : fallback;
}

function readMigrationMarker(): CartMigrationMarker | null {
  const local = getLocalStorage();
  const session = typeof window === 'undefined' ? null : (() => {
    try { return window.sessionStorage; } catch { return null; }
  })();
  for (const storage of [local, session]) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(CART_SERVER_MIGRATION_KEY);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 1 || (parsed.state !== 'claimed' && parsed.state !== 'complete') || typeof parsed.fingerprint !== 'string') continue;
      let baseline: Record<string, number> | undefined;
      if (isRecord(parsed.baseline)) {
        baseline = {};
        for (const [key, value] of Object.entries(parsed.baseline)) {
          if (typeof value === 'number' && Number.isFinite(value)) baseline[key] = value;
        }
      }
      return {
        version: 1,
        state: parsed.state,
        fingerprint: parsed.fingerprint,
        owner: parsed.owner === 'guest' || parsed.owner === 'customer' ? parsed.owner : undefined,
        baseline,
      };
    } catch {
      // Try the other browser storage area without changing malformed data.
    }
  }
  return null;
}

function writeMigrationMarker(marker: CartMigrationMarker): boolean {
  const storages = [getLocalStorage(), typeof window === 'undefined' ? null : (() => {
    try { return window.sessionStorage; } catch { return null; }
  })()];
  let wrote = false;
  for (const storage of storages) {
    if (!storage) continue;
    try {
      storage.setItem(CART_SERVER_MIGRATION_KEY, JSON.stringify(marker));
      wrote = true;
    } catch {
      // Try the fallback storage area.
    }
  }
  return wrote;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const cartReadError = t('cart.storage_read_error');
  const cartWriteError = t('cart.storage_write_error');
  const invalidCartError = t('cart.error_invalid_item');
  const maxQuantityMessage = t('cart.error_max_quantity');
  const cartInvalidDataError = t('cart.storage_invalid_data');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState<CommerceHydrationStatus>('loading');
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageScope, setStorageScope] = useState<CommerceStorageScope>('local');
  const [syncStatus, setSyncStatus] = useState<CommerceSyncStatus>('local-only');
  const [serverOwner, setServerOwner] = useState<'guest' | 'customer' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const itemsRef = useRef<CartItem[]>([]);
  const hydratedRef = useRef(false);
  const deferredItemsRef = useRef<CartItem[] | null>(null);
  const storageWriteFailedRef = useRef(false);
  const storageProtectedRef = useRef(false);
  const storageWarningRef = useRef<string | null>(null);
  const serverCartRef = useRef<CartItem[]>([]);
  const serverOwnerRef = useRef<'guest' | 'customer' | null>(null);
  const serverReadyRef = useRef(false);
  const serverInitPromiseRef = useRef<Promise<void> | null>(null);
  const serverSyncInFlightRef = useRef(false);
  const serverRefreshAbortRef = useRef<AbortController | null>(null);
  const commandQueueRef = useRef<CartCommand[]>([]);
  const commandProcessingRef = useRef(false);
  const failedCommandRef = useRef<CartCommand | null>(null);
  const localRevisionRef = useRef(0);
  const syncCountRef = useRef(0);
  const externalPendingRef = useRef(false);
  const migrationMarkerRef = useRef<CartMigrationMarker | null>(null);

  const updatePending = useCallback(() => {
    setIsPending(syncCountRef.current > 0 || externalPendingRef.current || !hydratedRef.current);
  }, []);

  const beginSync = useCallback(() => {
    syncCountRef.current += 1;
    updatePending();
  }, [updatePending]);

  const endSync = useCallback(() => {
    syncCountRef.current = Math.max(0, syncCountRef.current - 1);
    updatePending();
  }, [updatePending]);

  const persist = useCallback((next: CartItem[], force = false): boolean => {
    if (!hydratedRef.current) return false;
    if (storageProtectedRef.current && !force) return true;
    const storage = getLocalStorage();
    if (!storage) {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(cartWriteError);
      return false;
    }

    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(serializeCartItems(next)));
      storageWriteFailedRef.current = false;
      if (force) {
        storageProtectedRef.current = false;
        storageWarningRef.current = null;
      }
      setStorageScope('local');
      setError((current) => current === cartWriteError ? null : current);
      return true;
    } catch {
      storageWriteFailedRef.current = true;
      setStorageScope('memory');
      setError(cartWriteError);
      return false;
    }
  }, [cartWriteError]);

  const commit = useCallback(
    (next: CartItem[]): boolean => {
      itemsRef.current = next;
      setCart(next);
      if (!hydratedRef.current) {
        deferredItemsRef.current = next;
        return false;
      }
      return persist(next);
    },
    [persist],
  );

  const prepareLocalMutation = useCallback(() => {
    storageProtectedRef.current = false;
    storageWarningRef.current = null;
  }, []);

  const hydrateFromStorage = useCallback(() => {
    setHydrationStatus('loading');
    setIsHydrated(false);
    setError(null);
    beginSync();
    migrationMarkerRef.current = readMigrationMarker();

    const result = readCartStorage(DEFAULT_CART_MAX_QUANTITY);
    storageWriteFailedRef.current = false;
    const deferred = deferredItemsRef.current;
    let nextItems = result.items;
    let nextError: string | null = null;
    let nextScope: CommerceStorageScope = result.available ? 'local' : 'memory';

    if (result.readError) {
      nextError = cartReadError;
      nextScope = 'unavailable';
    } else if (result.hadInvalidEntries || result.hadCappedEntries) {
      nextError = 'Some saved cart data was malformed or above the quantity limit. The valid items are shown, and the saved data was left unchanged.';
    }

    if (deferred) {
      nextItems = deferred;
      deferredItemsRef.current = null;
    } else if (result.raw === null && itemsRef.current.length > 0) {
      // A retry after a failed write must not erase the in-memory cart.
      nextItems = itemsRef.current;
      nextScope = 'memory';
    }

    storageProtectedRef.current = Boolean(nextError);
    storageWarningRef.current = nextError;
    if (deferred) {
      storageProtectedRef.current = false;
      storageWarningRef.current = null;
    }
    itemsRef.current = nextItems;
    hydratedRef.current = true;
    setCart(nextItems);
    setStorageScope(nextScope);
    setError(nextError);
    setIsHydrated(true);
    setHydrationStatus(nextError ? 'error' : 'ready');
    if (!nextError) setSyncStatus('local-only');
    endSync();

    if (deferred) {
      persist(nextItems);
    }
  }, [beginSync, cartReadError, endSync, persist]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const applyServerItems = useCallback((
    authoritativeItems: readonly CartItem[],
    owner: 'guest' | 'customer',
    revision: number,
    preserveLocalDraft = false,
  ) => {
    serverCartRef.current = [...authoritativeItems];
    serverOwnerRef.current = owner;
    serverReadyRef.current = true;
    setServerOwner(owner);

    const shouldReplaceLocal = !preserveLocalDraft && localRevisionRef.current === revision;
    const nextItems = shouldReplaceLocal
      ? [...authoritativeItems]
      : mergeServerMetadata(itemsRef.current, authoritativeItems);
    itemsRef.current = nextItems;
    setCart(nextItems);
    setServerError(null);
    setSyncStatus('synced');
    setError(storageProtectedRef.current ? storageWarningRef.current : null);
    persist(nextItems);
    if (!preserveLocalDraft) {
      const markerSaved = writeMigrationMarker({
        version: 1,
        state: 'complete',
        fingerprint: localCartFingerprint(authoritativeItems),
        owner,
      });
      if (!markerSaved) {
        const message = 'The server cart is synced, but this browser could not record the migration state. It will be checked safely before the next import.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
      }
    }
  }, [persist]);

  const executeCartCommand = useCallback(async (command: CartCommand): Promise<StorefrontCartLine[] | null> => {
    const readMutationResponse = (payload: unknown) => {
      const snapshot = mapCartResponse(payload);
      serverOwnerRef.current = snapshot.owner;
      return snapshot.items;
    };
    const acceptReconcileResponse = (payload: unknown) => {
      const lines = readMutationResponse(payload);
      serverCartRef.current = lines.map(cartItemFromServerLine);
      return lines;
    };
    if (command.kind === 'reconcile') {
      let working = [...serverCartRef.current];
      let latest: StorefrontCartLine[] | null = null;
      const localKeys = new Set(command.localItems.map((item) => {
        const productId = toServerId(item.productId);
        const variantId = toServerId(item.variantId);
        if (productId === null || variantId === null) {
          throw new StorefrontClientError(
            'A local cart item has no concrete server variant yet. Choose product options before reconciling it.',
            { code: 'variant-unavailable', retryable: false },
          );
        }
        return lineKey(productId, variantId);
      }));

      for (const serverItem of [...working]) {
        const productId = toServerId(serverItem.productId);
        const variantId = toServerId(serverItem.variantId);
        if (productId === null || variantId === null) continue;
        if (localKeys.has(lineKey(productId, variantId))) continue;
        if (!serverItem.serverItemId) {
          throw new StorefrontClientError('A server cart line is missing its line ID.', {
            code: 'invalid-response',
          });
        }
        const response = await storefrontCartApi.remove(serverItem.serverItemId);
        latest = acceptReconcileResponse(response);
        working = latest.map(cartItemFromServerLine);
      }

      for (const localItem of command.localItems) {
        const productId = toServerId(localItem.productId);
        const variantId = toServerId(localItem.variantId);
        if (productId === null || variantId === null) {
          throw new StorefrontClientError(
            'A local cart item has no concrete server variant yet. Choose product options before reconciling it.',
            { code: 'variant-unavailable', retryable: false },
          );
        }
        const currentLine = getServerLine(working, productId, variantId);
        if (!currentLine) {
          const response = await storefrontCartApi.add({ productId, variantId, quantity: localItem.quantity });
          latest = acceptReconcileResponse(response);
          working = latest.map(cartItemFromServerLine);
        } else if (currentLine.quantity !== localItem.quantity) {
          if (!currentLine.serverItemId) {
            throw new StorefrontClientError('A server cart line is missing its line ID.', {
              code: 'invalid-response',
            });
          }
          const response = await storefrontCartApi.update(currentLine.serverItemId, localItem.quantity);
          latest = acceptReconcileResponse(response);
          working = latest.map(cartItemFromServerLine);
        }
      }
      return latest;
    }

    if (command.kind === 'import') {
      const lines = command.lines.map((line) => ({
        productId: toServerId(line.productId),
        variantId: toServerId(line.variantId),
        quantity: line.quantity,
      }));
      if (lines.some((line) => line.productId === null || line.variantId === null)) {
        throw new StorefrontClientError(
          'A local cart item has no concrete server variant yet. Choose product options before syncing it.',
          { code: 'variant-unavailable', retryable: false },
        );
      }

      const currentByKey = cartLineSnapshot(serverCartRef.current);
      const deltas = lines.flatMap((line) => {
        const key = lineKey(line.productId!, line.variantId!);
        const localQuantity = command.localItems.find((item) => (
          toServerId(item.productId) === line.productId && toServerId(item.variantId) === line.variantId
        ))?.quantity ?? line.quantity;
        const baselineQuantity = command.baseline[key] ?? 0;
        const desiredQuantity = baselineQuantity + localQuantity;
        const delta = desiredQuantity - (currentByKey[key] ?? 0);
        return delta > 0 ? [{ productId: line.productId!, variantId: line.variantId!, quantity: delta }] : [];
      });
      if (deltas.length === 0) return null;

      const response = await storefrontCartApi.import(deltas);
      return readMutationResponse(response);
    }

    if (command.kind === 'clear') {
      const response = await storefrontCartApi.clear();
      return readMutationResponse(response);
    }

    const productId = toServerId(command.productId);
    const variantId = toServerId(command.variantId);
    if (productId === null || variantId === null) {
      throw new StorefrontClientError(
        command.kind === 'remove'
          ? 'This local line has no concrete server variant and was removed only from the local draft.'
          : 'This product has no concrete server variant yet. Choose product options before adding it to the server cart.',
        { code: 'variant-unavailable', retryable: false },
      );
    }

    const currentLine = getServerLine(serverCartRef.current, productId, variantId);
    if (command.kind === 'remove') {
      if (!currentLine?.serverItemId) return null;
      const response = await storefrontCartApi.remove(currentLine.serverItemId);
      return readMutationResponse(response);
    }

    if (command.kind === 'update') {
      const response = currentLine?.serverItemId
        ? await storefrontCartApi.update(currentLine.serverItemId, command.desiredQuantity)
        : await storefrontCartApi.add({ productId, variantId, quantity: command.desiredQuantity });
      return readMutationResponse(response);
    }

    const delta = currentLine ? command.desiredQuantity - currentLine.quantity : command.desiredQuantity;
    if (delta <= 0) return null;
    const response = await storefrontCartApi.add({ productId, variantId, quantity: delta });
    return readMutationResponse(response);
  }, []);

  const processCommandQueue = useCallback(async () => {
    if (commandProcessingRef.current) return;
    commandProcessingRef.current = true;
    try {
      while (commandQueueRef.current.length > 0 && !failedCommandRef.current) {
        const command = commandQueueRef.current[0];
        if (!serverInitPromiseRef.current) return;
        beginSync();
        try {
          await serverInitPromiseRef.current;
          if (!serverReadyRef.current) {
            throw new StorefrontClientError('The server cart is not ready. Your local draft is safe.', {
              code: 'network-error',
              retryable: true,
            });
          }
          const authoritativeItems = await executeCartCommand(command);
          applyServerItems(
            authoritativeItems
              ? authoritativeItems.map(cartItemFromServerLine)
              : serverCartRef.current,
            serverOwnerRef.current ?? 'guest',
            command.revision,
          );
          commandQueueRef.current.shift();
        } catch (error) {
          if (isStorefrontClientError(error) && error.status === 404 && command.kind === 'remove') {
            try {
              const current = mapCartResponse(await storefrontCartApi.get());
              applyServerItems(current.items.map(cartItemFromServerLine), current.owner, command.revision);
              commandQueueRef.current.shift();
              continue;
            } catch (refreshError) {
              error = refreshError;
            }
          }
          failedCommandRef.current = command;
          const message = errorText(error, 'The cart could not be synced. Your local draft is safe.');
          setServerError(message);
          setSyncStatus(isStorefrontAuthenticationError(error) ? 'local-only' : 'error');
          setError(message);
          if (isStorefrontAuthenticationError(error)) {
            serverReadyRef.current = false;
            serverOwnerRef.current = null;
            setServerOwner(null);
          }
          break;
        } finally {
          endSync();
        }
      }
    } finally {
      commandProcessingRef.current = false;
    }
  }, [applyServerItems, beginSync, endSync, executeCartCommand]);

  const enqueueCartCommand = useCallback((command: CartCommand) => {
    if (command.kind !== 'clear' && command.kind !== 'import' && command.kind !== 'reconcile') {
      const productId = toServerId(command.productId);
      const variantId = toServerId(command.variantId);
      if (productId === null || variantId === null) {
        const message = command.kind === 'remove'
          ? 'This local line has no concrete server variant and was removed only from the local draft.'
          : 'This product has no concrete server variant yet. Choose product options before adding it to the server cart.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
        return;
      }
    }
    commandQueueRef.current.push(command);
    if (failedCommandRef.current) {
      setSyncStatus('error');
      return;
    }
    setServerError(null);
    setSyncStatus('syncing');
    void processCommandQueue();
  }, [processCommandQueue]);

  const addToCart = useCallback(
    (input: CartItemInput): CartMutationResult => {
      const normalized = normalizeInput(input, DEFAULT_CART_MAX_QUANTITY);
      if (!normalized) {
        setError(invalidCartError);
        return { ok: false, changed: false, reason: 'invalid', message: invalidCartError };
      }

      const current = itemsRef.current;
      const key = lineKey(normalized.item.productId, normalized.item.variantId);
      const index = current.findIndex(
        (item) => lineKey(item.productId, item.variantId) === key,
      );
      const next = [...current];
      let finalQuantity = normalized.requestedQuantity;
      let changed = true;

      if (index === -1) {
        next.push(normalized.item);
      } else {
        const existing = current[index];
        finalQuantity = Math.min(existing.quantity + normalized.requestedQuantity, DEFAULT_CART_MAX_QUANTITY);
        changed = existing.quantity !== finalQuantity || existing.name !== normalized.item.name || existing.price !== normalized.item.price || existing.imageUrl !== normalized.item.imageUrl;
        next[index] = makeCartItem(
          normalized.item.productId,
          normalized.item.variantId,
          normalized.item.name,
          normalized.item.price,
          finalQuantity,
          normalized.item.imageUrl,
          existing.serverItemId,
          existing.available,
        );
      }

      const revision = localRevisionRef.current + 1;
      if (changed) {
        localRevisionRef.current = revision;
        prepareLocalMutation();
        commit(next);
        enqueueCartCommand({
          kind: 'add',
          productId: normalized.item.productId,
          variantId: normalized.item.variantId,
          desiredQuantity: finalQuantity,
          revision,
          key,
        });
      }
      const capped = normalized.quantityWasCapped || finalQuantity < normalized.requestedQuantity + (index === -1 ? 0 : current[index].quantity);
      if (capped) {
        setError(maxQuantityMessage);
      }

      return {
        ok: !capped,
        changed,
        message: capped ? maxQuantityMessage : undefined,
        reason: capped ? 'limit' : undefined,
      };
    },
    [commit, enqueueCartCommand, invalidCartError, maxQuantityMessage, prepareLocalMutation],
  );

  const removeFromCart = useCallback(
    (selector: CartItemSelector, explicitVariantId?: VariantId): CartMutationResult => {
      const index = findSelectedIndex(itemsRef.current, selector, explicitVariantId);
      if (index === -1) {
        const normalized = normalizeSelector(selector, explicitVariantId);
        if (normalized) {
          const candidates = itemsRef.current.filter((item) => item.productId === normalized.productId);
          if (!normalized.exactVariant && candidates.length > 1 && !candidates.some((item) => item.variantId === null)) {
            const message = 'Choose a specific product variant before removing it.';
            setError(message);
            return { ok: false, changed: false, reason: 'ambiguous', message };
          }
        }
        return { ok: true, changed: false, reason: 'not-found' };
      }

      const selected = itemsRef.current[index];
      const next = itemsRef.current.filter((_, itemIndex) => itemIndex !== index);
      const revision = localRevisionRef.current + 1;
      localRevisionRef.current = revision;
      prepareLocalMutation();
      commit(next);
      enqueueCartCommand({
        kind: 'remove',
        productId: selected.productId,
        variantId: selected.variantId,
        revision,
        key: lineKey(selected.productId, selected.variantId),
      });
      return { ok: true, changed: true };
    },
    [commit, enqueueCartCommand, invalidCartError, maxQuantityMessage, prepareLocalMutation],
  );

  const updateQty = useCallback(
    (selector: CartItemSelector, quantity: number, explicitVariantId?: VariantId): CartMutationResult => {
      if (quantity === 0) {
        return removeFromCart(selector, explicitVariantId);
      }

      const parsed = parseQuantity(quantity, DEFAULT_CART_MAX_QUANTITY);
      if (!parsed) {
        setError(invalidCartError);
        return { ok: false, changed: false, reason: 'invalid', message: invalidCartError };
      }

      const index = findSelectedIndex(itemsRef.current, selector, explicitVariantId);
      if (index === -1) {
        const normalized = normalizeSelector(selector, explicitVariantId);
        if (normalized) {
          const candidates = itemsRef.current.filter((item) => item.productId === normalized.productId);
          if (!normalized.exactVariant && candidates.length > 1 && !candidates.some((item) => item.variantId === null)) {
            const message = 'Choose a specific product variant before updating it.';
            setError(message);
            return { ok: false, changed: false, reason: 'ambiguous', message };
          }
        }
        return { ok: true, changed: false, reason: 'not-found' };
      }

      const current = itemsRef.current[index];
      if (current.quantity === parsed.value) {
        if (parsed.wasCapped) setError(maxQuantityMessage);
        return { ok: true, changed: false, reason: parsed.wasCapped ? 'limit' : 'not-found' };
      }

      const next = [...itemsRef.current];
      next[index] = makeCartItem(
        current.productId,
        current.variantId,
        current.name,
        current.price,
        parsed.value,
        current.imageUrl,
        current.serverItemId,
        current.available,
      );
      const revision = localRevisionRef.current + 1;
      localRevisionRef.current = revision;
      prepareLocalMutation();
      commit(next);
      enqueueCartCommand({
        kind: 'update',
        productId: current.productId,
        variantId: current.variantId,
        desiredQuantity: parsed.value,
        revision,
        key: lineKey(current.productId, current.variantId),
      });
      if (parsed.wasCapped) {
        setError(maxQuantityMessage);
      }
      return {
        ok: true,
        changed: true,
        reason: parsed.wasCapped ? 'limit' : undefined,
        message: parsed.wasCapped ? maxQuantityMessage : undefined,
      };
    },
    [commit, enqueueCartCommand, invalidCartError, maxQuantityMessage, prepareLocalMutation, removeFromCart],
  );

  const clearCart = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    const revision = localRevisionRef.current + 1;
    localRevisionRef.current = revision;
    prepareLocalMutation();
    commit([]);
    enqueueCartCommand({ kind: 'clear', revision });
  }, [commit, enqueueCartCommand, prepareLocalMutation]);

  const replaceCart = useCallback(
    (items: readonly CartItemInput[]): CartMutationResult => {
      const normalizedItems: CartItem[] = [];
      for (const item of items) {
        const normalized = normalizeInput(item, DEFAULT_CART_MAX_QUANTITY);
        if (!normalized) {
          setError(invalidCartError);
          return { ok: false, changed: false, reason: 'invalid', message: invalidCartError };
        }
        normalizedItems.push(normalized.item);
      }
      const normalizedList = normalizeStoredList(normalizedItems, DEFAULT_CART_MAX_QUANTITY);
      localRevisionRef.current += 1;
      prepareLocalMutation();
      commit(normalizedList.items);
      return { ok: true, changed: true };
    },
    [commit, invalidCartError, prepareLocalMutation],
  );

  const runServerSync = useCallback(async () => {
    if (typeof window === 'undefined' || serverSyncInFlightRef.current || commandProcessingRef.current) return;
    serverSyncInFlightRef.current = true;
    const controller = new AbortController();
    serverRefreshAbortRef.current = controller;
    beginSync();
    setSyncStatus('syncing');
    setServerError(null);

    try {
      let snapshot: StorefrontCartSnapshot = mapCartResponse(await storefrontCartApi.get(controller.signal));
      if (snapshot.owner === 'customer' && snapshot.mergeAvailable) {
        snapshot = mapCartResponse(await storefrontCartApi.merge(controller.signal));
      }

      const serverItems = snapshot.items.map(cartItemFromServerLine);
      serverCartRef.current = serverItems;
      serverOwnerRef.current = snapshot.owner;
      serverReadyRef.current = true;
      setServerOwner(snapshot.owner);

      const localItems = [...itemsRef.current];
      const marker = readMigrationMarker();
      migrationMarkerRef.current = marker;
      const fingerprint = localCartFingerprint(localItems);

      if (localItems.length === 0 || (marker?.state === 'complete' && marker.fingerprint === fingerprint && serverItems.length > 0)) {
        applyServerItems(serverItems, snapshot.owner, localRevisionRef.current);
        return;
      }

      if (marker?.state === 'complete' && serverItems.length > 0) {
        applyServerItems(serverItems, snapshot.owner, localRevisionRef.current, true);
        const hasUnavailableVariant = localItems.some(
          (item) => toServerId(item.productId) === null || toServerId(item.variantId) === null,
        );
        const message = hasUnavailableVariant
          ? 'A local cart item has no concrete server variant yet. Choose product options before syncing it.'
          : 'This browser has local cart changes that are not on the server yet. Review the cart before retrying.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
        return;
      }

      const hasUnavailableVariant = localItems.some(
        (item) => toServerId(item.productId) === null || toServerId(item.variantId) === null,
      );
      if (hasUnavailableVariant) {
        applyServerItems(serverItems, snapshot.owner, localRevisionRef.current, true);
        const message = 'A local cart item has no concrete server variant yet. Choose product options before syncing it.';
        setServerError(message);
        setSyncStatus('error');
        setError(message);
        return;
      }

      const baseline = marker?.baseline ?? cartLineSnapshot(serverItems);
      const importCommand: CartCommand = {
        kind: 'import',
        lines: localItems.map((item) => ({
          productId: toServerId(item.productId)!,
          variantId: toServerId(item.variantId)!,
          quantity: item.quantity,
        })),
        localItems,
        fingerprint,
        baseline,
        revision: localRevisionRef.current,
      };
      const claimedMarker: CartMigrationMarker = {
        version: 1,
        state: 'claimed',
        fingerprint,
        owner: snapshot.owner,
        baseline,
      };
      if (!marker || marker.fingerprint !== fingerprint) {
        if (!writeMigrationMarker(claimedMarker)) {
          const message = 'The local cart is ready, but this browser could not save its migration marker. Import was not attempted.';
          setServerError(message);
          setSyncStatus('error');
          setError(message);
          return;
        }
        migrationMarkerRef.current = claimedMarker;
      }

      try {
        const authoritative = await executeCartCommand(importCommand);
        applyServerItems(
          authoritative
            ? authoritative.map(cartItemFromServerLine)
            : serverItems,
          serverOwnerRef.current ?? snapshot.owner,
          importCommand.revision,
        );
        const completeMarker: CartMigrationMarker = {
          ...claimedMarker,
          state: 'complete',
          owner: serverOwnerRef.current ?? claimedMarker.owner,
          fingerprint: localCartFingerprint(
            authoritative ? authoritative.map(cartItemFromServerLine) : serverItems,
          ),
        };
        if (!writeMigrationMarker(completeMarker)) {
          const message = 'The server cart is synced, but the browser could not record migration completion. It will be checked safely before the next import.';
          setServerError(message);
          setSyncStatus('error');
          setError(message);
        } else {
          migrationMarkerRef.current = completeMarker;
        }
      } catch (error) {
        failedCommandRef.current = importCommand;
        const message = errorText(error, 'The local cart could not be imported. Your local draft is safe; retry when ready.');
        setServerError(message);
        setSyncStatus(isStorefrontAuthenticationError(error) ? 'local-only' : 'error');
        setError(message);
        if (isStorefrontAuthenticationError(error)) {
          serverReadyRef.current = false;
          serverOwnerRef.current = null;
          setServerOwner(null);
        }
      }
    } catch (error) {
      const message = errorText(error, 'The server cart could not be loaded. Your local draft is safe; retry when ready.');
      setServerError(message);
      setSyncStatus(isStorefrontAuthenticationError(error) ? 'local-only' : 'error');
      setError(message);
      serverReadyRef.current = false;
      serverOwnerRef.current = null;
      setServerOwner(null);
      if (isStorefrontAuthenticationError(error)) {
        serverReadyRef.current = false;
        serverOwnerRef.current = null;
        setServerOwner(null);
      }
    } finally {
      if (serverRefreshAbortRef.current === controller) serverRefreshAbortRef.current = null;
      serverSyncInFlightRef.current = false;
      endSync();
      if (serverReadyRef.current) void processCommandQueue();
    }
  }, [applyServerItems, beginSync, endSync, executeCartCommand, processCommandQueue]);

  const initializeServer = useCallback(() => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (!serverInitPromiseRef.current) {
      serverInitPromiseRef.current = runServerSync().finally(() => {
        if (serverReadyRef.current) void processCommandQueue();
      });
      return serverInitPromiseRef.current;
    }
    if (!serverReadyRef.current) {
      void serverInitPromiseRef.current.then(() => {
        if (!serverReadyRef.current) void runServerSync();
      });
    }
    return serverInitPromiseRef.current;
  }, [processCommandQueue, runServerSync]);

  const refreshFromServer = useCallback(() => {
    void runServerSync();
  }, [runServerSync]);

  const retrySync = useCallback(() => {
    const failed = failedCommandRef.current;
    if (!failed) {
      if (serverReadyRef.current && localCartFingerprint(itemsRef.current) !== localCartFingerprint(serverCartRef.current)) {
        enqueueCartCommand({
          kind: 'reconcile',
          localItems: [...itemsRef.current],
          revision: localRevisionRef.current,
        });
      } else {
        refreshFromServer();
      }
      return;
    }
    if (failed.kind === 'import') {
      failedCommandRef.current = null;
      void runServerSync();
      return;
    }
    void (async () => {
      failedCommandRef.current = null;
      await runServerSync();
      if (serverReadyRef.current) {
        const failedIndex = commandQueueRef.current.indexOf(failed);
        if (failedIndex >= 0) commandQueueRef.current.splice(failedIndex, 1);
        commandQueueRef.current.unshift(failed);
        void processCommandQueue();
      } else {
        failedCommandRef.current = failed;
      }
    })();
  }, [enqueueCartCommand, processCommandQueue, refreshFromServer, runServerSync]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    void initializeServer();
    return () => {
      serverRefreshAbortRef.current?.abort();
    };
  }, [initializeServer, isHydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let focusTimer: number | undefined;
    const refresh = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (hydratedRef.current) void runServerSync();
      }, 150);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CART_STORAGE_KEY) return;
      if (serverReadyRef.current) {
        const currentSerialized = JSON.stringify(serializeCartItems(itemsRef.current));
        if (event.newValue === currentSerialized) return;
        const incoming = readCartStorage(DEFAULT_CART_MAX_QUANTITY);
        if (!incoming.readError) {
          storageProtectedRef.current = false;
          storageWarningRef.current = null;
          itemsRef.current = incoming.items;
          localRevisionRef.current += 1;
          setCart(incoming.items);
        } else {
          storageProtectedRef.current = true;
          storageWarningRef.current = cartReadError;
          setError(cartReadError);
        }
        void runServerSync();
        return;
      }
      const result = readCartStorage(DEFAULT_CART_MAX_QUANTITY);
      if (result.readError) {
        setError(cartReadError);
        return;
      }
      storageProtectedRef.current = false;
      storageWarningRef.current = null;
      itemsRef.current = result.items;
      localRevisionRef.current += 1;
      setCart(result.items);
      if (result.hadInvalidEntries || result.hadCappedEntries) {
        setError(cartInvalidDataError);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [cartInvalidDataError, cartReadError, isHydrated, runServerSync]);

  const isInCart = useCallback((selector: CartItemSelector) => {
    if (typeof selector === 'string' || typeof selector === 'number') {
      return itemsRef.current.some((item) => item.productId === selector);
    }
    return findSelectedIndex(itemsRef.current, selector) !== -1;
  }, []);
  const clearError = useCallback(() => {
    setServerError(null);
    setError(null);
  }, []);
  const setSyncPending = useCallback((pending: boolean) => {
    externalPendingRef.current = pending;
    updatePending();
  }, [updatePending]);
  const setSyncError = useCallback((message: string | null) => {
    setServerError(message);
    setError(message);
  }, []);
  const retryHydration = useCallback(() => {
    if (serverError || syncStatus === 'error') {
      retrySync();
      return;
    }
    if (storageWriteFailedRef.current) {
      persist(itemsRef.current);
      return;
    }
    hydrateFromStorage();
  }, [hydrateFromStorage, persist, retrySync, serverError, syncStatus]);

  const totalItems = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );
  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart],
  );
  const hasLocalDraft = useMemo(() => {
    if (!serverReadyRef.current || serverCartRef.current.length === 0) return cart.length > 0;
    return localCartFingerprint(cart) !== localCartFingerprint(serverCartRef.current);
  }, [cart]);
  const isServerSynced = syncStatus === 'synced' && serverOwner !== null;
  const isLocalOnly = syncStatus === 'local-only' || serverOwner === null;

  const value = useMemo<CartContextType>(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      replaceCart,
      totalItems,
      subtotal,
      maxQuantity: DEFAULT_CART_MAX_QUANTITY,
      maxCartQuantity: DEFAULT_CART_MAX_QUANTITY,
      isHydrated,
      hydrated: isHydrated,
      hydrationStatus,
      isHydrating: hydrationStatus === 'loading',
      isLoading: !isHydrated,
      loading: !isHydrated,
      isPending,
      pending: isPending,
      error,
      storageError: error,
      setSyncPending,
      setSyncError,
      storageScope,
      syncStatus,
      isServerSynced,
      isLocalOnly,
      serverOwner,
      serverError,
      hasLocalDraft,
      refreshFromServer,
      retrySync,
      retryHydration,
      clearError,
      isInCart,
    }),
    [
      addToCart,
      cart,
      clearCart,
      clearError,
      error,
      hydrationStatus,
      isHydrated,
      isInCart,
      isPending,
      removeFromCart,
      replaceCart,
      retryHydration,
      setSyncError,
      setSyncPending,
      storageScope,
      syncStatus,
      isServerSynced,
      isLocalOnly,
      serverOwner,
      serverError,
      hasLocalDraft,
      refreshFromServer,
      retrySync,
      subtotal,
      totalItems,
      updateQty,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
