/**
 * Curated Google Fonts offered in the customizer.
 * Client-safe: no Node/browser APIs, no DB access.
 * Every family listed here ships both a 400 and a 700 weight so the
 * Google Fonts css2 request below always resolves.
 */
export const GOOGLE_FONTS: string[] = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'Nunito Sans',
  'Source Sans 3',
  'Work Sans',
  'Mulish',
  'Manrope',
  'Rubik',
  'Karla',
  'DM Sans',
  'Space Grotesk',
  'IBM Plex Sans',
  'Playfair Display',
  'Merriweather',
  'Libre Baskerville',
  'Cormorant Garamond',
  'EB Garamond',
  'Spectral',
  'PT Serif',
  'Roboto Slab',
  'Oswald',
  'Archivo',
  'Barlow',
  'Figtree',
];

/** Strip anything that is not a plausible font-family token. */
export function sanitizeFontName(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 60) return fallback;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ,'-]*$/.test(raw)) return fallback;
  return raw;
}

/** `Playfair Display` → `Playfair+Display` (safe inside a css2 family token). */
function familyToken(name: string): string {
  return encodeURIComponent(name.trim()).replace(/%20/g, '+');
}

/**
 * Full CSS font stack for a family: `"Inter", "Spectral", Georgia, serif`.
 * Used for the `--cms-heading-font` / `--cms-body-font` custom properties.
 */
export function fontStack(name: string, fallback = 'sans-serif'): string {
  const primary = sanitizeFontName(name, '');
  const backup = sanitizeFontName(fallback, '');
  const quoted = [primary, backup]
    .filter(Boolean)
    .map((family) => `"${family.replace(/"/g, '')}"`);
  return [...quoted, 'Georgia', 'serif'].join(', ');
}

/** First rule of the injected stylesheet: `@import url('…fonts.googleapis…');` */
export function googleFontsImport(
  ...families: Array<string | null | undefined>
): string {
  const url = googleFontsUrl(families);
  return url ? `@import url('${url}');` : '';
}

/**
 * Build a Google Fonts css2 URL for the selected families.
 * Only the curated weight pairs are requested (400 + 700) so the URL never
 * 400s on families that do not ship 500/600.
 */
export function googleFontsUrl(families: Array<string | null | undefined>): string {
  const unique = Array.from(
    new Set(
      families
        .map((name) => sanitizeFontName(name, ''))
        .filter(Boolean),
    ),
  );
  if (!unique.length) return '';
  const query = unique.map((name) => `family=${familyToken(name)}:wght@400;700`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
