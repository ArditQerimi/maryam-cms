import { NextRequest } from 'next/server';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { CheckoutCurrency } from '@/app/home/checkout/checkout-contract';
import * as schema from '@/db/schema-tenant';
import { getStorefrontContext } from './context';
import { getRequestAuthority, getRequestProtocol } from './host';
import {
  ORDER_CONFIRMATION_PATH,
  getOrderAccessCookie,
  hashOrderAccessToken,
} from './checkout-access';

export type StorefrontOrderConfirmation = {
  orderId: string;
  orderNumber: string;
  contactEmail: string;
  currency: CheckoutCurrency;
  status: string;
  total: string;
  createdAt: Date;
  deliveryMethodId: string;
  paymentMethodId: string;
  access: 'customer' | 'guest';
};

export function requestForOrderConfirmation(headers: Headers) {
  const protocol = getRequestProtocol(headers, 'https:');
  const authority = getRequestAuthority(headers, null, protocol);
  if (!authority) return null;
  return new NextRequest(`${protocol}//${authority}${ORDER_CONFIRMATION_PATH}`, { headers });
}

export async function getStorefrontOrderConfirmation(
  request: NextRequest,
): Promise<StorefrontOrderConfirmation | null> {
  const context = await getStorefrontContext(request);

  if (context.customer) {
    const [row] = await context.db
      .select({
        id: schema.sales.id,
        reference: schema.sales.reference,
        status: schema.sales.status,
        grandTotal: schema.sales.grandTotal,
        createdAt: schema.sales.createdAt,
        contactEmail: schema.storefrontOrderDetails.contactEmail,
        currency: schema.storefrontOrderDetails.currency,
        deliveryMethodId: schema.storefrontOrderDetails.deliveryMethodId,
        paymentMethodId: schema.storefrontOrderDetails.paymentMethodId,
      })
      .from(schema.sales)
      .innerJoin(
        schema.storefrontOrderDetails,
        eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
      )
      .where(and(
        eq(schema.sales.customerUserId, context.customer.id),
        eq(schema.sales.isOnline, true),
      ))
      .orderBy(desc(schema.sales.createdAt), desc(schema.sales.id))
      .limit(1);

    return row ? {
      orderId: String(row.id),
      orderNumber: row.reference,
      contactEmail: row.contactEmail,
      currency: row.currency,
      status: row.status,
      total: String(row.grandTotal),
      createdAt: row.createdAt,
      deliveryMethodId: row.deliveryMethodId,
      paymentMethodId: row.paymentMethodId,
      access: 'customer',
    } : null;
  }

  const token = getOrderAccessCookie(request);
  if (!token) return null;
  const [access] = await context.db
    .select({ saleId: schema.storefrontOrderAccess.saleId })
    .from(schema.storefrontOrderAccess)
    .where(and(
      eq(schema.storefrontOrderAccess.tokenHash, hashOrderAccessToken(token)),
      isNull(schema.storefrontOrderAccess.revokedAt),
      gt(schema.storefrontOrderAccess.expiresAt, new Date()),
    ))
    .limit(1);
  if (!access) return null;

  const [row] = await context.db
    .select({
      id: schema.sales.id,
      reference: schema.sales.reference,
      status: schema.sales.status,
      grandTotal: schema.sales.grandTotal,
      createdAt: schema.sales.createdAt,
      contactEmail: schema.storefrontOrderDetails.contactEmail,
      currency: schema.storefrontOrderDetails.currency,
      deliveryMethodId: schema.storefrontOrderDetails.deliveryMethodId,
      paymentMethodId: schema.storefrontOrderDetails.paymentMethodId,
    })
    .from(schema.sales)
    .innerJoin(
      schema.storefrontOrderDetails,
      eq(schema.storefrontOrderDetails.saleId, schema.sales.id),
    )
    .where(and(
      eq(schema.sales.id, access.saleId),
      eq(schema.sales.isOnline, true),
    ))
    .limit(1);

  return row ? {
    orderId: String(row.id),
    orderNumber: row.reference,
    contactEmail: row.contactEmail,
    currency: row.currency,
    status: row.status,
    total: String(row.grandTotal),
    createdAt: row.createdAt,
    deliveryMethodId: row.deliveryMethodId,
    paymentMethodId: row.paymentMethodId,
    access: 'guest',
  } : null;
}
