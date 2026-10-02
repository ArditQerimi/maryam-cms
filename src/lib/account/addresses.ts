import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import type { AccountPrincipal } from './data';

export type SavedAddresses = {
  billing: Record<string, string> | null;
  shipping: Record<string, string> | null;
};

/**
 * Saved addresses win; otherwise fall back to the addresses of the shopper's
 * latest online order (what checkout used last). The saved-address lookup
 * tolerates migration 009 not being applied yet.
 */
export async function getAccountAddresses(principal: AccountPrincipal): Promise<SavedAddresses> {
  const db = getTenantDb(principal.company.dbConnectionString, principal.company.dbSchema);
  const result: SavedAddresses = { billing: null, shipping: null };

  try {
    const rows = await db
      .select({
        kind: tenantSchema.customerAddresses.kind,
        address: tenantSchema.customerAddresses.address,
      })
      .from(tenantSchema.customerAddresses)
      .where(eq(tenantSchema.customerAddresses.userId, principal.userId));
    for (const row of rows) result[row.kind] = row.address;
  } catch {
    // Migration 009 not applied yet: behave as "nothing saved".
  }

  if (result.billing && result.shipping) return result;

  const [latest] = await db
    .select({
      shippingAddress: tenantSchema.storefrontOrderDetails.shippingAddress,
      billingAddress: tenantSchema.storefrontOrderDetails.billingAddress,
      contactEmail: tenantSchema.storefrontOrderDetails.contactEmail,
      contactPhone: tenantSchema.storefrontOrderDetails.contactPhone,
    })
    .from(tenantSchema.sales)
    .innerJoin(
      tenantSchema.storefrontOrderDetails,
      eq(tenantSchema.storefrontOrderDetails.saleId, tenantSchema.sales.id),
    )
    .where(and(
      eq(tenantSchema.sales.customerUserId, principal.userId),
      eq(tenantSchema.sales.isOnline, true),
    ))
    .orderBy(desc(tenantSchema.sales.createdAt))
    .limit(1);

  if (latest) {
    result.billing ??= {
      ...latest.billingAddress,
      phone: latest.contactPhone ?? '',
      email: latest.contactEmail,
    };
    result.shipping ??= latest.shippingAddress;
  }
  return result;
}

/** Render the non-empty address parts as display lines. */
export function addressLines(address: Record<string, string> | null | undefined): string[] {
  if (!address) return [];
  const part = (key: string) => (address[key] ?? '').trim();
  const name = [part('firstName'), part('lastName')].filter(Boolean).join(' ');
  const locality = [part('city'), [part('region'), part('postalCode')].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [name, part('company'), part('address1'), part('address2'), part('country'), locality]
    .filter(Boolean);
}
