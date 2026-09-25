import type { NextRequest } from 'next/server';
import type {
  CheckoutCapabilities,
  CheckoutCapabilitiesResult,
} from '@/app/shop/checkout/checkout-contract';
import { getStorefrontContext } from './context';
import { getCartCookie } from './cookies';
import { noStoreJson } from './http';
import { loadCheckoutRuntimeConfig } from './checkout-config';
import {
  assertCheckoutCapabilitiesSameOrigin,
  assertNoCheckoutQuoteInput,
  getStorefrontCheckoutCapabilities,
} from './checkout-capabilities';
import { checkoutErrorResponse } from './checkout-handler';

export function checkoutCapabilitiesSuccessResponse(capabilities: CheckoutCapabilities) {
  return noStoreJson({
    ok: true,
    capabilities,
  } satisfies CheckoutCapabilitiesResult);
}

export async function handleStorefrontCheckoutCapabilities(request: NextRequest) {
  try {
    const context = await getStorefrontContext(request);
    assertCheckoutCapabilitiesSameOrigin(request, context);
    assertNoCheckoutQuoteInput(request);
    const config = loadCheckoutRuntimeConfig(process.env, context.company.subdomain);
    const capabilities = await getStorefrontCheckoutCapabilities({
      context,
      guestCartId: getCartCookie(request),
      config,
    });

    return checkoutCapabilitiesSuccessResponse(capabilities);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
