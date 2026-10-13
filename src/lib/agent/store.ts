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
