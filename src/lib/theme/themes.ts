/**
 * Filesystem-backed theme registry.
 *
 * Themes live in `src/themes/<id>/theme.json` (+ `styles.css`). The loaders are
 * synchronous `node:fs` reads — only ever call them from server code (server
 * components or server actions), never from a client component.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ThemeColorKey, ThemeColors, ThemeDefinition } from './types';

export type { ThemeDefinition };

export const DEFAULT_THEME_ID = 'minimal';

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,60}$/;
const COLOR_KEYS: readonly ThemeColorKey[] = [
  'primary',
  'secondary',
  'background',
  'surface',
  'text',
  'accent',
];

function themesRoot(): string {
  return path.join(process.cwd(), 'src', 'themes');
}

/** Never touch `node:fs` in a browser bundle. */
function isServer(): boolean {
  return typeof window === 'undefined';
}

function sanitizeTheme(raw: unknown, fallbackId: string): ThemeDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const id =
    typeof record.id === 'string' && THEME_ID_PATTERN.test(record.id) ? record.id : fallbackId;
  const colorsRaw = (
    record.colors && typeof record.colors === 'object' ? record.colors : {}
  ) as Record<string, unknown>;
  const fontsRaw = (
    record.fonts && typeof record.fonts === 'object' ? record.fonts : {}
  ) as Record<string, unknown>;

  const colors = {} as ThemeColors;
  for (const key of COLOR_KEYS) {
    const value = colorsRaw[key];
    colors[key] =
      typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())
        ? value.trim()
        : '#000000';
  }

  return {
    id,
    name: typeof record.name === 'string' ? record.name : id,
    version: typeof record.version === 'string' ? record.version : '1.0.0',
    description: typeof record.description === 'string' ? record.description : '',
    screenshot:
      typeof record.screenshot === 'string' && record.screenshot.startsWith('/')
        ? record.screenshot
        : `/themes/${id}/screenshot.svg`,
    colors,
    fonts: {
      heading:
        typeof fontsRaw.heading === 'string' && fontsRaw.heading.trim()
          ? fontsRaw.heading.trim()
          : 'Inter',
      body:
        typeof fontsRaw.body === 'string' && fontsRaw.body.trim()
          ? fontsRaw.body.trim()
          : 'Inter',
    },
  };
}

function readThemeDir(id: string | null | undefined): ThemeDefinition | null {
  if (!isServer() || typeof id !== 'string' || !THEME_ID_PATTERN.test(id)) return null;
  try {
    const dir = path.join(themesRoot(), id);
    const raw = readFileSync(path.join(dir, 'theme.json'), 'utf8');
    const theme = sanitizeTheme(JSON.parse(raw) as unknown, id);
    if (!theme) return null;
    try {
      theme.css = readFileSync(path.join(dir, 'styles.css'), 'utf8');
    } catch {
      theme.css = '';
    }
    return theme;
  } catch {
    return null;
  }
}

/** All themes installed in `src/themes` — never throws, returns `[]` on failure. */
export function getAvailableThemes(): ThemeDefinition[] {
  if (!isServer()) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(themesRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  return entries
    .map((id) => readThemeDir(id))
    .filter((theme): theme is ThemeDefinition => Boolean(theme))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One theme by id, or `null` when it does not exist / cannot be read. */
export function getTheme(id: string | null | undefined): ThemeDefinition | null {
  return readThemeDir(id);
}

/** The requested theme, falling back to the default theme, then to `null`. */
export function getActiveTheme(id: string | null | undefined): ThemeDefinition | null {
  const requested = typeof id === 'string' && id ? id : DEFAULT_THEME_ID;
  return readThemeDir(requested) ?? readThemeDir(DEFAULT_THEME_ID);
}

/** Raw `styles.css` of a theme (empty string when missing). */
export function getThemeStyles(id: string | null | undefined): string {
  if (!isServer() || typeof id !== 'string' || !THEME_ID_PATTERN.test(id)) return '';
  try {
    return readFileSync(path.join(themesRoot(), id, 'styles.css'), 'utf8');
  } catch {
    return '';
  }
}
