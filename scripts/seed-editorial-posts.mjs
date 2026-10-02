/**
 * Import the editorial FALLBACK_BLOG_POSTS into each tenant's `blog_posts`
 * table so the posts shown on /home/blogs become manageable from /cms/posts
 * (edit, duplicate, delete, plus new posts through the same list).
 *
 * The rows are read straight out of src/app/home/blogs/blog-data.ts, so the
 * imported content matches the storefront exactly — no copy/paste drift.
 * Existing rows (same slug) are kept untouched: the CMS becomes the source
 * of truth once imported.
 *
 *   node scripts/seed-editorial-posts.mjs           # dry run — plan only
 *   node scripts/seed-editorial-posts.mjs --apply   # write the rows
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
loadEnv({ path: path.join(root, '.env') });

const APPLY = process.argv.includes('--apply');

/** Parse FALLBACK_BLOG_POSTS out of blog-data.ts (array literal → JS). */
function readFallbackPosts() {
  const file = path.join(root, 'src', 'app', 'home', 'blogs', 'blog-data.ts');
  const source = fs.readFileSync(file, 'utf8');
  const marker = 'export const FALLBACK_BLOG_POSTS: BlogPost[] = [';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('FALLBACK_BLOG_POSTS not found in blog-data.ts.');
  const arrayStart = markerIndex + marker.length - 1; // position of "["
  const arrayEnd = source.indexOf('\n];', arrayStart);
  if (arrayEnd < 0) throw new Error('Could not find the end of FALLBACK_BLOG_POSTS.');
  const literal = source.slice(arrayStart, arrayEnd + 2); // include "]"
  const posts = new Function(`return (${literal})`)();
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('No fallback posts parsed from blog-data.ts.');
  }
  return posts;
}

async function listTenants() {
  const master = new Client({ connectionString: process.env.MASTER_DATABASE_URL });
  await master.connect();
  try {
    const { rows } = await master.query(
      'select name, db_connection_string from companies where db_connection_string is not null order by id asc',
    );
    return rows;
  } finally {
    await master.end();
  }
}

function describe(created, id) {
  if (created) return APPLY ? `created (id ${id})` : 'would create';
  return id == null ? 'exists' : `exists (id ${id})`;
}

/** Case-insensitive lookup; insert when missing (APPLY only). */
async function findOrCreateTaxonomy(client, table, name) {
  const existing = await client.query(
    `select id from ${table} where lower(name) = lower($1) limit 1`,
    [name],
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };
  if (!APPLY) return { id: null, created: true };
  const inserted = await client.query(
    `insert into ${table} (name, status) values ($1, 'Active') returning id`,
    [name],
  );
  return { id: inserted.rows[0].id, created: true };
}

async function importPost(client, post, categoryId) {
  const slug = String(post.slug);
  const existing = await client.query('select id from blog_posts where slug = $1 limit 1', [slug]);
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };
  if (!APPLY) return { id: null, created: true };
  const inserted = await client.query(
    `insert into blog_posts
       (category_id, title, slug, excerpt, content, cover_image_url, author_name, status, published_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'Active', $8)
     returning id`,
    [
      categoryId,
      post.title,
      slug,
      post.excerpt ?? '',
      post.content ?? '',
      post.image ?? null,
      post.authorName || 'Editorial',
      new Date(post.publishedAt).toISOString(),
    ],
  );
  return { id: inserted.rows[0].id, created: true };
}

const posts = readFallbackPosts();
console.log(
  APPLY
    ? `Importing ${posts.length} editorial post(s).`
    : `Dry run — ${posts.length} editorial post(s) checked, nothing written.`,
);

const tenants = await listTenants();
for (const tenant of tenants) {
  const client = new Client({ connectionString: tenant.db_connection_string });
  await client.connect();
  console.log(`\n— ${tenant.name}`);
  try {
    const table = await client.query("select to_regclass('blog_posts') as t");
    if (!table.rows[0].t) {
      console.log('   blog_posts table not found — skipped');
      continue;
    }

    for (const post of posts) {
      const category = await findOrCreateTaxonomy(client, 'blog_categories', post.category);
      console.log(`   category "${post.category}": ${describe(category.created, category.id)}`);

      const tagIds = [];
      for (const tagName of post.tags ?? []) {
        const tag = await findOrCreateTaxonomy(client, 'blog_tags', tagName);
        if (tag.id != null) tagIds.push(tag.id);
        console.log(`   tag "${tagName}": ${describe(tag.created, tag.id)}`);
      }

      const result = await importPost(client, post, category.id);
      console.log(
        `   post "${post.slug}": ${result.created
          ? describe(result.created, result.id)
          : `already exists (id ${result.id}) — kept as-is`}`,
      );

      // Link tags only when the post has no links yet (never override edits).
      if (APPLY && result.id != null && tagIds.length > 0) {
        const existingLinks = await client.query(
          'select 1 from blog_post_tags where post_id = $1 limit 1',
          [result.id],
        );
        if (existingLinks.rows.length === 0) {
          for (const tagId of tagIds) {
            await client.query(
              'insert into blog_post_tags (post_id, tag_id) values ($1, $2) on conflict do nothing',
              [result.id, tagId],
            );
          }
          console.log(`     → linked ${tagIds.length} tag(s)`);
        }
      }
    }
  } finally {
    await client.end();
  }
}

console.log(APPLY ? '\nDone.' : '\nRe-run with --apply to write these changes.');
