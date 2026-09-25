import { mkdir, appendFile } from 'fs/promises';
import path from 'path';

export type AppLogLevel = 'info' | 'warn' | 'error';

const DEFAULT_LOG_FILE_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  'logs',
  'app.log',
);
const CONFIGURED_LOG_FILE_PATH = process.env.APP_LOG_FILE
  ? path.resolve(/*turbopackIgnore: true*/ process.env.APP_LOG_FILE)
  : DEFAULT_LOG_FILE_PATH;
const logFilePath = CONFIGURED_LOG_FILE_PATH;
let logDirReady: Promise<string | undefined> | null = null;

async function ensureLogDir() {
  if (!logDirReady) {
    logDirReady = mkdir(path.dirname(logFilePath), { recursive: true });
  }

  return logDirReady;
}

function normalizeMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      normalized[key] = {
        message: value.message,
        stack: value.stack,
      };
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

async function writeLog(level: AppLogLevel, message: string, meta?: Record<string, unknown>) {
  try {
    await ensureLogDir();
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      meta: normalizeMeta(meta),
    };
    await appendFile(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.error('[AppLog Error]', error);
  }
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  return writeLog('info', message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  return writeLog('warn', message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>) {
  return writeLog('error', message, meta);
}
