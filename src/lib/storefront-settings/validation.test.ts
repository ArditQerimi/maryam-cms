import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeStoredEcommerceStorefrontConfig,
  encodeEcommerceStorefrontConfig,
  expectedUpdatedAtMatches,
  isSafeStorefrontHttpUrl,
  parseEcommerceStorefrontSettingsForm,
  parseExpectedUpdatedAt,
} from './validation';
import {
  isMissingSettingsSchemaError,
  StorefrontSettingsValidationError,
} from './errors';
import { interpretOwnedSettingsRows } from './state';
import { STOREFRONT_SETTINGS_KEY } from './contracts';

const validConfig = {
  version: 1 as const,
  metadata: {
    title: 'A calm bookshop',
    description: 'Books for thoughtful homes.',
  },
  footer: {
    supportingText: 'Read slowly. Choose well.',
    showPoweredBy: true,
  },
};

function settingsForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set('metadataTitle', validConfig.metadata.title);
  formData.set('metadataDescription', validConfig.metadata.description);
  formData.set('footerSupportingText', validConfig.footer.supportingText);
  formData.set('footerShowPoweredBy', String(validConfig.footer.showPoweredBy));
  formData.set('expectedUpdatedAt', 'none');
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

test('the owned key and V1 payload are strict and serializable', () => {
  assert.equal(STOREFRONT_SETTINGS_KEY, 'settings_ecommerce_storefront');
  assert.deepEqual(decodeStoredEcommerceStorefrontConfig(encodeEcommerceStorefrontConfig(validConfig)), validConfig);
});

test('no-row is represented by the explicit none concurrency token', () => {
  assert.equal(parseExpectedUpdatedAt('none'), 'none');
  assert.equal(expectedUpdatedAtMatches('none', null), true);
  assert.equal(expectedUpdatedAtMatches('none', '2026-01-01T00:00:00.000Z'), false);
  assert.equal(expectedUpdatedAtMatches('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'), true);
  assert.equal(expectedUpdatedAtMatches('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.001Z'), false);
});

test('read-state classification is explicit for no-row and corrupt-version rows', () => {
  assert.deepEqual(interpretOwnedSettingsRows([]), {
    status: 'uninitialized',
    config: null,
    updatedAt: null,
    message: 'No storefront presentation settings have been saved for this tenant.',
  });

  const corruptVersion = interpretOwnedSettingsRows([{
    value: JSON.stringify({ ...validConfig, version: 99 }),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }]);
  assert.equal(corruptVersion.status, 'invalid');
  if (corruptVersion.status === 'invalid') assert.equal(corruptVersion.code, 'unsupported-version');
});

test('missing settings schema is classified as a read/write stop without DDL', () => {
  assert.equal(isMissingSettingsSchemaError({ code: '42P01' }), true);
  assert.equal(isMissingSettingsSchemaError({ cause: { code: '42703' } }), true);
  assert.equal(isMissingSettingsSchemaError({ code: '23505' }), false);
});

test('malformed JSON and unknown versions fail closed', () => {
  assert.throws(
    () => decodeStoredEcommerceStorefrontConfig('{not-json'),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'invalid-json',
  );
  assert.throws(
    () => decodeStoredEcommerceStorefrontConfig(JSON.stringify({ ...validConfig, version: 2 })),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'unsupported-version',
  );
  assert.throws(
    () => decodeStoredEcommerceStorefrontConfig(JSON.stringify({ ...validConfig, tenantId: 99 })),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'invalid-config',
  );
});

test('FormData rejects unknown fields, duplicates, control characters, and invalid booleans', () => {
  const unknown = settingsForm({ companyId: '99' });
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(unknown),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'unknown-field',
  );

  const duplicate = settingsForm();
  duplicate.append('metadataTitle', 'second title');
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(duplicate),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'duplicate-field',
  );

  const control = settingsForm({ metadataTitle: 'Title\u0000with-control' });
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(control),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'control-character',
  );

  const invalidBoolean = settingsForm({ footerShowPoweredBy: 'on' });
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(invalidBoolean),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'invalid-boolean',
  );
});

test('FormData and persisted text are bounded, and URL validation rejects active schemes', () => {
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(settingsForm({ metadataTitle: 'x'.repeat(121) })),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'too-long',
  );
  assert.throws(
    () => parseEcommerceStorefrontSettingsForm(settingsForm({ metadataDescription: 'x'.repeat(25_000) })),
    (error: unknown) => error instanceof StorefrontSettingsValidationError && error.detailCode === 'too-long',
  );
  assert.equal(isSafeStorefrontHttpUrl('https://example.com/path'), true);
  assert.equal(isSafeStorefrontHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeStorefrontHttpUrl('https://user:password@example.com'), false);
});
