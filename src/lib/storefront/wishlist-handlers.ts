import type { NextRequest } from 'next/server';
import { getStorefrontContext, assertMutationOrigin } from './context';
import {
  addWishlistProduct,
  clearWishlist,
  getWishlist,
  importWishlist,
  removeWishlistProduct,
  type WishlistMutationResult,
} from './wishlist';
import {
  isRecord,
  parseRequestAction,
  parseWishlistAddInput,
  parseWishlistImportInput,
  parseWishlistRemoveInput,
} from './validation';
import { StorefrontInputError } from './errors';
import { noStoreJson, readJsonBody, runStorefrontRoute } from './http';

function responseBody(result: WishlistMutationResult | { items: Awaited<ReturnType<typeof getWishlist>>['items']; count: number }) {
  const wishlist = 'wishlist' in result ? result.wishlist : result;
  return {
    wishlist,
    items: wishlist.items,
    count: wishlist.count,
    ...('imported' in result && result.imported ? { imported: true } : {}),
  };
}

function wishlistResponse(result: WishlistMutationResult, status = 200) {
  return noStoreJson(responseBody(result), status);
}

async function wishlistMutationContext(request: NextRequest) {
  const context = await getStorefrontContext(request, { allowGuest: false });
  assertMutationOrigin(request, context);
  return context;
}

export async function handleWishlistGet(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await getStorefrontContext(request, { allowGuest: false });
    return noStoreJson(responseBody(await getWishlist(context)));
  });
}

export async function handleWishlistPost(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await wishlistMutationContext(request);
    const body = await readJsonBody(request);
    const action = parseRequestAction(body);

    if (action === 'clear') {
      return wishlistResponse(await clearWishlist(context));
    }
    if (action === 'import') {
      return wishlistResponse(await importWishlist(context, parseWishlistImportInput(body)));
    }
    if (action === 'remove') {
      return wishlistResponse(await removeWishlistProduct(context, parseWishlistRemoveInput(body)));
    }
    if (action !== 'add') {
      throw new StorefrontInputError('Unsupported wishlist action.', 'action');
    }
    return wishlistResponse(await addWishlistProduct(context, parseWishlistAddInput(body)), 201);
  });
}

export async function handleWishlistImport(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await wishlistMutationContext(request);
    const body = await readJsonBody(request);
    return wishlistResponse(await importWishlist(context, parseWishlistImportInput(body)));
  });
}

export async function handleWishlistRemove(
  request: NextRequest,
  forcedProductId?: string,
) {
  return runStorefrontRoute(async () => {
    const context = await wishlistMutationContext(request);
    const body = await readJsonBody(request);
    const input = parseWishlistRemoveInput(
      forcedProductId && isRecord(body) ? { ...body, productId: forcedProductId } : body,
    );
    return wishlistResponse(await removeWishlistProduct(context, input));
  });
}

export async function handleWishlistClear(request: NextRequest) {
  return runStorefrontRoute(async () => {
    const context = await wishlistMutationContext(request);
    return wishlistResponse(await clearWishlist(context));
  });
}
