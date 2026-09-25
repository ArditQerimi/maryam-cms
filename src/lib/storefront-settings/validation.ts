import {
  EcommerceStorefrontConfig,
  STOREFRONT_SETTINGS_FORM_FIELDS,
  STOREFRONT_SETTINGS_MAX_CONFIG_BYTES,
  STOREFRONT_SETTINGS_MAX_DESCRIPTION_CHARS,
  STOREFRONT_SETTINGS_MAX_FORM_BYTES,
  STOREFRONT_SETTINGS_MAX_SUPPORTING_TEXT_CHARS,
  STOREFRONT_SETTINGS_MAX_TITLE_CHARS,
  STOREFRONT_SETTINGS_VERSION,
  StorefrontSettingsField,
} from './contracts';
import { StorefrontSettingsValidationError } from './errors';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;
const BIDI_CONTROL_CHARACTERS = /[\u202A-\u202E\u2066-\u2069]/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const FIELD_LABELS: Record<StorefrontSettingsField, string> = {
  metadataTitle: 'Metadata title',
  metadataDescription: 'Metadata description',
  footerSupportingText: 'Footer supporting text',
  footerShowPoweredBy: 'Footer powered-by setting',
  expectedUpdatedAt: 'Expected update timestamp',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}

function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function byteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function textError(
  detailCode: StorefrontSettingsValidationError['detailCode'],
  field: StorefrontSettingsField,
  message: string,
) {
  return new StorefrontSettingsValidationError(detailCode, message, field);
}

export function validateBoundedUnicodeText(input: {
  value: unknown;
  field: Exclude<StorefrontSettingsField, 'footerShowPoweredBy' | 'expectedUpdatedAt'>;
  label: string;
  maxCharacters: number;
  allowEmpty: boolean;
}) {
  if (typeof input.value !== 'string') {
    throw textError('invalid-type', input.field, `${input.label} must be text.`);
  }

  if (hasUnpairedSurrogate(input.value)) {
    throw textError('control-character', input.field, `${input.label} contains invalid Unicode.`);
  }

  if (CONTROL_CHARACTERS.test(input.value) || BIDI_CONTROL_CHARACTERS.test(input.value)) {
    throw textError('control-character', input.field, `${input.label} contains control characters.`);
  }

  let normalized: string;
  try {
    normalized = input.value.normalize('NFC').trim();
  } catch {
    throw textError('invalid-type', input.field, `${input.label} must be valid Unicode.`);
  }

  if (!input.allowEmpty && normalized.length === 0) {
    throw textError('required', input.field, `${input.label} is required.`);
  }

  const characterCount = Array.from(normalized).length;
  const encodedBytes = byteLength(normalized);
  if (characterCount > input.maxCharacters || encodedBytes > input.maxCharacters * 4) {
    throw textError('too-long', input.field, `${input.label} is too long.`);
  }

  return normalized;
}

export function validateEcommerceStorefrontConfig(value: unknown): EcommerceStorefrontConfig {
  if (!isRecord(value)) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront presentation settings are invalid.',
      undefined,
      'invalid-stored-config',
    );
  }

  if (!hasExactKeys(value, ['version', 'metadata', 'footer'])) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront presentation settings contain unsupported fields.',
      undefined,
      'invalid-stored-config',
    );
  }

  if (value.version !== STOREFRONT_SETTINGS_VERSION) {
    throw new StorefrontSettingsValidationError(
      value.version === undefined ? 'invalid-config' : 'unsupported-version',
      'Stored storefront presentation settings use an unsupported version.',
      undefined,
      'invalid-stored-config',
    );
  }

  if (!isRecord(value.metadata) || !hasExactKeys(value.metadata, ['title', 'description'])) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront metadata is invalid.',
      undefined,
      'invalid-stored-config',
    );
  }

  if (!isRecord(value.footer) || !hasExactKeys(value.footer, ['supportingText', 'showPoweredBy'])) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront footer settings are invalid.',
      undefined,
      'invalid-stored-config',
    );
  }

  if (value.footer.showPoweredBy !== true && value.footer.showPoweredBy !== false) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront footer settings are invalid.',
      undefined,
      'invalid-stored-config',
    );
  }

  const title = validateBoundedUnicodeText({
    value: value.metadata.title,
    field: 'metadataTitle',
    label: FIELD_LABELS.metadataTitle,
    maxCharacters: STOREFRONT_SETTINGS_MAX_TITLE_CHARS,
    allowEmpty: false,
  });
  const description = validateBoundedUnicodeText({
    value: value.metadata.description,
    field: 'metadataDescription',
    label: FIELD_LABELS.metadataDescription,
    maxCharacters: STOREFRONT_SETTINGS_MAX_DESCRIPTION_CHARS,
    allowEmpty: true,
  });
  const supportingText = validateBoundedUnicodeText({
    value: value.footer.supportingText,
    field: 'footerSupportingText',
    label: FIELD_LABELS.footerSupportingText,
    maxCharacters: STOREFRONT_SETTINGS_MAX_SUPPORTING_TEXT_CHARS,
    allowEmpty: true,
  });

  return {
    version: STOREFRONT_SETTINGS_VERSION,
    metadata: { title, description },
    footer: { supportingText, showPoweredBy: value.footer.showPoweredBy },
  };
}

