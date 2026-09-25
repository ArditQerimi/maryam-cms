/**
 * Shared, client-safe types for the appearance module
 * (customizer, menus, widgets), the server actions in
 * `src/app/cms/actions/theme.ts` and the storefront theme applier.
 */

import { sanitizeFontName } from './fonts';

/* -------------------------------------------------------------------------- */
/* Themes                                                                      */
/* -------------------------------------------------------------------------- */

export type ThemeColorKey =
  | 'primary'
  | 'secondary'
  | 'background'
  | 'surface'
  | 'text'
  | 'accent';

export type ThemeColors = Record<ThemeColorKey, string>;

export const THEME_COLOR_KEYS: readonly ThemeColorKey[] = [
  'primary',
  'secondary',
  'background',
  'surface',
  'text',
  'accent',
];

export type ThemeFonts = {
  heading: string;
  body: string;
};

/** Shape of `src/themes/<id>/theme.json`. */
export type ThemeDefinition = {
  id: string;
  name: string;
  version: string;
  description: string;
  screenshot: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  /** Contents of the theme's `styles.css` (optional). */
  css?: string;
};

/** Minimal input accepted by `mergeCustomizations`. */
export type ThemeDefaults = Pick<ThemeDefinition, 'colors' | 'fonts'>;

/* -------------------------------------------------------------------------- */
/* Customizer payload (stored in `theme_settings.customizations`)              */
/* -------------------------------------------------------------------------- */

export type NavStyle = 'standard' | 'centered' | 'minimal';
export type HeaderBackgroundMode = 'transparent' | 'white' | 'custom';

export type HeaderCustomizations = {
  logo: string;
  siteName: string;
  tagline: string;
  navStyle: NavStyle;
  showSearch: boolean;
  showCart: boolean;
  headerBgMode: HeaderBackgroundMode;
  headerBgColor: string;
};

export type FooterLink = {
  label: string;
  url: string;
};

export type FooterColumn = {
  title: string;
  links: FooterLink[];
};

export type FooterCustomizations = {
  columns: number;
  copyright: string;
  background: string;
  items: FooterColumn[];
};

export type HomepageSections = {
  hero: boolean;
  featured: boolean;
  categories: boolean;
  latestPosts: boolean;
  testimonials: boolean;
  stats: boolean;
};

/** One slide of the storefront hero carousel. An empty list makes the
 *  storefront fall back to auto-deriving slides from the newest products. */
export type HeroSlide = {
  id: string;
  image: string;
  category: string;
  title: string;
  price: string;
  url: string;
  /** Primary button label; empty falls back to the storefront default. */
  ctaLabel: string;
};

export type HeroLayout = 'image-right' | 'image-left' | 'image-full';
export type HeroHeight = 'compact' | 'standard' | 'full';
export type HeroTextAlign = 'left' | 'center';

export const HERO_LAYOUTS: readonly HeroLayout[] = ['image-right', 'image-left', 'image-full'];
export const HERO_HEIGHTS: readonly HeroHeight[] = ['compact', 'standard', 'full'];
export const HERO_TEXT_ALIGNS: readonly HeroTextAlign[] = ['left', 'center'];

export type HomepageCustomizations = {
  sections: HomepageSections;
  heroSlides: HeroSlide[];
  /** Secondary hero button — shared by every slide. Empty uses the defaults. */
  heroSecondaryLabel: string;
  heroSecondaryUrl: string;
  /* Hero presentation — all shared by every slide. Empty colours mean "theme default". */
  heroLayout: HeroLayout;
  heroHeight: HeroHeight;
  heroTextAlign: HeroTextAlign;
  heroBackground: string;
  heroTextColor: string;
  heroOverlayColor: string;
  /** 0–100, applied to heroOverlayColor over the image. */
  heroOverlayOpacity: number;
  heroAutoplay: boolean;
  /** Seconds between slides, 3–15. */
  heroIntervalSeconds: number;
  heroImage: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  ctaUrl: string;
};

/** Typography selection stored with the customizations. */
export type CustomFonts = ThemeFonts & { baseSize: number };

