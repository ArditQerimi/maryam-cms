export class StorefrontError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StorefrontError';
    this.status = status;
    this.code = code;
  }
}

export class StorefrontInputError extends StorefrontError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(400, 'invalid-request', message);
    this.name = 'StorefrontInputError';
    this.field = field;
  }
}

export function isStorefrontError(error: unknown): error is StorefrontError {
  return error instanceof StorefrontError;
}
