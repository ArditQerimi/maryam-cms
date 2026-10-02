/* Article images may be tenant-hosted, so the safe parser intentionally renders responsive plain images. */
/* eslint-disable @next/next/no-img-element */
import { getT } from '@/lib/i18n/server';
import styles from './blog.module.css';

type TextBlock = {
  type: 'paragraph' | 'heading' | 'quote';
  text: string;
  level?: 2 | 3;
};

type ImageItem = {
  src: string;
  alt: string;
  caption?: string;
};

type ImageBlock = {
  type: 'images';
  images: ImageItem[];
};

type ListBlock = {
  type: 'list';
  ordered: boolean;
  items: string[];
};

type ContentBlock = TextBlock | ImageBlock | ListBlock;

function safeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
}

function decodeEntities(value: string): string {
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

function htmlToText(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function getAttribute(tag: string, attribute: 'src' | 'alt'): string {
  const expression = new RegExp(
    `\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = tag.match(expression);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function safeImageSource(value: string): string {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function parseImageTag(tag: string): ImageItem | null {
  const src = safeImageSource(getAttribute(tag, 'src'));
  if (!src) return null;
  return {
    src,
    alt: getAttribute(tag, 'alt'),
  };
}

function addTextBlock(blocks: ContentBlock[], type: TextBlock['type'], value: string, level?: 2 | 3) {
  const text = htmlToText(value);
  if (text) blocks.push({ type, text, ...(level ? { level } : {}) });
}

function appendImage(blocks: ContentBlock[], image: ImageItem) {
  const previous = blocks.at(-1);
  if (previous?.type === 'images') {
    previous.images.push(image);
    return;
  }
  blocks.push({ type: 'images', images: [image] });
}

function parseFigure(value: string): ImageItem | null {
  const imageTag = value.match(/<img\b[^>]*\/?\s*>/i)?.[0];
  if (!imageTag) return null;

  const image = parseImageTag(imageTag);
  if (!image) return null;

  const caption = value.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption\s*>/i)?.[1];
  const captionText = caption ? htmlToText(caption) : '';
  if (captionText) image.caption = captionText;
  return image;
}

function parseContent(content: string): ContentBlock[] {
  const source = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?\s*>/gi, '')
    .trim();
  const blocks: ContentBlock[] = [];
  const blockPattern =
    /<(h[1-6]|p|blockquote|ul|ol|figure)\b[^>]*>([\s\S]*?)<\/\1\s*>|<img\b[^>]*\/?\s*>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null) {
    const between = htmlToText(source.slice(cursor, match.index));
    if (between) blocks.push({ type: 'paragraph', text: between });

    if (!match[1]) {
      const image = parseImageTag(match[0]);
      if (image) appendImage(blocks, image);
      cursor = blockPattern.lastIndex;
      continue;
    }

    const tag = match[1].toLowerCase();
    const inner = match[2];

    if (tag === 'figure') {
      const image = parseFigure(inner);
      if (image) appendImage(blocks, image);
      else addTextBlock(blocks, 'paragraph', inner);
    } else if (tag === 'ul' || tag === 'ol') {
      const items: string[] = [];
      const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemPattern.exec(inner)) !== null) {
        const item = htmlToText(itemMatch[1]);
        if (item) items.push(item);
      }
      if (items.length > 0) blocks.push({ type: 'list', ordered: tag === 'ol', items });
    } else if (tag === 'blockquote') {
      addTextBlock(blocks, 'quote', inner);
    } else if (tag === 'p') {
      const imageTags = inner.match(/<img\b[^>]*\/?\s*>/gi) ?? [];
      if (imageTags.length > 0) {
        addTextBlock(blocks, 'paragraph', inner.replace(/<img\b[^>]*\/?\s*>/gi, ' '));
        for (const imageTag of imageTags) {
          const image = parseImageTag(imageTag);
          if (image) appendImage(blocks, image);
        }
      } else {
        addTextBlock(blocks, 'paragraph', inner);
      }
    } else if (tag.startsWith('h')) {
      const level = tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' ? 3 : 2;
      addTextBlock(blocks, 'heading', inner, level);
    } else {
      addTextBlock(blocks, 'paragraph', inner);
    }

    cursor = blockPattern.lastIndex;
  }

  const remainder = htmlToText(source.slice(cursor));
  if (remainder) {
    for (const paragraph of remainder.split(/\n\s*\n/)) {
      addTextBlock(blocks, 'paragraph', paragraph);
    }
  }

  if (blocks.length === 0) {
    for (const paragraph of htmlToText(source).split(/\n\s*\n/)) {
      addTextBlock(blocks, 'paragraph', paragraph);
    }
  }

  return blocks;
}

function ensurePullQuote(blocks: ContentBlock[], fallbackQuote: string) {
  const quote = htmlToText(fallbackQuote);
  if (!quote || blocks.some((block) => block.type === 'quote')) return;

  const firstParagraph = blocks.findIndex((block) => block.type === 'paragraph');
  const insertAt = firstParagraph >= 0 ? firstParagraph + 1 : Math.min(blocks.length, 1);
  blocks.splice(insertAt, 0, { type: 'quote', text: quote });
}

export default async function ArticleContent({
  content,
  fallbackQuote,
}: {
  content: string;
  fallbackQuote?: string;
}) {
  const t = await getT();
  const blocks = parseContent(content);
  ensurePullQuote(blocks, fallbackQuote ?? '');

  if (blocks.length === 0) {
    return (
      <div className={styles.articleBody}>
        <p>{t('blog.article.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.articleBody}>
      {blocks.map((block, index) => {
        if (block.type === 'images') {
          return (
            <div
              key={`images-${index}`}
              className={`${styles.articleImageGrid} ${block.images.length === 1 ? styles.articleImageSingle : ''}`}
            >
              {block.images.map((image, imageIndex) => (
                <figure key={`${image.src}-${imageIndex}`} className={styles.articleFigure}>
                  <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          );
        }

        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={`list-${index}`}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          );
        }

        if (block.type === 'heading') {
          return block.level === 3 ? (
            <h3 key={`heading-${index}`}>{block.text}</h3>
          ) : (
            <h2 key={`heading-${index}`}>{block.text}</h2>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={`quote-${index}`}>
              <p>{block.text}</p>
            </blockquote>
          );
        }

        return <p key={`paragraph-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
