export type StorefrontSettingsErrorCode =
  | 'access-denied'
  | 'host-unavailable'
  | 'permissions-unavailable'
  | 'schema-unavailable'
  | 'stale-write'
  | 'invalid-stored-config'
  | 'invalid-form'
  | 'unknown-field'
  | 'payload-too-large'
  | 'unavailable';

export class StorefrontSettingsError extends Error {
  readonly code: StorefrontSettingsErrorCode;
  readonly field?: string;

  constructor(code: StorefrontSettingsErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'StorefrontSettingsError';
    this.code = code;
    this.field = field;
  }
}

export class StorefrontSettingsValidationError extends StorefrontSettingsError {
  readonly detailCode:
    | 'required'
    | 'invalid-type'
    | 'too-long'
    | 'control-character'
    | 'unknown-field'
    | 'missing-field'
    | 'duplicate-field'
    | 'invalid-boolean'
    | 'invalid-timestamp'
    | 'invalid-json'
    | 'unsupported-version'
    | 'invalid-config';

  constructor(
    detailCode: StorefrontSettingsValidationError['detailCode'],
    message: string,
    field?: string,
    code: StorefrontSettingsErrorCode = 'invalid-form',
  ) {
    super(code, message, field);
    this.name = 'StorefrontSettingsValidationError';
    this.detailCode = detailCode;
  }
}

function errorCode(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== 'object' || depth > 3) return null;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  return errorCode(candidate.cause, depth + 1);
}

/**
 * PostgreSQL uses 42P01 for a missing relation and 42703 for a missing
 * column. The settings module handles both as an operational stop; it never
 * attempts to repair the schema.
 */
export function isMissingSettingsSchemaError(error: unknown) {
  const code = errorCode(error);
  if (code === '42P01' || code === '42703') return true;

  const message = String(
    (error as { message?: unknown } | null)?.message || '',
  ).toLowerCase();
  return (
    (message.includes('settings_store') && message.includes('does not exist')) ||
    (message.includes('settings store') && message.includes('does not exist')) ||
    (message.includes('column') && message.includes('does not exist') && message.includes('settings'))
  );
}

export function isStaleWriteError(error: unknown) {
  return error instanceof StorefrontSettingsError && error.code === 'stale-write';
}

export function isStorefrontSettingsError(error: unknown): error is StorefrontSettingsError {
  return error instanceof StorefrontSettingsError;
}