/** Everything stored in `theme_settings.customizations` (jsonb). */
export type ThemeCustomizations = {
  colors: ThemeColors;
  fonts: CustomFonts;
  header: HeaderCustomizations;
  footer: FooterCustomizations;
  homepage: HomepageCustomizations;
};

export const DEFAULT_HEADER: HeaderCustomizations = {
  logo: '',
  siteName: '',
  tagline: '',
  navStyle: 'standard',
  showSearch: true,
  showCart: true,
  headerBgMode: 'white',
  headerBgColor: '#ffffff',
};

const emptyColumn = (): FooterColumn => ({ title: '', links: [] });

export const DEFAULT_FOOTER: FooterCustomizations = {
  columns: 3,
  copyright: '',
  background: '',
  items: [emptyColumn(), emptyColumn(), emptyColumn(), emptyColumn()],
};

export const DEFAULT_HOMEPAGE: HomepageCustomizations = {
  sections: {
    hero: true,
    featured: true,
    categories: true,
    latestPosts: true,
    testimonials: true,
    stats: true,
  },
  heroSlides: [],
  heroSecondaryLabel: '',
  heroSecondaryUrl: '',
  heroLayout: 'image-right',
  heroHeight: 'standard',
  heroTextAlign: 'left',
  heroBackground: '',
  heroTextColor: '',
  heroOverlayColor: '#000000',
  heroOverlayOpacity: 35,
  heroAutoplay: true,
  heroIntervalSeconds: 5,
  heroImage: '',
  heroTitle: '',
  heroSubtitle: '',
  ctaText: 'Shop now',
  ctaUrl: '/shop/products',
};

const EMPTY_COLORS: ThemeColors = {
  primary: '',
  secondary: '',
  background: '',
  surface: '',
  text: '',
  accent: '',
};

export const DEFAULT_CUSTOMIZATIONS: ThemeCustomizations = {
  colors: { ...EMPTY_COLORS },
  fonts: { heading: '', body: '', baseSize: 16 },
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
  homepage: DEFAULT_HOMEPAGE,
};

/* -------------------------------------------------------------------------- */
/* Navigation menus                                                            */
/* -------------------------------------------------------------------------- */

export type NavMenuLocation = 'primary' | 'footer' | 'mobile';

export const MENU_LOCATIONS: Array<{ value: NavMenuLocation; label: string }> = [
  { value: 'primary', label: 'Primary Navigation' },
  { value: 'footer', label: 'Footer Menu' },
  { value: 'mobile', label: 'Mobile Menu' },
];

/** Alias kept for the menu builder UI (`NAV_MENU_LOCATIONS`). */
export const NAV_MENU_LOCATIONS: Array<{ value: NavMenuLocation; label: string }> = MENU_LOCATIONS;

/** One row of a navigation menu. `depth` is 0 (top level) or 1 (one submenu level). */
export type NavMenuItem = {
  id: string;
  label: string;
  url: string;
  depth: 0 | 1;
};

export type NamedMenu = {
  items: NavMenuItem[];
  location: NavMenuLocation;
};

/** Stored in `settings_store` key `nav_menus`, keyed by menu name. */
export type NavMenus = Record<string, NamedMenu>;

/* -------------------------------------------------------------------------- */
/* Widgets                                                                     */
/* -------------------------------------------------------------------------- */

export const WIDGET_TYPES = [
  'recent-posts',
  'recent-products',
  'categories',
  'text',
  'newsletter',
  'social',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  'recent-posts': 'Recent posts',
  'recent-products': 'Recent products',
  categories: 'Categories',
  text: 'Text / HTML',
  newsletter: 'Newsletter signup',
  social: 'Social links',
};

export const WIDGET_AREAS = ['sidebar', 'homepage', 'footer'] as const;

export type WidgetAreaKey = (typeof WIDGET_AREAS)[number];

