/*
 * Cloudinary delivery URLs: https://res.cloudinary.com/<cloud>/image/upload/[<transformations>/][v<version>/]<public id>[.<ext>]
 * A crop is stored in the URL (c_crop,x_…,y_…,w_…,h_…), never in the file: the original stays whole,
 * so a photo can be cropped again any time. Pure functions (browser and server).
 */

export type CloudinaryUrl = {
  /** https://res.cloudinary.com/<cloud>/image/upload/ */
  base: string;
  cloud: string;
  transformations: string[];
  version: string | null;
  publicId: string;
  /** ".jpg", or "" */
  ext: string;
};

export type CropArea = { x: number; y: number; width: number; height: number };

// Transformation parameter keys (so a folder such as "my_books" is never taken for one).
const TRANSFORMATION_KEYS = new Set([
  'a', 'ac', 'af', 'ar', 'b', 'bo', 'br', 'c', 'co', 'cs', 'd', 'dl', 'dn', 'dpr', 'du', 'e', 'eo', 'f', 'fl', 'fn',
  'fps', 'g', 'h', 'ki', 'l', 'o', 'p', 'pg', 'q', 'r', 'so', 'sp', 't', 'u', 'vc', 'vs', 'w', 'x', 'y', 'z',
]);

function isTransformation(segment: string) {
  return segment.split(',').every((part) => {
    const match = /^([a-z]{1,3})_[^/]+$/.exec(part);
    return Boolean(match && TRANSFORMATION_KEYS.has(match[1]));
  });
}

export function parseCloudinaryUrl(url: string | null | undefined): CloudinaryUrl | null {
  const match = /^(https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/)(.+)$/.exec(String(url ?? '').trim());
  if (!match) return null;
  const segments = match[3].split('?')[0].split('/').filter(Boolean);
  const transformations: string[] = [];
  while (segments.length > 1 && !/^v\d+$/.test(segments[0]) && isTransformation(segments[0])) {
    transformations.push(segments.shift()!);
  }
  const version = segments.length > 1 && /^v\d+$/.test(segments[0]) ? segments.shift()!.slice(1) : null;
  if (segments.length === 0) return null;
  const last = segments.pop()!;
  const dot = last.lastIndexOf('.');
  const ext = dot > 0 ? last.slice(dot) : '';
  const name = dot > 0 ? last.slice(0, dot) : last;
  return {
    base: match[1],
    cloud: match[2],
    transformations,
    version,
    publicId: [...segments, decodeURIComponent(name)].join('/'),
    ext,
  };
}

function build(parts: CloudinaryUrl) {
  const path = parts.publicId.split('/').map(encodeURIComponent).join('/');
  return `${parts.base}${parts.transformations.map((item) => `${item}/`).join('')}${parts.version ? `v${parts.version}/` : ''}${path}${parts.ext}`;
}

/** The uncropped, untransformed photo (what the crop window shows). */
export function originalUrl(url: string): string {
  const parts = parseCloudinaryUrl(url);
  return parts ? build({ ...parts, transformations: [] }) : url;
}

/** The crop stored in the URL, in pixels of the original photo, or null. */
export function readCrop(url: string): CropArea | null {
  const parts = parseCloudinaryUrl(url);
  const crop = parts?.transformations.find((item) => item.split(',').includes('c_crop'));
  if (!crop) return null;
  const value = (key: string) => Number((new RegExp(`(?:^|,)${key}_(\\d+)(?:,|$)`).exec(crop) ?? [])[1]);
  const area = { x: value('x') || 0, y: value('y') || 0, width: value('w'), height: value('h') };
  return area.width > 0 && area.height > 0 ? area : null;
}

/** The photo cropped to `area` (pixels of the original); any earlier crop / transformation is replaced. */
export function withCrop(url: string, area: CropArea): string {
  const parts = parseCloudinaryUrl(url);
  if (!parts) return url;
  const round = (value: number) => Math.max(0, Math.round(value));
  const crop = `c_crop,x_${round(area.x)},y_${round(area.y)},w_${Math.max(1, round(area.width))},h_${Math.max(1, round(area.height))}`;
  return build({ ...parts, transformations: [crop] });
}

/** Same photo after it moved (new public id / version); its transformations (crop) are kept. */
export function withPublicId(url: string, publicId: string, version: string | number | null): string {
  const parts = parseCloudinaryUrl(url);
  return parts ? build({ ...parts, publicId, version: version == null ? parts.version : String(version) }) : url;
}
