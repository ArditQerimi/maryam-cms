import type { NextRequest } from 'next/server';
import { getCartCookie, clearCartCookie, setCartCookie } from './cookies';
import { getStorefrontContext, assertMutationOrigin, type StorefrontContext } from './context';
import {
  addCartItem,
  clearCart,
  getCartSnapshot,
  importCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
  type CartMutationResult,
  type CartSnapshot,
} from './cart';
import {
  isRecord,
  parseCartAddInput,
  parseCartImportInput,
  parseCartRemoveInput,
  parseCartUpdateInput,
  parseRequestAction,
} from './validation';
import { noStoreJson, readJsonBody, runStorefrontRoute } from './http';

function responseBody(snapshot: CartSnapshot, result?: CartMutationResult) {
  return {
    cart: snapshot,
    items: snapshot.items,
    owner: snapshot.owner,
    itemCount: snapshot.itemCount,
    totalQuantity: snapshot.totalQuantity,
    subtotal: snapshot.subtotal,
    ...(snapshot.mergeAvailable ? { mergeAvailable: true } : {}),
    ...(result?.merged ? { merged: true } : {}),
    ...(result?.imported ? { imported: true } : {}),
  };
}

function cartResponse(
  context: StorefrontContext,
  result: CartMutationResult,
  status = 200,
) {
  const response = noStoreJson(responseBody(result.cart, result), status);
  if (result.cookieAction?.type === 'set') {
    setCartCookie(response, result.cookieAction.cartId, context.requestProtocol === 'https:');
  } else if (result.cookieAction?.type === 'clear') {
    clearCartCookie(response, context.requestProtocol === 'https:');
  }
  return response;
}

async function mutationContext(request: NextRequest) {
  const context = await getStorefrontContext(request);
  assertMutationOrigin(request, context);
  return { context, guestCartId: getCartCookie(request) };
}

export async function handleCartGet(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await getStorefrontContext(request);
    const snapshot = await getCartSnapshot(context, getCartCookie(request));
    return noStoreJson(responseBody(snapshot));
  });
}

export async function handleCartPost(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    const body = await readJsonBody(request);
    const action = parseRequestAction(body);

    if (action === 'clear') {
      return cartResponse(context, await clearCart(context, guestCartId));
    }
    if (action === 'import') {
      return cartResponse(context, await importCart(context, guestCartId, parseCartImportInput(body)));
    }
    if (action === 'merge') {
      return cartResponse(context, await mergeGuestCart(context, guestCartId));
    }
    if (action === 'update') {
      return cartResponse(context, await updateCartItem(context, guestCartId, parseCartUpdateInput(body)));
    }
    if (action === 'remove') {
      return cartResponse(context, await removeCartItem(context, guestCartId, parseCartRemoveInput(body)));
    }
    const result = await addCartItem(context, guestCartId, parseCartAddInput(body));
    return cartResponse(context, result, result.created ? 201 : 200);
  });
}

export async function handleCartUpdate(
  request: NextRequest,
  forcedItemId?: string,
) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    const body = await readJsonBody(request);
    const input = parseCartUpdateInput(
      forcedItemId && isRecord(body) ? { ...body, itemId: forcedItemId } : body,
    );
    return cartResponse(context, await updateCartItem(context, guestCartId, input));
  });
}

export async function handleCartRemove(
  request: NextRequest,
  forcedItemId?: string,
) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    const body = await readJsonBody(request);
    const input = parseCartRemoveInput(
      forcedItemId && isRecord(body) ? { ...body, itemId: forcedItemId } : body,
    );
    return cartResponse(context, await removeCartItem(context, guestCartId, input));
  });
}

export async function handleCartImport(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    const body = await readJsonBody(request);
    return cartResponse(context, await importCart(context, guestCartId, parseCartImportInput(body)));
  });
}

export async function handleCartMerge(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    return cartResponse(context, await mergeGuestCart(context, guestCartId));
  });
}

export async function handleCartClear(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const { context, guestCartId } = await mutationContext(request);
    return cartResponse(context, await clearCart(context, guestCartId));
  });
}
