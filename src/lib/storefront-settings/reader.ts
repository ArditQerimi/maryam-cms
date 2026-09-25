import 'server-only';

import { eq } from 'drizzle-orm';
import { getTenantDb } from '@/db/index';
import * as tenantSchema from '@/db/schema-tenant';
import { getContextCompany } from '@/lib/tenant';
import {
  STOREFRONT_SETTINGS_KEY,
  type PublicStorefrontPresentation,
  type StorefrontSettingsReadState,
} from './contracts';
import {
  isMissingSettingsSchemaError,
} from './errors';
import { interpretOwnedSettingsRows } from './state';

export type TenantSettingsDatabase = ReturnType<typeof getTenantDb>;

export async function readOwnedEcommerceStorefrontSettings(
  db: TenantSettingsDatabase,
): Promise<StorefrontSettingsReadState> {
  let rows: Array<{ value: string; updatedAt: Date }>;
  try {
    rows = await db
      .select({
        value: tenantSchema.settingsStore.value,
        updatedAt: tenantSchema.settingsStore.updatedAt,
      })
      .from(tenantSchema.settingsStore)
      .where(eq(tenantSchema.settingsStore.key, STOREFRONT_SETTINGS_KEY))
      .limit(2);
  } catch (error) {
    if (isMissingSettingsSchemaError(error)) {
      return {
        status: 'unavailable',
        code: 'schema-unavailable',
        message: 'The tenant settings store is not available. No settings were changed.',
        config: null,
        updatedAt: null,
      };
    }
    return {
      status: 'unavailable',
      code: 'read-unavailable',
      message: 'The tenant settings store could not be read. No settings were changed.',
      config: null,
      updatedAt: null,
    };
  }

  try {
    return interpretOwnedSettingsRows(rows);
  } catch {
    return {
      status: 'unavailable',
      code: 'read-unavailable',
      message: 'The tenant settings store returned an invalid read result. No settings were changed.',
      config: null,
      updatedAt: null,
    };
  }
}

export async function getPublicEcommerceStorefrontPresentation(): Promise<PublicStorefrontPresentation> {
  let company: Awaited<ReturnType<typeof getContextCompany>>;
  try {
    company = await getContextCompany();
    if (!company || company.status !== 'Active') throw new Error('inactive company');
  } catch {
    return {
      status: 'unavailable',
      code: 'host-unavailable',
      config: null,
      updatedAt: null,
    };
  }

  try {
    const db = getTenantDb(company.dbConnectionString, company.dbSchema);
    const result = await readOwnedEcommerceStorefrontSettings(db);
    if (result.status === 'ready') {
      return {
        status: 'ready',
        config: result.config,
        updatedAt: result.updatedAt,
      };
    }
    return {
      status: result.status,
      code: result.status === 'unavailable' ? result.code : result.status === 'invalid' ? result.code : undefined,
      config: null,
      updatedAt: result.status === 'uninitialized' ? null : result.updatedAt,
    };
  } catch {
    return {
      status: 'unavailable',
      code: 'read-unavailable',
      config: null,
      updatedAt: null,
    };
  }
}

