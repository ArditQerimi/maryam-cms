import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { getTenantDb } from '@/db/index';

/*
 * Semantic search (vectors / embeddings) for the shop assistant — RAG, not training: the model
 * stays the same, but products, CMS pages and blog posts are turned into vectors that capture
 * their meaning, so "diçka natyrale për prostatën" finds the pumpkin-seed capsules even with no
 * word in common.
 *
 *  - Model: multilingual-e5-small (local, ONNX via @huggingface/transformers): understands Albanian,
 *    no API key, no cost. Needs ~500 MB RAM, so it is opt-in: AGENT_EMBEDDINGS=local.
 *    Without it (e.g. Render's free 512 MB plan) every function here reports "off" and the tools
 *    keep their keyword search.
 *  - Index: agent_knowledge (one row per product / page chunk / post chunk, vector as real[]),
 *    re-embedded only when the text changes; refreshed at most every 15 minutes in the background.
 *  - Search: cosine similarity in memory (fine for thousands of rows; pgvector when bigger).
 */

type Db = ReturnType<typeof getTenantDb>;

const MODEL = process.env.AGENT_EMBEDDING_MODEL || 'Xenova/multilingual-e5-small';
const REFRESH_MS = 15 * 60 * 1000;
const CHUNK_CHARS = 700;

export function semanticSearchEnabled() {
  return (process.env.AGENT_EMBEDDINGS ?? '').toLowerCase() === 'local';
}

// ------------------------------------------------------------------ the model

type Embedder = (text: string) => Promise<number[]>;
let embedderPromise: Promise<Embedder | null> | null = null;

async function loadEmbedder(): Promise<Embedder | null> {
  if (!semanticSearchEnabled()) return null;
  embedderPromise ??= (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = process.env.AGENT_MODEL_CACHE || '.cache/models';
      const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
      return async (text: string) => Array.from((await extractor(text, { pooling: 'mean', normalize: true })).data as Float32Array);
    } catch (error) {
      console.error('[knowledge] embedding model unavailable, keyword search only:', error instanceof Error ? error.message : error);
      return null;
    }
  })();
  return embedderPromise;
}

// e5 models are trained with these prefixes.
const asQuery = (text: string) => `query: ${text}`;
const asPassage = (text: string) => `passage: ${text}`;

// ------------------------------------------------------------------ the documents

