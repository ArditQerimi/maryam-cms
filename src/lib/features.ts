import { getContextDb } from './tenant';
import * as schema from '@/db/schema-tenant';
import { and, eq } from 'drizzle-orm';

export async function isFeatureEnabled(group: string, key: string) {
  const db = await getContextDb();
  
  const config = await db.query.featureConfigurations.findFirst({
    where: and(
      eq(schema.featureConfigurations.featureGroup, group),
      eq(schema.featureConfigurations.featureKey, key)
    )
  });

  // Default to true if not configured, or use your own logic
  return config ? config.enabled : true;
}

export async function toggleTenantFeature(group: string, key: string, enabled: boolean) {
  const db = await getContextDb();
  
  await db.update(schema.featureConfigurations)
    .set({ enabled })
    .where(and(
      eq(schema.featureConfigurations.featureGroup, group),
      eq(schema.featureConfigurations.featureKey, key)
    ));
}
