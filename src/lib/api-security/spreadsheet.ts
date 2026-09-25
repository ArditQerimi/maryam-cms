export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';
const ALLOWED_MIMES = new Set([XLSX_MIME, XLS_MIME, 'application/octet-stream', 'application/zip']);

type SpreadsheetKind = 'xlsx' | 'xls';

export class SpreadsheetValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SpreadsheetValidationError';
    this.status = status;
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectSpreadsheet(bytes: Uint8Array): SpreadsheetKind | null {
  if (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return 'xlsx';
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'xls';
  }
  return null;
}

export async function validateAndNormalizeSpreadsheet(file: File) {
  if (!(file instanceof File)) throw new SpreadsheetValidationError('No file uploaded');
  if (file.size <= 0) throw new SpreadsheetValidationError('The uploaded file is empty');
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetValidationError('Spreadsheet must be 10MB or smaller', 413);
  }

  const declaredMime = file.type.split(';', 1)[0].trim().toLowerCase();
  if (declaredMime && !ALLOWED_MIMES.has(declaredMime)) {
    throw new SpreadsheetValidationError('Only Excel spreadsheets are allowed');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetValidationError('Spreadsheet must be 10MB or smaller', 413);
  }
  const kind = detectSpreadsheet(bytes);
  if (!kind) throw new SpreadsheetValidationError('The file is not a valid Excel spreadsheet');

  const declaredKind: SpreadsheetKind | null = declaredMime === XLSX_MIME || declaredMime === 'application/zip'
    ? 'xlsx'
    : declaredMime === XLS_MIME
      ? 'xls'
      : null;
  if (declaredKind && declaredKind !== kind) {
    throw new SpreadsheetValidationError('Spreadsheet type does not match its contents');
  }

  return {
    kind,
    file: new File([bytes], kind === 'xlsx' ? 'products.xlsx' : 'products.xls', {
      type: kind === 'xlsx' ? XLSX_MIME : XLS_MIME,
    }),
  };
}