export function decodeStoredEcommerceStorefrontConfig(raw: unknown): EcommerceStorefrontConfig {
  if (typeof raw !== 'string' || byteLength(raw) > STOREFRONT_SETTINGS_MAX_CONFIG_BYTES) {
    throw new StorefrontSettingsValidationError(
      'invalid-config',
      'Stored storefront presentation settings are invalid.',
      undefined,
      'invalid-stored-config',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new StorefrontSettingsValidationError(
      'invalid-json',
      'Stored storefront presentation settings are not valid JSON.',
      undefined,
      'invalid-stored-config',
    );
  }

  return validateEcommerceStorefrontConfig(parsed);
}

export function encodeEcommerceStorefrontConfig(config: EcommerceStorefrontConfig) {
  const normalized = validateEcommerceStorefrontConfig(config);
  const encoded = JSON.stringify(normalized);
  if (byteLength(encoded) > STOREFRONT_SETTINGS_MAX_CONFIG_BYTES) {
    throw new StorefrontSettingsValidationError(
      'too-long',
      'Storefront presentation settings are too large.',
    );
  }
  return encoded;
}

function readRequiredStringEntry(formData: FormData, field: StorefrontSettingsField) {
  const values = formData.getAll(field);
  if (values.length !== 1) {
    throw new StorefrontSettingsValidationError(
      values.length === 0 ? 'missing-field' : 'duplicate-field',
      values.length === 0
        ? `${FIELD_LABELS[field]} is required.`
        : `${FIELD_LABELS[field]} must be submitted once.`,
      field,
    );
  }

  const value = values[0];
  if (typeof value !== 'string') {
    throw new StorefrontSettingsValidationError(
      'invalid-type',
      `${FIELD_LABELS[field]} must be text.`,
      field,
    );
  }
  return value;
}

function validateFormPayloadSize(formData: FormData) {
  let entries = 0;
  let bytes = 0;
  for (const [name, value] of formData.entries()) {
    entries += 1;
    if (entries > 8) {
      throw new StorefrontSettingsValidationError(
        'unknown-field',
        'The storefront settings form contains unsupported fields.',
        'expectedUpdatedAt',
      );
    }
    if (!Object.prototype.hasOwnProperty.call(STOREFRONT_SETTINGS_FORM_FIELDS, name)) {
      throw new StorefrontSettingsValidationError(
        'unknown-field',
        'The storefront settings form contains unsupported fields.',
        'expectedUpdatedAt',
      );
    }
    if (typeof value !== 'string') {
      throw new StorefrontSettingsValidationError(
        'invalid-type',
        'The storefront settings form contains an unsupported value.',
        name as StorefrontSettingsField,
      );
    }
    bytes += byteLength(name) + byteLength(value);
    if (bytes > STOREFRONT_SETTINGS_MAX_FORM_BYTES) {
      throw new StorefrontSettingsValidationError(
        'too-long',
        'The storefront settings form is too large.',
        'expectedUpdatedAt',
        'payload-too-large',
      );
    }
  }
}

export function parseExpectedUpdatedAt(value: unknown) {
  if (value === 'none') return 'none' as const;
  if (typeof value !== 'string' || value.length > 32 || !ISO_TIMESTAMP.test(value)) {
    throw new StorefrontSettingsValidationError(
      'invalid-timestamp',
      'The expected update timestamp is invalid.',
      'expectedUpdatedAt',
    );
  }
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new StorefrontSettingsValidationError(
      'invalid-timestamp',
      'The expected update timestamp is invalid.',
      'expectedUpdatedAt',
    );
  }
  return value;
}

export type ParsedStorefrontSettingsForm = {
  config: EcommerceStorefrontConfig;
  expectedUpdatedAt: string;
};

export function parseEcommerceStorefrontSettingsForm(formData: FormData): ParsedStorefrontSettingsForm {
  if (!formData || typeof formData.entries !== 'function' || typeof formData.getAll !== 'function') {
    throw new StorefrontSettingsValidationError(
      'invalid-type',
      'The storefront settings form is invalid.',
    );
  }

  validateFormPayloadSize(formData);
  const metadataTitle = readRequiredStringEntry(formData, 'metadataTitle');
  const metadataDescription = readRequiredStringEntry(formData, 'metadataDescription');
  const footerSupportingText = readRequiredStringEntry(formData, 'footerSupportingText');
  const footerShowPoweredBy = readRequiredStringEntry(formData, 'footerShowPoweredBy');
  const expectedUpdatedAt = parseExpectedUpdatedAt(
    readRequiredStringEntry(formData, 'expectedUpdatedAt'),
  );

  if (footerShowPoweredBy !== 'true' && footerShowPoweredBy !== 'false') {
    throw new StorefrontSettingsValidationError(
      'invalid-boolean',
      'Choose whether the storefront footer shows the platform attribution.',
      'footerShowPoweredBy',
    );
  }

  return {
    config: validateEcommerceStorefrontConfig({
      version: STOREFRONT_SETTINGS_VERSION,
      metadata: { title: metadataTitle, description: metadataDescription },
      footer: {
        supportingText: footerSupportingText,
        showPoweredBy: footerShowPoweredBy === 'true',
      },
    }),
    expectedUpdatedAt,
  };
}

export function expectedUpdatedAtMatches(expected: string, current: string | null) {
  if (expected === 'none') return current === null;
  return current !== null && current === expected;
}

export function isSafeStorefrontHttpUrl(value: unknown) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  if (CONTROL_CHARACTERS.test(value) || hasUnpairedSurrogate(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username
      && !url.password
      && url.hostname.length > 0;
  } catch {
    return false;
  }
}
