export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 10_000;
export const MAX_IMAGE_PIXELS = 25_000_000;

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

type ImageMime = keyof typeof MIME_EXTENSIONS;

type DetectedImage = {
  mime: ImageMime;
  extension: (typeof MIME_EXTENSIONS)[ImageMime];
  width: number;
  height: number;
};

export class ImageValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImageValidationError';
    this.status = status;
  }
}

function normalizeMime(value: string): ImageMime | null {
  const normalized = value.split(';', 1)[0].trim().toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  return normalized in MIME_EXTENSIONS ? normalized as ImageMime : null;
}

function hasBytes(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  if (offset + signature.length > bytes.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function parseJpegDimensions(bytes: Uint8Array) {
  if (!hasBytes(bytes, [0xff, 0xd8, 0xff])) return null;

  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;

    // Stand-alone markers do not have a length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > bytes.length) return null;

    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xc3 ||
      marker >= 0xc5 && marker <= 0xc7 ||
      marker >= 0xc9 && marker <= 0xcb ||
      marker >= 0xcd && marker <= 0xcf;

    if (isStartOfFrame) {
      if (offset + 7 >= bytes.length) return null;
      const height = readUint16(bytes, offset + 3);
      const width = readUint16(bytes, offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function parsePngDimensions(bytes: Uint8Array) {
  if (
    !hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    readAscii(bytes, 12, 4) !== 'IHDR' ||
    bytes.length < 24
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function parseGifDimensions(bytes: Uint8Array) {
  const signature = readAscii(bytes, 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  if (bytes.length < 10) return null;

  return {
    width: bytes[6] | (bytes[7] << 8),
    height: bytes[8] | (bytes[9] << 8),
  };
}

function parseWebpDimensions(bytes: Uint8Array) {
  if (!hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) || readAscii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }

  const chunkType = readAscii(bytes, 12, 4);
  if (chunkType === 'VP8X' && bytes.length >= 30) {
    return {
      width: readUint24(bytes, 24) + 1,
      height: readUint24(bytes, 27) + 1,
    };
  }

  if (chunkType === 'VP8 ' && bytes.length >= 30 && hasBytes(bytes, [0x9d, 0x01, 0x2a], 23)) {
    return {
      width: readUint16(bytes, 26) & 0x3fff,
      height: readUint16(bytes, 28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = readUint32LE(bytes, 21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

function detectImage(bytes: Uint8Array): DetectedImage | null {
  const jpeg = parseJpegDimensions(bytes);
  if (jpeg) return { mime: 'image/jpeg', extension: 'jpg', ...jpeg };

  const png = parsePngDimensions(bytes);
  if (png) return { mime: 'image/png', extension: 'png', ...png };

  const gif = parseGifDimensions(bytes);
  if (gif) return { mime: 'image/gif', extension: 'gif', ...gif };

  const webp = parseWebpDimensions(bytes);
  if (webp) return { mime: 'image/webp', extension: 'webp', ...webp };

  return null;
}

function assertDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new ImageValidationError('Image dimensions are not allowed');
  }
}

/**
 * Validates the declared MIME type against image magic bytes and returns a new
 * File whose name and MIME type are derived only from the detected content.
 */
export async function validateAndNormalizeImage(file: File): Promise<{
  file: File;
  mime: ImageMime;
  extension: string;
  width: number;
  height: number;
}> {
  if (!(file instanceof File)) {
    throw new ImageValidationError('No file provided');
  }

  if (file.size <= 0) {
    throw new ImageValidationError('The uploaded file is empty');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('Image must be 5MB or smaller', 413);
  }

  const declaredMime = normalizeMime(file.type);
  if (!declaredMime) {
    throw new ImageValidationError('Unsupported image type');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength <= 0) {
    throw new ImageValidationError('The uploaded file is empty');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('Image must be 5MB or smaller', 413);
  }

  const detected = detectImage(bytes);
  if (!detected) {
    throw new ImageValidationError('The file is not a supported image');
  }
  if (detected.mime !== declaredMime) {
    throw new ImageValidationError('Image type does not match its contents');
  }

  assertDimensions(detected.width, detected.height);

  return {
    file: new File([bytes], `upload.${detected.extension}`, {
      type: detected.mime,
      lastModified: Date.now(),
    }),
    mime: detected.mime,
    extension: detected.extension,
    width: detected.width,
    height: detected.height,
  };
}
