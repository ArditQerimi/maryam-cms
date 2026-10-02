/**
 * Normalise text for shop search: lower case, accents removed (ë → e, ç → c),
 * punctuation turned into spaces, whitespace collapsed. Used on both the query
 * and the product text so "nektar", "Nektari" and "NEKTARI" all match.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
