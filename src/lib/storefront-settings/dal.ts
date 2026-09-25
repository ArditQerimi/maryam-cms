import 'server-only';

import { eq } from 'drizzle-orm';
import * as tenantSchema from '@/db/schema-tenant';
import { STOREFRONT_SETTINGS_KEY } from './contracts';
import {
  isMissingSettingsSchemaError,
  StorefrontSettingsError,
  StorefrontSettingsValidationError,
} from './errors';
import {
  requireEcommerceStorefrontSettingsManageAccess,
  requireEcommerceStorefrontSettingsViewAccess,
} from './authorization';
import {
  decodeStoredEcommerceStorefrontConfig,
  encodeEcommerceStorefrontConfig,
  expectedUpdatedAtMatches,
  parseEcommerceStorefrontSettingsForm,
} from './validation';
import {
  readOwnedEcommerceStorefrontSettings,
} from './reader';
import { getEcommerceStorefrontOperationalStatus } from './operational';
import type {
  EcommerceStorefrontConfig,
  StorefrontSettingsPageState,
} from './contracts';

export async function getEcommerceStorefrontSettingsPageState(): Promise<StorefrontSettingsPageState> {
  const access = await requireEcommerceStorefrontSettingsViewAccess();
  const readState = await readOwnedEcommerceStorefrontSettings(access.db);
  return {
    readState,
    canManage: access.canManage,
    operational: getEcommerceStorefrontOperationalStatus(access.company),
  };
}

function rowTimestamp(value: unknown) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new StorefrontSettingsError('invalid-stored-config', 'The tenant settings timestamp is invalid.');
  }
  return value.toISOString();
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}

export type SaveEcommerceStorefrontSettingsResult = {
  config: EcommerceStorefrontConfig;
  updatedAt: string;
};

export async function saveEcommerceStorefrontSettings(
  formData: FormData,
): Promise<SaveEcommerceStorefrontSettingsResult> {
  // Authorization is intentionally performed inside the server-only DAL, not
  // only by the page that renders the form.
  const access = await requireEcommerceStorefrontSettingsManageAccess();
  const parsed = parseEcommerceStorefrontSettingsForm(formData);
  const serialized = encodeEcommerceStorefrontConfig(parsed.config);

  try {
    return await access.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          value: tenantSchema.settingsStore.value,
          updatedAt: tenantSchema.settingsStore.updatedAt,
        })
        .from(tenantSchema.settingsStore)
        .where(eq(tenantSchema.settingsStore.key, STOREFRONT_SETTINGS_KEY))
        .limit(2)
        .for('update');

      if (rows.length > 1) {
        throw new StorefrontSettingsError(
          'invalid-stored-config',
          'The saved storefront settings contain duplicate rows and were not overwritten.',
        );
      }

      const existing = rows[0];
      if (!existing) {
        if (parsed.expectedUpdatedAt !== 'none') {
          throw new StorefrontSettingsError(
            'stale-write',
            'These storefront settings changed before they could be saved. Refresh and try again.',
          );
        }

        const now = new Date();
        const inserted = await tx
          .insert(tenantSchema.settingsStore)
          .values({
            key: STOREFRONT_SETTINGS_KEY,
            value: serialized,
            updatedAt: now,
          })
          .returning({
            updatedAt: tenantSchema.settingsStore.updatedAt,
          });

        if (inserted.length !== 1) {
          throw new StorefrontSettingsError(
            'stale-write',
            'These storefront settings changed before they could be saved. Refresh and try again.',
          );
        }
        return { config: parsed.config, updatedAt: rowTimestamp(inserted[0].updatedAt) };
      }

      const currentUpdatedAt = rowTimestamp(existing.updatedAt);
      if (!expectedUpdatedAtMatches(parsed.expectedUpdatedAt, currentUpdatedAt)) {
        throw new StorefrontSettingsError(
          'stale-write',
          'These storefront settings changed before they could be saved. Refresh and try again.',
        );
      }

      // Never overwrite a malformed or future-version row with a guessed value.
      try {
        decodeStoredEcommerceStorefrontConfig(existing.value);
      } catch (error) {
        if (error instanceof StorefrontSettingsValidationError) {
          throw new StorefrontSettingsError(
            'invalid-stored-config',
            'The saved storefront settings are invalid. They were not overwritten.',
          );
        }
        throw error;
      }

      const now = new Date(Math.max(Date.now(), new Date(currentUpdatedAt).getTime() + 1));
      const updated = await tx
        .update(tenantSchema.settingsStore)
        .set({ value: serialized, updatedAt: now })
        .where(eq(tenantSchema.settingsStore.key, STOREFRONT_SETTINGS_KEY))
        .returning({
          updatedAt: tenantSchema.settingsStore.updatedAt,
        });

      if (updated.length !== 1) {
        throw new StorefrontSettingsError(
          'stale-write',
          'These storefront settings changed before they could be saved. Refresh and try again.',
        );
      }

      return { config: parsed.config, updatedAt: rowTimestamp(updated[0].updatedAt) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new StorefrontSettingsError(
        'stale-write',
        'These storefront settings changed before they could be saved. Refresh and try again.',
      );
    }
    if (isMissingSettingsSchemaError(error)) {
      throw new StorefrontSettingsError(
        'schema-unavailable',
        'The tenant settings store is not available. No settings were changed.',
      );
    }
    throw error;
  }
}