export const WIDGET_AREA_META: Array<{ value: WidgetAreaKey; label: string; description: string }> = [
  {
    value: 'sidebar',
    label: 'Sidebar',
    description: 'Shown next to blog and category listings.',
  },
  {
    value: 'homepage',
    label: 'Homepage',
    description: 'Shown alongside the front page content.',
  },
  {
    value: 'footer',
    label: 'Footer',
    description: 'Shown in the footer band of every page.',
  },
];

export type WidgetSettings = {
  title: string;
  limit: number;
  /** Raw HTML — only used by the Text/HTML widget. */
  html: string;
  /** Label + URL pairs — used by the Social links widget. */
  links: FooterLink[];
};

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  settings: WidgetSettings;
};

/** Stored in `settings_store` key `widgets`. */
export type WidgetLayout = Record<WidgetAreaKey, WidgetInstance[]>;

export const EMPTY_WIDGET_LAYOUT: WidgetLayout = {
  sidebar: [],
  homepage: [],
  footer: [],
};

/* -------------------------------------------------------------------------- */
/* Normalizers (safe against malformed jsonb)                                  */
/* -------------------------------------------------------------------------- */

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHeader(value: unknown): HeaderCustomizations {
  const raw = asRecord(value) ?? {};
  const navStyle = asString(raw.navStyle, DEFAULT_HEADER.navStyle);
  const headerBgMode = asString(raw.headerBgMode, DEFAULT_HEADER.headerBgMode);
  return {
    ...DEFAULT_HEADER,
    logo: asString(raw.logo, DEFAULT_HEADER.logo),
    siteName: asString(raw.siteName, DEFAULT_HEADER.siteName),
    tagline: asString(raw.tagline, DEFAULT_HEADER.tagline),
    navStyle: (['standard', 'centered', 'minimal'] as const).includes(navStyle as NavStyle)
      ? (navStyle as NavStyle)
      : DEFAULT_HEADER.navStyle,
    showSearch: asBool(raw.showSearch, DEFAULT_HEADER.showSearch),
    showCart: asBool(raw.showCart, DEFAULT_HEADER.showCart),
    headerBgMode: (['transparent', 'white', 'custom'] as const).includes(
      headerBgMode as HeaderBackgroundMode,
    )
      ? (headerBgMode as HeaderBackgroundMode)
      : DEFAULT_HEADER.headerBgMode,
    headerBgColor: asString(raw.headerBgColor, DEFAULT_HEADER.headerBgColor),
  };
}

function normalizeFooter(value: unknown): FooterCustomizations {
  const raw = asRecord(value) ?? {};
  const columns = Math.min(4, Math.max(1, Math.round(asNumber(raw.columns, DEFAULT_FOOTER.columns))));
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: FooterColumn[] = [];
  for (let index = 0; index < 4; index += 1) {
    const column = asRecord(rawItems[index]);
    if (!column) {
      items.push(emptyColumn());
      continue;
    }
    const links = Array.isArray(column.links) ? column.links : [];
    items.push({
      title: asString(column.title, ''),
      links: links
        .map((link) => {
          const record = asRecord(link);
          if (!record) return null;
          return { label: asString(record.label, ''), url: asString(record.url, '') };
        })
        .filter((link): link is FooterLink => Boolean(link)),
    });
  }
  return {
    columns,
    copyright: asString(raw.copyright, DEFAULT_FOOTER.copyright),
    background: asString(raw.background, DEFAULT_FOOTER.background),
    items,
  };
}

function asHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normalizeHeroSlides(value: unknown): HeroSlide[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((entry, index) => {
      const row = asRecord(entry);
      if (!row) return null;
      return {
        id: asString(row.id, `slide-${index}-${Date.now().toString(36)}`),
        image: asString(row.image, '').slice(0, 2000),
        category: asString(row.category, '').slice(0, 80),
        title: asString(row.title, '').slice(0, 200),
        price: asString(row.price, '').slice(0, 40),
        url: asString(row.url, '').slice(0, 2000),
        ctaLabel: asString(row.ctaLabel, '').slice(0, 60),
      };
    })
    .filter((slide): slide is HeroSlide => Boolean(slide))
    .slice(0, 8);
}

