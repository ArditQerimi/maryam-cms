import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { getTenantDb } from '@/db/index';
import type { ChatTurn } from './run';

/*
 * Persistence for the shop assistant, in the shop's own database:
 *
 *  - agent_runs / agent_steps — the audit trail: one run per customer message, with every model
 *    call and tool call, how long it took, tokens used and errors. Customer identifiers are stored
 *    hashed; tool arguments with personal data (name, phone, email, address) are masked.
 *  - agent_conversations — the conversation memory of Telegram / WhatsApp chats, so a restart
 *    (Render sleeping, a deploy) never forgets an order in progress.
 *
 * Tables are created on first use. Nothing here may break the assistant: every write is
 * best-effort and failures are only logged.
 */

type Db = ReturnType<typeof getTenantDb>;

const ready = new WeakMap<object, Promise<void>>();
const RETENTION_DAYS = 90;
let lastCleanup = 0;

async function ensureTables(db: Db) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS agent_runs (
          id uuid PRIMARY KEY,
          channel varchar(20) NOT NULL,
          session_hash varchar(16) NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'running',
          message text NOT NULL,
          reply text,
          error text,
          steps integer NOT NULL DEFAULT 0,
          prompt_tokens integer NOT NULL DEFAULT 0,
          completion_tokens integer NOT NULL DEFAULT 0,
          duration_ms integer,
          started_at timestamp NOT NULL DEFAULT now(),
          finished_at timestamp
        );
        CREATE INDEX IF NOT EXISTS agent_runs_started_idx ON agent_runs (started_at DESC);
        CREATE INDEX IF NOT EXISTS agent_runs_session_idx ON agent_runs (session_hash, started_at DESC);
        CREATE TABLE IF NOT EXISTS agent_steps (
          id serial PRIMARY KEY,
          run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
          step integer NOT NULL,
          kind varchar(10) NOT NULL,
          name varchar(60) NOT NULL,
          input text,
          output text,
          ok boolean NOT NULL DEFAULT true,
          duration_ms integer NOT NULL DEFAULT 0,
          prompt_tokens integer NOT NULL DEFAULT 0,
          completion_tokens integer NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS agent_steps_run_idx ON agent_steps (run_id, step);
        CREATE TABLE IF NOT EXISTS agent_feedback (
          run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
          source varchar(10) NOT NULL,
          rating smallint NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY (run_id, source)
        );
        CREATE TABLE IF NOT EXISTS agent_corrections (
          id serial PRIMARY KEY,
          run_id uuid,
          question text NOT NULL,
          answer text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          created_by varchar(255),
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS agent_conversations (
          session_hash varchar(64) PRIMARY KEY,
          channel varchar(20) NOT NULL,
          turns jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamp NOT NULL DEFAULT now()
        );
      `));
    })();
    pending.catch(() => ready.delete(db));
    ready.set(db, pending);
  }
  await pending;
}

/** Short, stable, non-reversible id for a chat / phone / IP. */
export function hashSession(sessionKey: string, length = 16) {
  return createHash('sha256').update(`agent-session:${sessionKey}`).digest('hex').slice(0, length);
}

const PERSONAL_FIELDS = new Set(['firstName', 'lastName', 'phone', 'email', 'address', 'postalCode', 'contact', 'note']);

/** Tool arguments for the audit trail, with personal data masked. */
export function maskArgs(args: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key, PERSONAL_FIELDS.has(key) && value ? '***' : value]));
}

const clip = (value: unknown, max: number) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

function warn(what: string, error: unknown) {
  console.warn(`[agent-store] ${what}:`, error instanceof Error ? error.message : error);
}

// ------------------------------------------------------------------ audit trail

export type RunStatus = 'completed' | 'fallback' | 'rate_limited' | 'daily_limit' | 'max_steps' | 'failed';

export type RunRecorder = {
  id: string;
  llm(input: { round: number; durationMs: number; promptTokens: number; completionTokens: number; toolCalls: string[]; ok: boolean; error?: string }): void;
  tool(input: { name: string; args: Record<string, unknown>; result: Record<string, unknown>; durationMs: number }): void;
  finish(input: { status: RunStatus; reply: string; error?: string }): Promise<void>;
};

/** Starts the audit of one customer message. Steps are queued and written in order. */
export function startRun(db: Db, input: { channel: string; sessionKey: string; message: string }): RunRecorder {
  const id = randomUUID();
  const started = Date.now();
  let step = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let chain: Promise<unknown> = ensureTables(db)
    .then(() => db.execute(sql`
      INSERT INTO agent_runs (id, channel, session_hash, message)
      VALUES (${id}, ${input.channel}, ${hashSession(input.sessionKey)}, ${clip(input.message, 1500)})`))
    .catch((error) => warn('start run', error));

  const queue = (write: () => Promise<unknown>) => {
    chain = chain.then(write).catch((error) => warn('write step', error));
  };

  return {
    id,
    llm({ round, durationMs, promptTokens: inTokens, completionTokens: outTokens, toolCalls, ok, error }) {
      step += 1;
      promptTokens += inTokens;
      completionTokens += outTokens;
      const n = step;
      queue(() => db.execute(sql`
        INSERT INTO agent_steps (run_id, step, kind, name, input, output, ok, duration_ms, prompt_tokens, completion_tokens)
        VALUES (${id}, ${n}, 'llm', ${`round ${round + 1}`}, NULL,
          ${clip(error ?? (toolCalls.length ? `tools: ${toolCalls.join(', ')}` : 'final answer'), 500)},
          ${ok}, ${Math.round(durationMs)}, ${inTokens}, ${outTokens})`));
    },
    tool({ name, args, result, durationMs }) {
      step += 1;
      const n = step;
      const ok = !(result && typeof result === 'object' && 'ok' in result && result.ok === false);
      queue(() => db.execute(sql`
        INSERT INTO agent_steps (run_id, step, kind, name, input, output, ok, duration_ms)
        VALUES (${id}, ${n}, 'tool', ${clip(name, 60)}, ${clip(maskArgs(args), 800)}, ${clip(result, 1200)}, ${ok}, ${Math.round(durationMs)})`));
    },
    async finish({ status, reply, error }) {
      queue(() => db.execute(sql`
        UPDATE agent_runs SET status = ${status}, reply = ${clip(reply, 3000)}, error = ${error ? clip(error, 500) : null},
          steps = ${step}, prompt_tokens = ${promptTokens}, completion_tokens = ${completionTokens},
          duration_ms = ${Date.now() - started}, finished_at = now()
        WHERE id = ${id}`));
      // Keep the audit trail bounded: drop runs older than the retention period (at most daily).
      if (Date.now() - lastCleanup > 24 * 60 * 60 * 1000) {
        lastCleanup = Date.now();
        queue(() => db.execute(sql`DELETE FROM agent_runs WHERE started_at < now() - make_interval(days => ${RETENTION_DAYS})`));
      }
      await chain;
    },
  };
}

// ------------------------------------------------------------------ conversation memory

const HISTORY_TTL_MINUTES = 24 * 60;

/** Earlier turns of a Telegram / WhatsApp chat (empty when older than a day). */
export async function loadConversation(db: Db, sessionKey: string): Promise<ChatTurn[]> {
  try {
    await ensureTables(db);
    const result = await db.execute(sql`
      SELECT turns FROM agent_conversations
      WHERE session_hash = ${hashSession(sessionKey, 64)}
        AND updated_at > now() - make_interval(mins => ${HISTORY_TTL_MINUTES})`);
    const rows = (result as unknown as { rows?: Array<{ turns: unknown }> }).rows ?? [];
    const turns = rows[0]?.turns;
    return Array.isArray(turns) ? (turns as ChatTurn[]) : [];
  } catch (error) {
    warn('load conversation', error);
    return [];
  }
}

export async function saveConversation(db: Db, sessionKey: string, channel: string, turns: ChatTurn[]) {
  try {
    await ensureTables(db);
    await db.execute(sql`
      INSERT INTO agent_conversations (session_hash, channel, turns, updated_at)
      VALUES (${hashSession(sessionKey, 64)}, ${channel}, ${JSON.stringify(turns)}::jsonb, now())
      ON CONFLICT (session_hash) DO UPDATE SET turns = EXCLUDED.turns, updated_at = now()`);
    if (Math.random() < 0.02) {
      await db.execute(sql`DELETE FROM agent_conversations WHERE updated_at < now() - make_interval(days => 7)`);
    }
  } catch (error) {
    warn('save conversation', error);
  }
}

// ------------------------------------------------------------------ reading (CMS history page)

export type AgentRunRow = {
  id: string;
  channel: string;
  sessionHash: string;
  status: string;
  message: string;
  reply: string | null;
  error: string | null;
  steps: number;
  promptTokens: number;
  completionTokens: number;
  durationMs: number | null;
  startedAt: string;
};

export type AgentStepRow = {
  runId: string;
  step: number;
  kind: string;
  name: string;
  input: string | null;
  output: string | null;
  ok: boolean;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
};

export type AgentSummary = {
  runs: number;
  completed: number;
  fallback: number;
  avgTokens: number;
  avgDurationMs: number;
  orders: number;
};

const rowsOf = <T,>(result: unknown) => ((result as { rows?: T[] }).rows ?? []);

/** Latest runs with their steps, and a 7-day summary, for the CMS. */
export async function readAgentHistory(db: Db, limit = 50) {
  await ensureTables(db);
  const runs = rowsOf<AgentRunRow>(await db.execute(sql`
    SELECT id, channel, session_hash AS "sessionHash", status, message, reply, error, steps,
      prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens", duration_ms AS "durationMs",
      to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "startedAt"
    FROM agent_runs ORDER BY started_at DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}`));
  const ids = runs.map((run) => run.id);
  const steps = ids.length
    ? rowsOf<AgentStepRow>(await db.execute(sql`
        SELECT run_id AS "runId", step, kind, name, input, output, ok, duration_ms AS "durationMs",
          prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens"
        FROM agent_steps WHERE run_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}) ORDER BY run_id, step`))
    : [];
  const [summary] = rowsOf<AgentSummary>(await db.execute(sql`
    SELECT count(*)::int AS runs,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      count(*) FILTER (WHERE status <> 'completed' AND status <> 'running')::int AS fallback,
      coalesce(round(avg(prompt_tokens + completion_tokens)), 0)::int AS "avgTokens",
      coalesce(round(avg(duration_ms)), 0)::int AS "avgDurationMs",
      (SELECT count(*)::int FROM agent_steps s JOIN agent_runs r ON r.id = s.run_id
        WHERE s.kind = 'tool' AND s.name = 'place_order' AND s.ok AND r.started_at > now() - interval '7 days') AS orders
    FROM agent_runs WHERE started_at > now() - interval '7 days'`));
  return { runs, steps, summary: summary ?? { runs: 0, completed: 0, fallback: 0, avgTokens: 0, avgDurationMs: 0, orders: 0 } };
}

// ------------------------------------------------------------------ feedback and corrections
//
// The assistant does not train itself. Instead the shop teaches it: a staff member writes the
// correct answer to a question once (CMS → AI assistant); for any similar question later the
// correction is given to the model as the shop's own guidance, and it becomes a test case
// (scripts/agent-evals.ts). Customers and staff can also rate answers 👍 / 👎.

export type FeedbackSource = 'customer' | 'staff';

/** 👍 (1) or 👎 (-1) for one answer. Customers may only rate recent website answers. */
export async function rateRun(db: Db, runId: string, source: FeedbackSource, rating: 1 | -1) {
  await ensureTables(db);
  const guard = source === 'customer' ? sql`AND channel = 'web' AND started_at > now() - interval '1 day'` : sql``;
  const found = rowsOf<{ id: string }>(await db.execute(sql`SELECT id FROM agent_runs WHERE id = ${runId}::uuid ${guard}`));
  if (found.length === 0) return false;
  await db.execute(sql`
    INSERT INTO agent_feedback (run_id, source, rating) VALUES (${runId}::uuid, ${source}, ${rating})
    ON CONFLICT (run_id, source) DO UPDATE SET rating = EXCLUDED.rating, created_at = now()`);
  return true;
}

export type AgentCorrection = {
  id: number;
  runId: string | null;
  question: string;
  answer: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
};

// Active corrections, cached per database for a minute.
const corrections = new WeakMap<object, { at: number; rows: AgentCorrection[] }>();

export async function saveCorrection(db: Db, input: { runId?: string | null; question: string; answer: string; createdBy?: string | null }) {
  await ensureTables(db);
  const question = input.question.trim().slice(0, 1000);
  const answer = input.answer.trim().slice(0, 3000);
  if (question.length < 3 || answer.length < 3) throw new Error('question-and-answer-required');
  corrections.delete(db);
  if (input.runId) {
    // One correction per answer: writing it again replaces it.
    const existing = rowsOf<{ id: number }>(await db.execute(sql`SELECT id FROM agent_corrections WHERE run_id = ${input.runId}::uuid LIMIT 1`));
    if (existing[0]) {
      await db.execute(sql`UPDATE agent_corrections SET question = ${question}, answer = ${answer}, active = true, updated_at = now() WHERE id = ${existing[0].id}`);
      return existing[0].id;
    }
  }
  const [row] = rowsOf<{ id: number }>(await db.execute(sql`
    INSERT INTO agent_corrections (run_id, question, answer, created_by)
    VALUES (${input.runId ?? null}::uuid, ${question}, ${answer}, ${input.createdBy ?? null}) RETURNING id`));
  return row.id;
}

/** Edits a correction's question and answer (it stays active / inactive as it was). */
export async function updateCorrection(db: Db, id: number, input: { question: string; answer: string }) {
  await ensureTables(db);
  const question = input.question.trim().slice(0, 1000);
  const answer = input.answer.trim().slice(0, 3000);
  if (question.length < 3 || answer.length < 3) throw new Error('question-and-answer-required');
  await db.execute(sql`UPDATE agent_corrections SET question = ${question}, answer = ${answer}, updated_at = now() WHERE id = ${id}`);
  corrections.delete(db);
}

export async function setCorrectionActive(db: Db, id: number, active: boolean) {
  await ensureTables(db);
  await db.execute(sql`UPDATE agent_corrections SET active = ${active}, updated_at = now() WHERE id = ${id}`);
  corrections.delete(db);
}

export async function deleteCorrection(db: Db, id: number) {
  await ensureTables(db);
  await db.execute(sql`DELETE FROM agent_corrections WHERE id = ${id}`);
  corrections.delete(db);
}

export async function listCorrections(db: Db, options: { activeOnly?: boolean } = {}): Promise<AgentCorrection[]> {
  await ensureTables(db);
  return rowsOf<AgentCorrection>(await db.execute(sql`
    SELECT id, run_id AS "runId", question, answer, active, created_by AS "createdBy",
      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "createdAt"
    FROM agent_corrections ${options.activeOnly ? sql`WHERE active` : sql``} ORDER BY created_at DESC LIMIT 500`));
}

const fold = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
const keyWords = (value: string) =>
  new Set(fold(value).split(' ').filter((word) => word.length >= 3).map((word) => (word.length > 5 ? word.slice(0, -2) : word)));
const GUIDANCE_STOP = new Set(['keni', 'kemi', 'per', 'nje', 'cfare', 'cila', 'cilat', 'dua', 'mund', 'eshte', 'jane', 'ndonje', 'liber', 'libra', 'libri']);

/**
 * The shop's corrections that fit this question (at most 2): most of the correction question's key
 * words appear in the message. Semantic search (when on) also matches reworded questions.
 */
export async function findGuidance(db: Db, message: string): Promise<AgentCorrection[]> {
  try {
    let cached = corrections.get(db);
    if (!cached || Date.now() - cached.at > 60_000) {
      cached = { at: Date.now(), rows: await listCorrections(db, { activeOnly: true }) };
      corrections.set(db, cached);
    }
    if (cached.rows.length === 0) return [];
    const asked = [...keyWords(message)];
    const scored = cached.rows.map((row) => {
      const wanted = [...keyWords(row.question)].filter((word) => !GUIDANCE_STOP.has(word));
      const hit = wanted.filter((word) => asked.some((have) => have.startsWith(word) || word.startsWith(have))).length;
      return { row, score: wanted.length ? hit / wanted.length : 0 };
    });
    const { semanticSearchEnabled, similarity } = await import('./knowledge');
    if (semanticSearchEnabled()) {
      for (const entry of scored) {
        const similar = await similarity(message, entry.row.question);
        if (similar !== null && similar >= 0.9) entry.score = Math.max(entry.score, 0.8);
      }
    }
    return scored
      .filter((entry) => entry.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((entry) => entry.row);
  } catch (error) {
    warn('find guidance', error);
    return [];
  }
}

export type AgentReport = {
  unanswered: Array<{ message: string; status: string; at: string }>;
  notFound: Array<{ query: string; times: number }>;
  liked: number;
  disliked: number;
};

/** Last 7 days: questions without a real answer, searches that found nothing, ratings. */
export async function readAgentReport(db: Db): Promise<AgentReport> {
  await ensureTables(db);
  const unanswered = rowsOf<{ message: string; status: string; at: string }>(await db.execute(sql`
    SELECT left(message, 200) AS message, status, to_char(started_at, 'YYYY-MM-DD HH24:MI') AS at FROM agent_runs
    WHERE status NOT IN ('completed', 'running') AND started_at > now() - interval '7 days'
    ORDER BY started_at DESC LIMIT 15`));
  const notFound = rowsOf<{ query: string; times: number }>(await db.execute(sql`
    SELECT coalesce(input::jsonb ->> 'query', input) AS query, count(*)::int AS times
    FROM agent_steps s JOIN agent_runs r ON r.id = s.run_id
    WHERE s.kind = 'tool' AND s.name = 'search_products' AND s.output LIKE '{"products":[]%'
      AND r.started_at > now() - interval '7 days'
    GROUP BY 1 ORDER BY times DESC, query LIMIT 15`).catch(() => ({ rows: [] })));
  const [ratings] = rowsOf<{ liked: number; disliked: number }>(await db.execute(sql`
    SELECT count(*) FILTER (WHERE rating > 0)::int AS liked, count(*) FILTER (WHERE rating < 0)::int AS disliked
    FROM agent_feedback WHERE created_at > now() - interval '7 days'`));
  return { unanswered, notFound, liked: ratings?.liked ?? 0, disliked: ratings?.disliked ?? 0 };
}

/** Ratings and corrections of the listed runs (for the CMS history). */
export async function readRunExtras(db: Db, runIds: string[]) {
  await ensureTables(db);
  if (runIds.length === 0) return { feedback: [], corrections: [] };
  const ids = sql.join(runIds.map((id) => sql`${id}::uuid`), sql`, `);
  const feedback = rowsOf<{ runId: string; source: FeedbackSource; rating: number }>(await db.execute(sql`
    SELECT run_id AS "runId", source, rating FROM agent_feedback WHERE run_id IN (${ids})`));
  const fixes = rowsOf<{ runId: string; id: number; answer: string; active: boolean }>(await db.execute(sql`
    SELECT run_id AS "runId", id, answer, active FROM agent_corrections WHERE run_id IN (${ids})`));
  return { feedback, corrections: fixes };
}
