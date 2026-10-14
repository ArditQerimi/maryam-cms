import { eq, inArray } from 'drizzle-orm';
import { settingsStore } from '@/db/schema-tenant';
import type { getTenantDb } from '@/db/index';
import { cloudSend, cloudSendText, CloudApiError, type CloudConfig } from './whatsapp-cloud';

/*
 * Welcome message to a short list of numbers (the Meta test number's allowed recipients, or a few
 * customers). WhatsApp allows free text only within 24h of the person’s last message; anyone else
 * gets an approved template (Meta's "hello_world" until the shop has its own). Meta does not expose
 * the test number's recipient list, so the webhook keeps who wrote to the shop (50 numbers, 30 days):
 * that fills the list by itself and gives each number's 24h window.
 */

type Db = ReturnType<typeof getTenantDb>;

export const WELCOME_KEYS = {
  numbers: 'whatsapp_welcome_numbers',
  text: 'whatsapp_welcome_text',
  template: 'whatsapp_welcome_template',
  language: 'whatsapp_welcome_language',
  lastInbound: 'whatsapp_welcome_last_inbound',
  auto: 'whatsapp_welcome_auto',
} as const;

export const MAX_WELCOME_NUMBERS = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Who wrote to the shop is kept 30 days, at most 50 numbers (fills the welcome list by itself). */
const KEEP_MS = 30 * WINDOW_MS;
const MAX_KNOWN = 50;

export const defaultWelcomeText = (shop: string) =>
  `Mirë se vini në ${shop}! 📚\nUnë jam asistenti i dyqanit: më shkruani çfarë libri kërkoni, pyetni për çmime ose dërgesë, ose porositni direkt këtu.`;

/** auto: a number that writes to the shop for the first time (in 30 days) gets the text before the answer. */
export type WelcomeSettings = { numbers: string[]; text: string; template: string; language: string; auto: boolean };

export type WelcomeResult = { to: string; ok: boolean; via: 'text' | 'template'; error?: string };

const digits = (value: string) => value.replace(/\D/g, '').replace(/^00/, '');

/** One number per line / comma; only valid international numbers, no duplicates. */
export function parseNumbers(raw: string) {
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const number = digits(trimmed);
    if (/^\d{8,15}$/.test(number)) seen.add(number);
    else invalid.push(trimmed);
  }
  return { numbers: [...seen], invalid };
}

function parse(raw: string | undefined) {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function readAll(db: Db) {
  const rows = await db
    .select({ key: settingsStore.key, value: settingsStore.value })
    .from(settingsStore)
    .where(inArray(settingsStore.key, Object.values(WELCOME_KEYS)));
  return new Map(rows.map((row) => [row.key, parse(row.value)]));
}

async function write(db: Db, key: string, value: unknown) {
  const json = JSON.stringify(value);
  const updated = await db
    .update(settingsStore)
    .set({ value: json, updatedAt: new Date() })
    .where(eq(settingsStore.key, key))
    .returning({ id: settingsStore.id });
  if (updated.length === 0) await db.insert(settingsStore).values({ key, value: json });
}

export async function loadWelcomeSettings(db: Db, shop: string): Promise<WelcomeSettings> {
  const saved = await readAll(db).catch(() => new Map<string, unknown>());
  const numbers = saved.get(WELCOME_KEYS.numbers);
  const text = saved.get(WELCOME_KEYS.text);
  const template = saved.get(WELCOME_KEYS.template);
  const language = saved.get(WELCOME_KEYS.language);
  const auto = saved.get(WELCOME_KEYS.auto);
  return {
    numbers: Array.isArray(numbers) ? numbers.filter((value): value is string => typeof value === 'string') : [],
    text: typeof text === 'string' && text.trim() ? text : defaultWelcomeText(shop),
    template: typeof template === 'string' ? template : '',
    language: typeof language === 'string' && language ? language : 'sq',
    auto: auto === 'on',
  };
}

export async function saveWelcomeSettings(db: Db, input: WelcomeSettings) {
  await write(db, WELCOME_KEYS.numbers, input.numbers);
  await write(db, WELCOME_KEYS.text, input.text);
  await write(db, WELCOME_KEYS.template, input.template);
  await write(db, WELCOME_KEYS.language, input.language);
  await write(db, WELCOME_KEYS.auto, input.auto ? 'on' : 'off');
}

async function lastInbound(db: Db): Promise<Record<string, string>> {
  const saved = (await readAll(db).catch(() => new Map<string, unknown>())).get(WELCOME_KEYS.lastInbound);
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, string>) : {};
}

/**
 * Webhook: remember when a number last wrote (the 50 most recent, for 30 days). Returns true when
 * the number had not written in that time (a new tester / customer).
 */
export async function noteWelcomeInbound(db: Db, from: string) {
  if (!/^\d{8,15}$/.test(from)) return false;
  const seen = await lastInbound(db);
  const cutoff = Date.now() - KEEP_MS;
  const isNew = !(Date.parse(seen[from] ?? '') > cutoff);
  const kept = Object.entries({ ...seen, [from]: new Date().toISOString() })
    .filter(([, at]) => Date.parse(at) > cutoff)
    .sort(([, left], [, right]) => right.localeCompare(left))
    .slice(0, MAX_KNOWN);
  await write(db, WELCOME_KEYS.lastInbound, Object.fromEntries(kept)).catch(() => undefined);
  return isNew;
}

/** Numbers that wrote to the shop in the last 30 days, most recent first. */
export async function knownNumbers(db: Db) {
  const cutoff = Date.now() - KEEP_MS;
  return Object.entries(await lastInbound(db))
    .filter(([, at]) => Date.parse(at) > cutoff)
    .sort(([, left], [, right]) => right.localeCompare(left))
    .map(([number]) => number);
}

function describe(error: unknown) {
  if (error instanceof CloudApiError) {
    if (error.code === 131030) return 'notAllowed';
    if (error.code === 190 || error.status === 401) return 'badToken';
    if (error.code === 132001) return 'noTemplate';
    return `${error.code ?? error.status}: ${error.metaMessage}`.slice(0, 160);
  }
  return error instanceof Error ? error.message.slice(0, 160) : 'unknown';
}

/** Sends the welcome to every saved number: text inside the 24h window, otherwise the template. */
export async function sendWelcome(db: Db, config: CloudConfig, settings: WelcomeSettings): Promise<WelcomeResult[]> {
  const seen = await lastInbound(db);
  const template = settings.template.trim() || 'hello_world';
  const language = settings.template.trim() ? settings.language : 'en_US';
  const results: WelcomeResult[] = [];
  for (const to of settings.numbers) {
    const wrote = Date.parse(seen[to] ?? '');
    const insideWindow = Number.isFinite(wrote) && Date.now() - wrote < WINDOW_MS - 5 * 60_000;
    try {
      if (insideWindow) await cloudSendText(config, to, settings.text);
      else await cloudSend(config, { to, type: 'template', template: { name: template, language: { code: language } } });
      results.push({ to, ok: true, via: insideWindow ? 'text' : 'template' });
    } catch (error) {
      results.push({ to, ok: false, via: insideWindow ? 'text' : 'template', error: describe(error) });
    }
  }
  return results;
}