function normalizeHomepage(value: unknown): HomepageCustomizations {
  const raw = asRecord(value) ?? {};
  const sections = asRecord(raw.sections) ?? {};
  return {
    sections: {
      hero: asBool(sections.hero, DEFAULT_HOMEPAGE.sections.hero),
      featured: asBool(sections.featured, DEFAULT_HOMEPAGE.sections.featured),
      categories: asBool(sections.categories, DEFAULT_HOMEPAGE.sections.categories),
      latestPosts: asBool(sections.latestPosts, DEFAULT_HOMEPAGE.sections.latestPosts),
      testimonials: asBool(sections.testimonials, DEFAULT_HOMEPAGE.sections.testimonials),
      stats: asBool(sections.stats, DEFAULT_HOMEPAGE.sections.stats),
    },
    heroSlides: normalizeHeroSlides(raw.heroSlides),
    heroSecondaryLabel: asString(raw.heroSecondaryLabel, DEFAULT_HOMEPAGE.heroSecondaryLabel).slice(0, 60),
    heroSecondaryUrl: asString(raw.heroSecondaryUrl, DEFAULT_HOMEPAGE.heroSecondaryUrl).slice(0, 2000),
    heroLayout: asEnum(raw.heroLayout, HERO_LAYOUTS, DEFAULT_HOMEPAGE.heroLayout),
    heroHeight: asEnum(raw.heroHeight, HERO_HEIGHTS, DEFAULT_HOMEPAGE.heroHeight),
    heroTextAlign: asEnum(raw.heroTextAlign, HERO_TEXT_ALIGNS, DEFAULT_HOMEPAGE.heroTextAlign),
    heroBackground: asHex(raw.heroBackground, DEFAULT_HOMEPAGE.heroBackground),
    heroTextColor: asHex(raw.heroTextColor, DEFAULT_HOMEPAGE.heroTextColor),
    heroOverlayColor: asHex(raw.heroOverlayColor, DEFAULT_HOMEPAGE.heroOverlayColor),
    heroOverlayOpacity: Math.min(
      100,
      Math.max(0, Math.round(asNumber(raw.heroOverlayOpacity, DEFAULT_HOMEPAGE.heroOverlayOpacity))),
    ),
    heroAutoplay: asBool(raw.heroAutoplay, DEFAULT_HOMEPAGE.heroAutoplay),
    heroIntervalSeconds: Math.min(
      15,
      Math.max(3, Math.round(asNumber(raw.heroIntervalSeconds, DEFAULT_HOMEPAGE.heroIntervalSeconds))),
    ),
    heroImage: asString(raw.heroImage, DEFAULT_HOMEPAGE.heroImage),
    heroTitle: asString(raw.heroTitle, DEFAULT_HOMEPAGE.heroTitle),
    heroSubtitle: asString(raw.heroSubtitle, DEFAULT_HOMEPAGE.heroSubtitle),
    ctaText: asString(raw.ctaText, DEFAULT_HOMEPAGE.ctaText),
    ctaUrl: asString(raw.ctaUrl, DEFAULT_HOMEPAGE.ctaUrl),
  };
}

/** Coerce anything coming out of jsonb into a full ThemeCustomizations. */
export function normalizeCustomizations(value: unknown): ThemeCustomizations {
  const raw = asRecord(value);
  if (!raw) return DEFAULT_CUSTOMIZATIONS;
  const rawColors = asRecord(raw.colors) ?? {};
  const rawFonts = asRecord(raw.fonts) ?? {};

  const colors = { ...EMPTY_COLORS };
  for (const key of THEME_COLOR_KEYS) {
    const chosen = rawColors[key];
    if (typeof chosen === 'string' && HEX_COLOR.test(chosen.trim())) {
      colors[key] = chosen.trim();
    }
  }

  return {
    colors,
    fonts: {
      heading: sanitizeFontName(rawFonts.heading, ''),
      body: sanitizeFontName(rawFonts.body, ''),
      baseSize: Math.min(20, Math.max(12, asNumber(rawFonts.baseSize, 16))),
    },
    header: normalizeHeader(raw.header),
    footer: normalizeFooter(raw.footer),
    homepage: normalizeHomepage(raw.homepage),
  };
}