export type KnowledgeDoc = { kind: 'product' | 'page' | 'post'; refId: number; chunk: number; title: string; url: string; text: string };

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/** Visible text inside page-builder blocks (titles, paragraphs, buttons…). */
function blockText(blocks: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const block = node as { props?: Record<string, unknown>; children?: unknown };
    for (const [key, value] of Object.entries(block.props ?? {})) {
      if (typeof value === 'string' && /text|title|heading|content|html|description|label|subtitle|caption|body/i.test(key)) {
        const clean = stripHtml(value);
        if (clean.length > 2 && !/^(https?:|#|\/)/.test(clean)) out.push(clean);
      }
    }
    walk(block.children);
  };
  walk(blocks);
  return out.join('. ');
}

function chunks(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > CHUNK_CHARS) {
    const cut = Math.max(rest.lastIndexOf('. ', CHUNK_CHARS), CHUNK_CHARS / 2);
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

const rowsOf = <T,>(result: unknown) => ((result as { rows?: T[] }).rows ?? []);

/** Everything the assistant can find by meaning: active products, CMS pages and blog posts. */
export async function collectDocuments(db: Db): Promise<KnowledgeDoc[]> {
  const products = rowsOf<{ id: number; name: string; description: string | null; category: string | null; attributes: string | null }>(await db.execute(sql`
    SELECT p.id, p.name, p.description, c.name AS category,
      (SELECT string_agg(a.name || ': ' || v.value, '; ' ORDER BY a.name)
         FROM product_attribute_values v JOIN category_attributes a ON a.id = v.attribute_id
        WHERE v.product_id = p.id AND coalesce(v.value, '') <> '') AS attributes
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'Active'`).catch(() => db.execute(sql`
    SELECT p.id, p.name, p.description, c.name AS category, NULL AS attributes
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 'Active'`)));
  const docs: KnowledgeDoc[] = products.map((row) => ({
    kind: 'product',
    refId: row.id,
    chunk: 0,
    title: row.name,
    url: `/home/products/${row.id}`,
    text: [row.name, row.category, row.attributes, stripHtml(row.description ?? '').slice(0, 500)].filter(Boolean).join('. '),
  }));

  const pages = rowsOf<{ id: number; title: string; slug: string; content: string | null; excerpt: string | null; blocks: unknown }>(
    await db.execute(sql`SELECT id, title, slug, content, excerpt, blocks FROM cms_pages WHERE status = 'Active'`).catch(() => ({ rows: [] })));
  for (const page of pages) {
    const body = [page.excerpt, stripHtml(page.content ?? ''), blockText(page.blocks)].filter(Boolean).join('. ');
    chunks(body).forEach((text, chunk) => docs.push({ kind: 'page', refId: page.id, chunk, title: page.title, url: `/home/pages/${page.slug}`, text: `${page.title}. ${text}` }));
  }

  const posts = rowsOf<{ id: number; title: string; slug: string; content: string | null; excerpt: string | null }>(
    await db.execute(sql`SELECT id, title, slug, content, excerpt FROM blog_posts WHERE status = 'Active'`).catch(() => ({ rows: [] })));
  for (const post of posts) {
    const body = [post.excerpt, stripHtml(post.content ?? '')].filter(Boolean).join('. ');
    chunks(body).forEach((text, chunk) => docs.push({ kind: 'post', refId: post.id, chunk, title: post.title, url: `/home/blogs/${post.slug}`, text: `${post.title}. ${text}` }));
  }
  return docs.filter((doc) => doc.text.trim().length > 3);
}

// ------------------------------------------------------------------ the index

type IndexedDoc = KnowledgeDoc & { vector: number[] };
const memory = new WeakMap<object, { docs: IndexedDoc[]; syncedAt: number; syncing: Promise<SyncResult> | null }>();
const ready = new WeakMap<object, Promise<void>>();

async function ensureTable(db: Db) {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS agent_knowledge (
        id serial PRIMARY KEY,
        kind varchar(10) NOT NULL,
        ref_id integer NOT NULL,
        chunk integer NOT NULL DEFAULT 0,
        title text NOT NULL,
        url text NOT NULL,
        content text NOT NULL,
        content_hash varchar(64) NOT NULL,
        model varchar(100) NOT NULL,
        embedding real[] NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (kind, ref_id, chunk)
      );`)).then(() => undefined);
    pending.catch(() => ready.delete(db));
    ready.set(db, pending);
  }
  await pending;
}

export type SyncResult = { enabled: boolean; documents: number; embedded: number; removed: number; ms: number };

/** Brings agent_knowledge in line with the catalog: embeds new / changed texts, drops deleted ones. */
export async function syncKnowledge(db: Db): Promise<SyncResult> {
  const started = Date.now();
  const embed = await loadEmbedder();
  if (!embed) return { enabled: false, documents: 0, embedded: 0, removed: 0, ms: 0 };
  await ensureTable(db);

  const docs = await collectDocuments(db);
  const existing = new Map(rowsOf<{ kind: string; ref_id: number; chunk: number; content_hash: string; model: string }>(
    await db.execute(sql`SELECT kind, ref_id, chunk, content_hash, model FROM agent_knowledge`))
    .map((row) => [`${row.kind}:${row.ref_id}:${row.chunk}`, row]));

  let embedded = 0;
  const keep = new Set<string>();
  for (const doc of docs) {
    const key = `${doc.kind}:${doc.refId}:${doc.chunk}`;
    keep.add(key);
    const hash = createHash('sha256').update(doc.text).digest('hex');
    const current = existing.get(key);
    if (current && current.content_hash === hash && current.model === MODEL) continue;
    const vector = await embed(asPassage(doc.text));
    await db.execute(sql`
      INSERT INTO agent_knowledge (kind, ref_id, chunk, title, url, content, content_hash, model, embedding, updated_at)
      VALUES (${doc.kind}, ${doc.refId}, ${doc.chunk}, ${doc.title}, ${doc.url}, ${doc.text}, ${hash}, ${MODEL}, ${`{${vector.join(',')}}`}::real[], now())
      ON CONFLICT (kind, ref_id, chunk) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, content = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash, model = EXCLUDED.model, embedding = EXCLUDED.embedding, updated_at = now()`);
    embedded += 1;
  }
  const stale = [...existing.keys()].filter((key) => !keep.has(key));
  for (const key of stale) {
    const [kind, refId, chunk] = key.split(':');
    await db.execute(sql`DELETE FROM agent_knowledge WHERE kind = ${kind} AND ref_id = ${Number(refId)} AND chunk = ${Number(chunk)}`);
  }

  const loaded = rowsOf<{ kind: KnowledgeDoc['kind']; ref_id: number; chunk: number; title: string; url: string; content: string; embedding: number[] }>(
    await db.execute(sql`SELECT kind, ref_id, chunk, title, url, content, embedding FROM agent_knowledge WHERE model = ${MODEL}`));
  memory.set(db, {
    docs: loaded.map((row) => ({ kind: row.kind, refId: row.ref_id, chunk: row.chunk, title: row.title, url: row.url, text: row.content, vector: row.embedding.map(Number) })),
    syncedAt: Date.now(),
    syncing: null,
  });
  return { enabled: true, documents: docs.length, embedded, removed: stale.length, ms: Date.now() - started };
}

/** The in-memory index, built on first use and refreshed in the background every 15 minutes. */
async function indexFor(db: Db): Promise<IndexedDoc[] | null> {
  if (!semanticSearchEnabled()) return null;
  const state = memory.get(db);
  if (!state) {
    try {
      await syncKnowledge(db);
    } catch (error) {
      console.error('[knowledge] sync failed:', error instanceof Error ? error.message : error);
      return null;
    }
    return memory.get(db)?.docs ?? null;
  }
  if (Date.now() - state.syncedAt > REFRESH_MS && !state.syncing) {
    state.syncing = syncKnowledge(db).catch((error) => {
      console.error('[knowledge] refresh failed:', error instanceof Error ? error.message : error);
      state.syncing = null;
      state.syncedAt = Date.now();
      return { enabled: true, documents: 0, embedded: 0, removed: 0, ms: 0 };
    });
  }
  return state.docs;
}

const questionVectors = new Map<string, number[]>();

/** Cosine similarity of two questions (null when semantic search is off). Vectors are cached. */
export async function similarity(a: string, b: string): Promise<number | null> {
  const embed = await loadEmbedder();
  if (!embed) return null;
  const vectorOf = async (value: string) => {
    const key = value.slice(0, 500);
    let vector = questionVectors.get(key);
    if (!vector) {
      vector = await embed(asQuery(key));
      if (questionVectors.size > 2000) questionVectors.clear();
      questionVectors.set(key, vector);
    }
    return vector;
  };
  const [left, right] = [await vectorOf(a), await vectorOf(b)];
  return left.reduce((sum, value, i) => sum + value * right[i], 0);
}

export type SemanticHit = { kind: KnowledgeDoc['kind']; refId: number; title: string; url: string; text: string; score: number };

/** Documents closest in meaning to the question (null when semantic search is off / unavailable). */
export async function semanticSearch(db: Db, question: string, options: { kinds?: KnowledgeDoc['kind'][]; limit?: number } = {}): Promise<SemanticHit[] | null> {
  const index = await indexFor(db);
  const embed = await loadEmbedder();
  if (!index || !embed) return null;
  const query = await embed(asQuery(question.slice(0, 500)));
  const kinds = options.kinds ? new Set(options.kinds) : null;
  return index
    .filter((doc) => !kinds || kinds.has(doc.kind))
    .map((doc) => ({ kind: doc.kind, refId: doc.refId, title: doc.title, url: doc.url, text: doc.text, score: doc.vector.reduce((sum, value, i) => sum + value * query[i], 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 10);
}
