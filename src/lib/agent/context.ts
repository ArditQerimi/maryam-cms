import { getTenantDb } from '@/db/index';
import { getContextCompany } from '@/lib/tenant';
import { getSiteOrigin } from '@/lib/site-origin';
import type { StorefrontContext } from '@/lib/storefront/context';

/**
 * Storefront context for the agent: the shop whose host received the request (the same tenant
 * resolution as the CMS and the Telegram order bot), never a customer — the agent shops as a guest.
 */
export async function getAgentContext(): Promise<{ context: StorefrontContext; shopName: string }> {
  const company = await getContextCompany();
  const origin = new URL(await getSiteOrigin());
  return {
    shopName: company.name?.trim() || company.subdomain,
    context: {
      company: {
        id: company.id,
        subdomain: company.subdomain,
        dbConnectionString: company.dbConnectionString,
        dbSchema: company.dbSchema,
        status: company.status,
      },
      db: getTenantDb(company.dbConnectionString, company.dbSchema),
      customer: null,
      session: null,
      requestHost: origin.hostname,
      requestAuthority: origin.host,
      requestProtocol: origin.protocol as StorefrontContext['requestProtocol'],
      requestOrigin: origin.origin,
    },
  };
}