/**
 * Merge a customizer payload over a theme's `theme.json` defaults.
 * Used when publishing so a theme switch never leaves holes behind.
 */
export function mergeCustomizations(
  theme: ThemeDefaults,
  payload: unknown,
): ThemeCustomizations {
  const base = normalizeCustomizations(payload);
  const rawColors = asRecord((asRecord(payload) ?? {}).colors) ?? {};
  const rawFonts = asRecord((asRecord(payload) ?? {}).fonts) ?? {};

  const colors: ThemeColors = { ...EMPTY_COLORS };
  for (const key of THEME_COLOR_KEYS) {
    const chosen = rawColors[key];
    colors[key] =
      typeof chosen === 'string' && HEX_COLOR.test(chosen.trim())
        ? chosen.trim()
        : theme.colors[key];
  }

  return {
    colors,
    fonts: {
      heading: sanitizeFontName(rawFonts.heading, theme.fonts.heading),
      body: sanitizeFontName(rawFonts.body, theme.fonts.body),
      baseSize: base.fonts.baseSize,
    },
    header: base.header,
    footer: base.footer,
    homepage: base.homepage,
  };
}

/** Coerce `settings_store.nav_menus` into a menus map. */
export function normalizeNavMenus(value: unknown): NavMenus {
  const raw = asRecord(value);
  if (!raw) return {};
  const menus: NavMenus = {};
  for (const [name, entry] of Object.entries(raw)) {
    const record = asRecord(entry);
    if (!record) continue;
    const location = asString(record.location, 'primary');
    const items = Array.isArray(record.items) ? record.items : [];
    menus[name] = {
      location: (['primary', 'footer', 'mobile'] as const).includes(location as NavMenuLocation)
        ? (location as NavMenuLocation)
        : 'primary',
      items: items
        .map((item, index) => {
          const row = asRecord(item);
          if (!row) return null;
          return {
            id: asString(row.id, `item-${index}-${Date.now().toString(36)}`),
            label: asString(row.label, ''),
            url: asString(row.url, ''),
            depth: asNumber(row.depth, 0) >= 1 ? (1 as const) : (0 as const),
          };
        })
        .filter((item): item is NavMenuItem => Boolean(item)),
    };
  }
  return menus;
}

function normalizeWidget(entry: unknown, index: number): WidgetInstance | null {
  const row = asRecord(entry);
  if (!row) return null;
  const rawType = String(row.type ?? '');
  const type = (WIDGET_TYPES as readonly string[]).includes(rawType)
    ? (rawType as WidgetType)
    : 'text';
  const settings = asRecord(row.settings) ?? {};
  const links = Array.isArray(settings.links) ? settings.links : [];
  return {
    id: asString(row.id, `w-${index}-${Date.now().toString(36)}`),
    type,
    settings: {
      title: asString(settings.title, '').slice(0, 200),
      limit: Math.min(50, Math.max(1, asNumber(settings.limit, 5))),
      html: asString(settings.html, '').slice(0, 5000),
      links: links
        .map((link) => {
          const record = asRecord(link);
          if (!record) return null;
          return { label: asString(record.label, ''), url: asString(record.url, '') };
        })
        .filter((link): link is FooterLink => Boolean(link)),
    },
  };
}

/** Coerce `settings_store.widgets` into a full layout. */
export function normalizeWidgetLayout(value: unknown): WidgetLayout {
  const raw = asRecord(value) ?? {};
  const layout: WidgetLayout = { sidebar: [], homepage: [], footer: [] };
  for (const area of WIDGET_AREAS) {
    const list = Array.isArray(raw[area]) ? raw[area] : [];
    layout[area] = list
      .map((entry, index) => normalizeWidget(entry, index))
      .filter((entry): entry is WidgetInstance => Boolean(entry))
      .slice(0, 30);
  }
  return layout;
}
