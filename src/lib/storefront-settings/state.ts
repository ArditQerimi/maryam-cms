import type { StorefrontSettingsReadState } from './contracts';
import { StorefrontSettingsValidationError } from './errors';
import { decodeStoredEcommerceStorefrontConfig } from './validation';

export type OwnedSettingsRowLike = {
  value: unknown;
  updatedAt: unknown;
};

function toIsoTimestamp(value: unknown) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null;
  return value.toISOString();
}

function invalidState(
  code: Extract<StorefrontSettingsReadState, { status: 'invalid' }>['code'],
  message: string,
  updatedAt: string | null,
): StorefrontSettingsReadState {
  return { status: 'invalid', code, message, config: null, updatedAt };
}

function validationState(error: unknown, updatedAt: string | null): StorefrontSettingsReadState {
  if (!(error instanceof StorefrontSettingsValidationError)) {
    return invalidState('invalid-config', 'Stored storefront presentation settings are invalid.', updatedAt);
  }

  const code = error.detailCode === 'invalid-json'
    ? 'invalid-json'
    : error.detailCode === 'unsupported-version'
      ? 'unsupported-version'
      : 'invalid-config';
  const message = code === 'invalid-json'
    ? 'Stored storefront presentation settings are not valid JSON.'
    : code === 'unsupported-version'
      ? 'Stored storefront presentation settings use an unsupported version.'
      : 'Stored storefront presentation settings are invalid.';
  return invalidState(code, message, updatedAt);
}

/** Classifies only the already-read, exact-key rows; it never supplies defaults. */
export function interpretOwnedSettingsRows(
  rows: readonly OwnedSettingsRowLike[],
): StorefrontSettingsReadState {
  if (rows.length === 0) {
    return {
      status: 'uninitialized',
      config: null,
      updatedAt: null,
      message: 'No storefront presentation settings have been saved for this tenant.',
    };
  }
  if (rows.length !== 1) {
    return invalidState(
      'duplicate-row',
      'The tenant settings store contains an invalid duplicate storefront settings row.',
      null,
    );
  }

  const row = rows[0];
  const updatedAt = toIsoTimestamp(row.updatedAt);
  if (!updatedAt) {
    return invalidState('invalid-config', 'The tenant storefront settings timestamp is invalid.', null);
  }

  try {
    const config = decodeStoredEcommerceStorefrontConfig(row.value);
    return { status: 'ready', config, updatedAt };
  } catch (error) {
    return validationState(error, updatedAt);
  }
}
