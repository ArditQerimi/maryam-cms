/**
 * Server-only theme resolution for the storefront.
 *
 * `getStorefrontTheme` merges the persisted `theme_settings` row for a company
 * over the active theme's `theme.json` defaults, and `buildThemeCss` turns the
 * result into the `<style>` block injected by `src/app/home/layout.tsx`.
 */

import { eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { themeSettings } from '@/db/schema-tenant';
import { DEFAULT_THEME_ID, getTheme } from './themes';
import { fontStack, googleFontsImport, sanitizeFontName } from './fonts';
import { mergeCustomizations, type ThemeColors, type ThemeCustomizations } from './types';

export type StorefrontTheme = {
  colors: ThemeColors;
  fonts: { heading: string; body: string; baseSize: number };
  customizations: ThemeCustomizations;
  /** Active theme id (falls back to the default theme). */
  id: string;
  /** Optional `styles.css` shipped with the active theme. */
  css?: string;
};

/** Matches the untouched shop palette so a missing theme row changes nothing. */
const FALLBACK_COLORS: ThemeColors = {
  primary: '#ff9f43',
  secondary: '#0f1720',
  background: '#ffffff',
  surface: '#f1efec',
  text: '#1a202c',
  accent: '#ff9f43',
};

const FALLBACK_FONT = 'Spectral';

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

function safeBaseSize(value: unknown, fallback = 16): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 12 && parsed <= 20 ? parsed : fallback;
}

/**
 * Read `theme_settings` for a company and merge saved customizations over the
 * active theme defaults. Never throws for a missing/broken row — callers still
 * wrap this with `.catch(() => null)`.
 */
export async function getStorefrontTheme(companyId: number): Promise<StorefrontTheme> {
  const db = await getContextDb();
  const [row] = await db
    .select()
    .from(themeSettings)
    .where(eq(themeSettings.companyId, companyId))
    .limit(1);

  const themeId = row?.activeTheme || DEFAULT_THEME_ID;
  const base = getTheme(themeId) ?? getTheme(DEFAULT_THEME_ID);
  const fallback = getTheme(DEFAULT_THEME_ID);

  const palette = base?.colors ?? fallback?.colors ?? FALLBACK_COLORS;
  const fonts = base?.fonts ?? fallback?.fonts ?? {
    heading: FALLBACK_FONT,
    body: FALLBACK_FONT,
  };

  const customizations = mergeCustomizations(
    { colors: palette, fonts },
    row ? (row.customizations as unknown) : {},
  );

  return {
    colors: customizations.colors,
    fonts: customizations.fonts,
    customizations,
    id: base?.id ?? DEFAULT_THEME_ID,
    css: base?.css,
  };
}

/**
 * Build the CSS injected into the storefront: Google Fonts import, the
 * `:root { --cms-* }` custom properties and the scoped rules that actually
 * apply them to the existing `.shopWrapper`.
 *
 * Always emits the block (with fallback values when `theme` is null) so the
 * customizer's live preview has variables to overwrite without a reload.
 */
export function buildThemeCss(theme: StorefrontTheme | null): string {
  const colors: ThemeColors = theme ? theme.colors : FALLBACK_COLORS;
  const headingName = sanitizeFontName(theme?.fonts.heading ?? FALLBACK_FONT, FALLBACK_FONT);
  const bodyName = sanitizeFontName(theme?.fonts.body ?? FALLBACK_FONT, FALLBACK_FONT);
  const baseSize = safeBaseSize(theme?.fonts.baseSize, 16);

  const root = [
    `--cms-primary: ${safeColor(colors.primary, FALLBACK_COLORS.primary)}`,
    `--cms-secondary: ${safeColor(colors.secondary, FALLBACK_COLORS.secondary)}`,
    `--cms-background: ${safeColor(colors.background, FALLBACK_COLORS.background)}`,
    `--cms-surface: ${safeColor(colors.surface, FALLBACK_COLORS.surface)}`,
    `--cms-text: ${safeColor(colors.text, FALLBACK_COLORS.text)}`,
    `--cms-accent: ${safeColor(colors.accent, FALLBACK_COLORS.accent)}`,
    `--cms-heading-font: ${fontStack(headingName, FALLBACK_FONT)}`,
    `--cms-body-font: ${fontStack(bodyName, FALLBACK_FONT)}`,
    `--cms-base-size: ${baseSize}px`,
  ].join(';');

  return [
    googleFontsImport(headingName, bodyName),
    `:root { ${root}; }`,
    `.shopWrapper.shopWrapper {
  font-family: var(--cms-body-font);
  font-size: var(--cms-base-size, 1rem);
  background: var(--cms-background);
  color: var(--cms-text);
}`,
    `.shopWrapper.shopWrapper h1, .shopWrapper.shopWrapper h2, .shopWrapper.shopWrapper h3, .shopWrapper.shopWrapper h4, .shopWrapper.shopWrapper h5, .shopWrapper.shopWrapper h6 {
  font-family: var(--cms-heading-font);
  color: var(--cms-text);
}`,
    theme?.css ? `/* theme: ${theme.id} */\n${theme.css}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Convenience: the merged customizations for a company (used by admin pages). */
export async function getCompanyCustomizations(companyId: number): Promise<ThemeCustomizations> {
  const theme = await getStorefrontTheme(companyId);
  return theme.customizations;
}
