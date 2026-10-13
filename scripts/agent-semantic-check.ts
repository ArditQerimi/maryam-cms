/*
 * Semantic (vector) search check — keyword-only vs hybrid on real shop questions:
 *
 *   npx tsx scripts/agent-semantic-check.ts postgres://postgres:postgres@localhost:5432/pos_tenant_arditi_test
 *
 * Builds / refreshes the agent_knowledge index of the TEST database with the local model, then asks
 * each question twice (AGENT_EMBEDDINGS off / on) and checks that an expected product is in the top 3.
 */
import Module from 'node:module';
import path from 'node:path';

const moduleInternals = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'server-only') return path.join(process.cwd(), 'scripts', 'server-only-shim.cjs');
  return resolveFilename.call(this, request, ...rest);
};

const url = process.argv[2] ?? '';
if (!/_test$/.test(new URL(url || 'postgres://x/none').pathname)) {
  console.error('Pass the connection string of a *_test database.');
  process.exit(2);
}
process.env.STANDALONE_DATABASE_URL = url;

const CASES: Array<{ question: string; expect: RegExp; note: string }> = [
  { question: 'diçka natyrale për prostatën', expect: /kungull/i, note: 'no shared word with the product' },
  { question: 'parfum orientale', expect: /khamrah|parfum/i, note: 'meaning' },
  { question: 'ilaç natyral për flokët', expect: /rozmarin|jojob/i, note: 'meaning' },
  { question: 'libër tefsiri', expect: /koment|tefsir/i, note: 'synonym list' },
  { question: 'Nektari i Vulosur', expect: /nektar/i, note: 'exact title must stay first' },
  { question: 'libër për fëmijë', expect: /fëmij|femij|heroi/i, note: 'topic' },
  { question: 'si të falem saktë', expect: /namaz|salah|falje|falemi/i, note: 'question form' },
  // Different words from the catalog: here only meaning can help.
  { question: 'libër për parajsën', expect: /xhenet/i, note: 'parajsë ↔ xhenet' },
  { question: 'tregime për profetët', expect: /pejgamber|profet/i, note: 'profet ↔ pejgamber' },
  { question: 'çfarë ndodh pas vdekjes', expect: /ahiret|vdekur|varr|kiamet/i, note: 'paraphrase' },
  { question: 'si ta edukoj fëmijën tim', expect: /baba|prind|edukim|fëmij/i, note: 'paraphrase' },
  { question: 'diçka për imunitetin', expect: /farës së zezë|imunitet|mjaltë/i, note: 'benefit, not name' },
  { question: 'libër për gratë muslimane', expect: /grua|gra|femr|nën|hixhab|mbules/i, note: 'topic' },
];

async function main() {
  const { getTenantDb } = await import('../src/db/index');
  const { runTool } = await import('../src/lib/agent/tools');
  const { syncKnowledge } = await import('../src/lib/agent/knowledge');
  const { sql } = await import('drizzle-orm');
  type Env = Parameters<typeof runTool>[0];
  const db = getTenantDb(url);
  const [company] = ((await db.execute(sql`SELECT id, subdomain FROM companies WHERE status = 'Active' ORDER BY id LIMIT 1`)) as unknown as { rows: Array<{ id: number; subdomain: string }> }).rows;
  const env = { channel: 'web', sessionKey: `semantic-${Date.now()}`, context: {
    company: { id: company.id, subdomain: company.subdomain, dbConnectionString: url, dbSchema: 'public', status: 'Active' },
    db, customer: null, session: null, requestHost: 'localhost', requestAuthority: 'localhost:3003', requestProtocol: 'http:', requestOrigin: 'http://localhost:3003',
  } } as unknown as Env;

  process.env.AGENT_EMBEDDINGS = 'local';
  const sync = await syncKnowledge(db);
  console.log(`index: ${sync.documents} documents, ${sync.embedded} embedded now, ${sync.removed} removed, ${(sync.ms / 1000).toFixed(1)} s`);

  let keywordHits = 0;
  let hybridHits = 0;
  for (const item of CASES) {
    const ask = async (mode: string) => {
      process.env.AGENT_EMBEDDINGS = mode;
      const result = await runTool(env, 'search_products', { query: item.question }) as { products?: Array<{ name: string }> };
      return (result.products ?? []).slice(0, 3).map((p) => p.name.replace(/^Titulli:\s*/i, '').slice(0, 34));
    };
    const keyword = await ask('off');
    const hybrid = await ask('local');
    const k = keyword.some((name) => item.expect.test(name));
    const h = hybrid.some((name) => item.expect.test(name));
    keywordHits += Number(k);
    hybridHits += Number(h);
    console.log(`\n"${item.question}" (${item.note})\n  keyword ${k ? '✔' : '✘'} ${keyword.join(' | ') || '—'}\n  hybrid  ${h ? '✔' : '✘'} ${hybrid.join(' | ') || '—'}`);
  }

  process.env.AGENT_EMBEDDINGS = 'local';
  let unrelated = 0;
  for (const query of ['xyzzyqwv', 'a keni laptop', 'telefon samsung', 'pica me djathë', 'bileta për ndeshjen']) {
    unrelated += ((await runTool(env, 'search_products', { query }) as { products?: unknown[] }).products ?? []).length;
  }
  const garbage = { products: Array(unrelated) };
  const knowledge = await runTool(env, 'search_knowledge', { question: 'çfarë shkruani në blog për librat' }) as { results?: Array<{ title: string }>; note?: string };
  console.log(`\nunrelated questions (laptop, phone, pizza, tickets, nonsense) → ${(garbage.products ?? []).length} products (expected 0)`);
  console.log(`search_knowledge → ${(knowledge.results ?? []).map((r) => r.title).join(' | ') || knowledge.note}`);
  console.log(`\nexpected product in top 3: keyword ${keywordHits}/${CASES.length} · hybrid ${hybridHits}/${CASES.length}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
