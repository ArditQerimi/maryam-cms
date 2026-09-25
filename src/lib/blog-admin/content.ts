export const BLOG_CONTENT_LIMITS = {
  maxBlocks: 200,
  maxCharacters: 60_000,
  maxTextPerBlock: 8_000,
  maxImageUrl: 2_048,
  maxAlt: 300,
  maxCaption: 500,
} as const;

export type BlogContentBlockType = 'paragraph' | 'heading' | 'quote' | 'image';

export type BlogContentBlock = {
  type: BlogContentBlockType;
  text: string;
  url: string;
  alt: string;
};

const BLOCK_TYPES = new Set<BlogContentBlockType>([
  'paragraph',
  'heading',
  'quote',
  'image',
]);

const UNSAFE_MARKUP_BLOCKS = /<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

function safeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : '';
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeBlockText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120)
    .replace(/-+$/g, '');

  return slug || 'post';
}

/**
 * Only root-relative paths and HTTP(S) URLs are accepted. URLs containing
 * credentials, controls, backslashes, or an implicit protocol are rejected.
 */
export function getSafeImageUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.length > BLOG_CONTENT_LIMITS.maxImageUrl || CONTROL_OR_BACKSLASH.test(candidate)) {
    return null;
  }

  if (candidate.startsWith('/')) {
    return candidate.startsWith('//') ? null : candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\t ]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getAttribute(tag: string, attribute: 'src' | 'alt'): string {
  const expression = new RegExp(
    `\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = tag.match(expression);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function emptyBlock(type: BlogContentBlockType): BlogContentBlock {
  return { type, text: '', url: '', alt: '' };
}

function addTextBlocks(blocks: BlogContentBlock[], type: BlogContentBlockType, value: string) {
  for (const paragraph of htmlToText(value).split(/\n\s*\n/)) {
    const text = normalizeBlockText(paragraph);
    if (text) blocks.push({ ...emptyBlock(type), text });
  }
}

function imageBlockFromTag(tag: string, caption = ''): BlogContentBlock | null {
  const url = getSafeImageUrl(getAttribute(tag, 'src'));
  if (!url) return null;

  return {
    ...emptyBlock('image'),
    url,
    alt: getAttribute(tag, 'alt').slice(0, BLOG_CONTENT_LIMITS.maxAlt),
    text: normalizeBlockText(caption).slice(0, BLOG_CONTENT_LIMITS.maxCaption),
  };
}

function parseFigure(value: string): BlogContentBlock | null {
  const imageTag = value.match(/<img\b[^>]*\/?\s*>/i)?.[0];
  if (!imageTag) return null;
  const caption = value.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption\s*>/i)?.[1] ?? '';
  return imageBlockFromTag(imageTag, caption);
}

/**
 * Converts existing storefront-safe content into editor blocks. Unknown tags
 * are reduced to text and escaped again during serialization, so this parser
 * never preserves executable markup.
 */
export function parseSafeBlogContent(content: string): BlogContentBlock[] {
  const source = content.replace(UNSAFE_MARKUP_BLOCKS, ' ').trim();
  if (!source) return [];

  const blocks: BlogContentBlock[] = [];
  const blockPattern =
    /<figure\b[^>]*>([\s\S]*?)<\/figure\s*>|<(h2|h3)\b[^>]*>([\s\S]*?)<\/\2\s*>|<blockquote\b[^>]*>([\s\S]*?)<\/blockquote\s*>|<p\b[^>]*>([\s\S]*?)<\/p\s*>|<img\b[^>]*\/?\s*>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null && blocks.length < BLOG_CONTENT_LIMITS.maxBlocks) {
    addTextBlocks(blocks, 'paragraph', source.slice(cursor, match.index));

    if (match[1] !== undefined) {
      const image = parseFigure(match[1]);
      if (image) blocks.push(image);
    } else if (match[2]) {
      addTextBlocks(blocks, 'heading', match[3] ?? '');
    } else if (match[4] !== undefined) {
      addTextBlocks(blocks, 'quote', match[4]);
    } else if (match[5] !== undefined) {
      addTextBlocks(blocks, 'paragraph', match[5]);
    } else {
      const image = imageBlockFromTag(match[0]);
      if (image) blocks.push(image);
    }

    cursor = blockPattern.lastIndex;
  }

  addTextBlocks(blocks, 'paragraph', source.slice(cursor));
  return blocks.slice(0, BLOG_CONTENT_LIMITS.maxBlocks);
}

export function parseEditorPayload(value: string): BlogContentBlock[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('The content block payload is invalid.');
  }

  if (!Array.isArray(parsed) || parsed.length > BLOG_CONTENT_LIMITS.maxBlocks) {
    throw new Error('The content block payload is invalid.');
  }

  return parsed.map((item) => {
    const record = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const type = typeof record.type === 'string' && BLOCK_TYPES.has(record.type as BlogContentBlockType)
      ? record.type as BlogContentBlockType
      : 'paragraph';

    return {
      type,
      text: typeof record.text === 'string' ? record.text : '',
      url: typeof record.url === 'string' ? record.url : '',
      alt: typeof record.alt === 'string' ? record.alt : '',
    };
  });
}

export function serializeEditorPayload(blocks: BlogContentBlock[]): string {
  return JSON.stringify(blocks.slice(0, BLOG_CONTENT_LIMITS.maxBlocks).map((block) => ({
    type: block.type,
    text: block.text,
    url: block.url,
    alt: block.alt,
  })));
}

/**
 * Produces the small HTML subset understood by the storefront's safe article
 * parser. Text and attributes are always escaped; callers validate URLs first.
 */
export function serializeSafeBlogContent(blocks: BlogContentBlock[]): string {
  const html: string[] = [];

  for (const block of blocks.slice(0, BLOG_CONTENT_LIMITS.maxBlocks)) {
    if (block.type === 'image') {
      const url = getSafeImageUrl(block.url);
      if (!url) continue;
      const alt = escapeHtml(block.alt.trim().slice(0, BLOG_CONTENT_LIMITS.maxAlt));
      const caption = escapeHtml(normalizeBlockText(block.text).slice(0, BLOG_CONTENT_LIMITS.maxCaption));
      html.push(
        `<figure><img src="${escapeHtml(url)}" alt="${alt}">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`,
      );
      continue;
    }

    const text = escapeHtml(normalizeBlockText(block.text).slice(0, BLOG_CONTENT_LIMITS.maxTextPerBlock));
    if (!text) continue;
    if (block.type === 'heading') html.push(`<h2>${text}</h2>`);
    else if (block.type === 'quote') html.push(`<blockquote><p>${text}</p></blockquote>`);
    else html.push(`<p>${text}</p>`);
  }

  return html.join('');
}

export function getBlogContentPlainText(content: string): string {
  return htmlToText(content.replace(UNSAFE_MARKUP_BLOCKS, ' '));
}

export function estimateReadingMinutes(content: string): number {
  const words = getBlogContentPlainText(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}
