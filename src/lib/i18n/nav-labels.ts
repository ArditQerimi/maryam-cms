/**
 * Localized wording for the CMS navigation menus.
 *
 * Menu labels are merchant content - the admin types them into
 * `settings_store.nav_menus`, so the storefront renders them verbatim. These
 * are the seeded English defaults ("Home", "Books", "Journal" .): while the
 * stored label still matches one, the dictionary supplies the localized text;
 * anything the merchant renamed stays exactly as written in every locale.
 *
 * Matching is case- and whitespace-insensitive so "About Us" and "about us"
 * both resolve. There is deliberately no URL fallback - a custom label on a
 * default route must never be overwritten.
 */
import type { Dictionary } from './dictionaries/en';

type DictKey = keyof Dictionary;

const NAV_LABEL_KEYS: Record<string, DictKey> = {
  home: 'header.navlabel.home',
  books: 'header.navlabel.books',
  'new arrivals': 'header.navlabel.new_arrivals',
  journal: 'header.navlabel.journal',
  'about us': 'header.navlabel.about',
  contact: 'header.navlabel.contact',
  faqs: 'header.navlabel.faqs',
  terms: 'header.navlabel.terms',
};

/** Dictionary key for a stored menu label, or `null` to keep it as written. */
export function navLabelKey(label: string): DictKey | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return NAV_LABEL_KEYS[normalized] ?? null;
}
