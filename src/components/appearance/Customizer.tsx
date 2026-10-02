'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Home,
  ImagePlus,
  Monitor,
  PanelBottom,
  PanelTop,
  Palette,
  Plus,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Select, cn, inputClass } from '@/components/admin/ui';
import MediaPickerModal from '@/components/admin/MediaPickerModal';
import { resetThemeCustomizations, saveThemeCustomizations } from '@/app/cms/actions/theme';
import {
  DEFAULT_CUSTOMIZATIONS,
  type FooterColumn,
  type HeroHeight,
  type HeroLayout,
  type HeroSlide,
  type HeroTextAlign,
  type HomepageSections,
  type ThemeColors,
  type ThemeCustomizations,
  type ThemeDefinition,
} from '@/lib/theme/types';
import { GOOGLE_FONTS } from '@/lib/theme/fonts';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

/** All toggleable homepage sections, derived from the canonical type. */
const HOMEPAGE_SECTION_KEYS = Object.keys(DEFAULT_CUSTOMIZATIONS.homepage.sections) as Array<
  keyof HomepageSections
>;
type HomepageSectionKey = keyof HomepageSections;
type CustomFooterColumn = FooterColumn;

/** Defaults for a given theme: base customizations overlaid with the theme's own colours/fonts. */
function defaultCustomizations(theme: ThemeDefinition): ThemeCustomizations {
  return {
    ...DEFAULT_CUSTOMIZATIONS,
    colors: { ...DEFAULT_CUSTOMIZATIONS.colors, ...theme.colors },
    fonts: { ...DEFAULT_CUSTOMIZATIONS.fonts, ...theme.fonts },
  };
}

const SECTIONS = [
  { id: 'colors', labelKey: 'cmsshared.customizer.section_colors', icon: Palette },
  { id: 'typography', labelKey: 'cmsshared.customizer.section_typography', icon: Type },
  { id: 'header', labelKey: 'cmsshared.customizer.section_header', icon: PanelTop },
  { id: 'footer', labelKey: 'cmsshared.customizer.section_footer', icon: PanelBottom },
  { id: 'homepage', labelKey: 'cmsshared.customizer.section_homepage', icon: Home },
] as const satisfies ReadonlyArray<{ id: string; labelKey: keyof Dictionary; icon: unknown }>;

type SectionId = (typeof SECTIONS)[number]['id'];

/** Which field the media library modal is currently filling. */
type PickerTarget = { kind: 'logo' } | { kind: 'hero' } | { kind: 'slide'; index: number };

const MAX_HERO_SLIDES = 8;

function blankSlide(): HeroSlide {
  return {
    id: `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    image: '',
    category: '',
    title: '',
    price: '',
    url: '',
    ctaLabel: '',
  };
}

const COLOR_ROWS: Array<{ key: keyof ThemeColors; labelKey: keyof Dictionary }> = [
  { key: 'primary', labelKey: 'cmsshared.customizer.color_primary' },
  { key: 'secondary', labelKey: 'cmsshared.customizer.color_secondary' },
  { key: 'background', labelKey: 'cmsshared.customizer.color_background' },
  { key: 'surface', labelKey: 'cmsshared.customizer.color_surface' },
  { key: 'text', labelKey: 'cmsshared.customizer.color_text' },
  { key: 'accent', labelKey: 'cmsshared.customizer.color_accent' },
];

const SECTION_LABEL_KEYS: Record<HomepageSectionKey, keyof Dictionary> = {
  hero: 'cmsshared.customizer.home_hero',
  featured: 'cmsshared.customizer.home_featured',
  categories: 'cmsshared.customizer.home_categories',
  latestPosts: 'cmsshared.customizer.home_latest_posts',
  testimonials: 'cmsshared.customizer.home_testimonials',
  stats: 'cmsshared.customizer.home_stats',
};

const HEADER_BG_MODES: Array<{
  value: ThemeCustomizations['header']['headerBgMode'];
  labelKey: keyof Dictionary;
}> = [
  { value: 'transparent', labelKey: 'cmsshared.customizer.bg_transparent' },
  { value: 'white', labelKey: 'cmsshared.customizer.bg_white' },
  { value: 'custom', labelKey: 'cmsshared.customizer.bg_custom' },
];

/** Widths are the viewport the iframe actually renders at — the preview is scaled
 *  down to fit the panel so the storefront's media queries see a real device
 *  width instead of the narrow panel (which made desktop render the mobile layout). */
const DEVICES = [
  { id: 'desktop', labelKey: 'cmsshared.customizer.device_desktop', icon: Monitor, width: 1440 },
  { id: 'tablet', labelKey: 'cmsshared.customizer.device_tablet', icon: Tablet, width: 768 },
  { id: 'mobile', labelKey: 'cmsshared.customizer.device_mobile', icon: Smartphone, width: 375 },
] as const satisfies ReadonlyArray<{ id: string; labelKey: keyof Dictionary; icon: unknown; width: number }>;

type DeviceId = (typeof DEVICES)[number]['id'];

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value.trim());
}

/* -------------------------------------------------------------- primitives */

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-zinc-600">{children}</span>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={cn(inputClass, 'py-1.5 text-xs')}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 transition hover:border-zinc-300">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none h-5 w-9 rounded-full transition',
            checked ? 'bg-[#6d6be8]' : 'bg-zinc-300',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute h-4 w-4 rounded-full bg-white shadow transition',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t('cmsshared.customizer.color_picker_aria', { label })}
          className="h-9 w-11 cursor-pointer rounded border border-zinc-300 bg-white p-1"
          value={isHex(value) ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
        />
        <TextInput value={value} onChange={onChange} placeholder="#000000" />
      </div>
    </div>
  );
}

/** One draggable row of the hero carousel editor. */
function SortableSlide({
  slide,
  index,
  onPatch,
  onRemove,
  onPickImage,
}: {
  slide: HeroSlide;
  index: number;
  onPatch: (value: Partial<HeroSlide>) => void;
  onRemove: () => void;
  onPickImage: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });
  const { t } = useLocale();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white p-2.5',
        isDragging && 'relative z-10 shadow-lg ring-1 ring-[#6d6be8]',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('cmsshared.customizer.slide_reorder_aria', { number: index + 1 })}
            className="cursor-grab rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={13} />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {t('cmsshared.customizer.slide_number', { number: index + 1 })}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('cmsshared.customizer.remove_slide_aria')}
          onClick={onRemove}
          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <button
        type="button"
        onClick={onPickImage}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-2 text-left transition hover:border-[#6d6be8]"
      >
        {slide.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.image} alt="" className="h-12 w-16 rounded object-cover" />
        ) : (
          <span className="flex h-12 w-16 items-center justify-center rounded bg-zinc-100 text-zinc-400">
            <ImagePlus size={16} />
          </span>
        )}
        <span className="text-xs text-zinc-500">
          {slide.image
            ? t('cmsshared.customizer.change_image')
            : t('cmsshared.customizer.choose_slide_image')}
        </span>
      </button>

      <div className="mt-2 space-y-2">
        <div>
          <Label>{t('cmsshared.customizer.eyebrow')}</Label>
          <TextInput
            value={slide.category}
            onChange={(value) => onPatch({ category: value })}
            placeholder="Libra"
          />
        </div>
        <div>
          <Label>{t('cmsshared.field.title')}</Label>
          <TextInput
            value={slide.title}
            onChange={(value) => onPatch({ title: value })}
            placeholder="Koment i akides së Tahaviut"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('cmsshared.customizer.price')}</Label>
            <TextInput
              value={slide.price}
              onChange={(value) => onPatch({ price: value })}
              placeholder="20.00"
            />
          </div>
          <div>
            <Label>{t('cmsshared.customizer.link')}</Label>
            <TextInput
              value={slide.url}
              onChange={(value) => onPatch({ url: value })}
              placeholder="/home/products/12"
            />
          </div>
        </div>
        <div>
          <Label>{t('cmsshared.customizer.button_label')}</Label>
          <TextInput
            value={slide.ctaLabel}
            onChange={(value) => onPatch({ ctaLabel: value })}
            placeholder="Shiko produktin"
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the customizer */

export default function Customizer({
  theme,
  initial,
}: {
  theme: ThemeDefinition;
  initial: ThemeCustomizations;
}) {
  const [state, setState] = useState<ThemeCustomizations>(initial);
  const [section, setSection] = useState<SectionId>('colors');
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [device, setDevice] = useState<DeviceId>('desktop');
  // Starts empty: a Date.now() seed would differ between the server and client
  // render and break hydration. It only ever gets set by the reload button.
  const [stamp, setStamp] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const { t } = useLocale();

  const slideSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const previewUrl = stamp ? `/home?preview=1&ts=${stamp}` : '/home?preview=1';

  /** Debounced postMessage — never reloads the iframe. */
  useEffect(() => {
    const timer = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage(
        { type: 'cms:theme', colors: state.colors, fonts: state.fonts, homepage: state.homepage },
        '*',
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [state]);

  function sendNow() {
    frameRef.current?.contentWindow?.postMessage(
      { type: 'cms:theme', colors: state.colors, fonts: state.fonts, homepage: state.homepage },
      '*',
    );
  }

  function patchSection<K extends keyof ThemeCustomizations>(
    key: K,
    value: Partial<ThemeCustomizations[K]>,
  ) {
    setState((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...value } as ThemeCustomizations[K],
    }));
  }

  function setColor(key: keyof ThemeColors, value: string) {
    setState((previous) => ({ ...previous, colors: { ...previous.colors, [key]: value } }));
  }

  async function publish() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveThemeCustomizations(state);
      if (result.ok) toast.success(t('cmsshared.customizer.published'));
      else toast.error(result.error || t('cmsshared.customizer.publish_error'));
    } catch (error) {
      console.error('[cms/appearance] publish failed', error);
      toast.error(t('cmsshared.customizer.publish_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await resetThemeCustomizations();
      if (result.ok) {
        setState(defaultCustomizations(theme));
        toast.success(t('cmsshared.customizer.reset_done'));
      } else {
        toast.error(result.error || t('cmsshared.customizer.reset_error'));
      }
    } catch (error) {
      console.error('[cms/appearance] reset failed', error);
      toast.error(t('cmsshared.customizer.reset_failed'));
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------------------------- hero slide helpers */

  function patchHomepageSlides(next: (slides: HeroSlide[]) => HeroSlide[]) {
    setState((previous) => ({
      ...previous,
      homepage: { ...previous.homepage, heroSlides: next(previous.homepage.heroSlides) },
    }));
  }

  function addSlide() {
    patchHomepageSlides((slides) =>
      slides.length >= MAX_HERO_SLIDES ? slides : [...slides, blankSlide()],
    );
  }

  function patchSlide(index: number, value: Partial<HeroSlide>) {
    patchHomepageSlides((slides) =>
      slides.map((slide, i) => (i === index ? { ...slide, ...value } : slide)),
    );
  }

  function removeSlide(index: number) {
    patchHomepageSlides((slides) => slides.filter((_, i) => i !== index));
  }

  function handleSlideDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    patchHomepageSlides((slides) => {
      const from = slides.findIndex((slide) => slide.id === active.id);
      const to = slides.findIndex((slide) => slide.id === over.id);
      if (from < 0 || to < 0) return slides;
      return arrayMove(slides, from, to);
    });
  }

  /* ------------------------------------------------- footer column helpers */

  function setFooterColumns(count: number) {
    setState((previous) => {
      const items: CustomFooterColumn[] = [...previous.footer.items];
      while (items.length < count) items.push({ title: '', links: [] });
      return { ...previous, footer: { ...previous.footer, columns: count, items } };
    });
  }

  function patchColumn(index: number, value: Partial<CustomFooterColumn>) {
    setState((previous) => {
      const items = previous.footer.items.map((column, i) =>
        i === index ? { ...column, ...value } : column,
      );
      return { ...previous, footer: { ...previous.footer, items } };
    });
  }

  function patchLink(columnIndex: number, linkIndex: number, value: Partial<{ label: string; url: string }>) {
    setState((previous) => {
      const items = previous.footer.items.map((column, i) => {
        if (i !== columnIndex) return column;
        const links = column.links.map((link, j) => (j === linkIndex ? { ...link, ...value } : link));
        return { ...column, links };
      });
      return { ...previous, footer: { ...previous.footer, items } };
    });
  }

  function addLink(columnIndex: number) {
    setState((previous) => {
      const items = previous.footer.items.map((column, i) =>
        i === columnIndex ? { ...column, links: [...column.links, { label: '', url: '' }] } : column,
      );
      return { ...previous, footer: { ...previous.footer, items } };
    });
  }

  function removeLink(columnIndex: number, linkIndex: number) {
    setState((previous) => {
      const items = previous.footer.items.map((column, i) =>
        i === columnIndex
          ? { ...column, links: column.links.filter((_, j) => j !== linkIndex) }
          : column,
      );
      return { ...previous, footer: { ...previous.footer, items } };
    });
  }

  function moveLink(columnIndex: number, linkIndex: number, delta: number) {
    setState((previous) => {
      const items = previous.footer.items.map((column, i) => {
        if (i !== columnIndex) return column;
        const target = linkIndex + delta;
        if (target < 0 || target >= column.links.length) return column;
        const links = [...column.links];
        const [moved] = links.splice(linkIndex, 1);
        links.splice(target, 0, moved);
        return { ...column, links };
      });
      return { ...previous, footer: { ...previous.footer, items } };
    });
  }

  /* ------------------------------------------------------- section content */

  function renderSectionPanel() {
    switch (section) {
      case 'colors':
        return (
          <div className="space-y-4">
            <p className="text-[11px] leading-relaxed text-zinc-400">
              {t('cmsshared.customizer.colors_help', { name: theme.name })}
            </p>
            {COLOR_ROWS.map((row) => (
              <ColorRow
                key={row.key}
                label={t(row.labelKey)}
                value={state.colors[row.key]}
                onChange={(value) => setColor(row.key, value)}
              />
            ))}
          </div>
        );

      case 'typography':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('cmsshared.customizer.heading_font')}</Label>
              <Select
                className="py-1.5 text-xs"
                value={state.fonts.heading}
                onChange={(event) => patchSection('fonts', { heading: event.target.value })}
              >
                {GOOGLE_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('cmsshared.customizer.body_font')}</Label>
              <Select
                className="py-1.5 text-xs"
                value={state.fonts.body}
                onChange={(event) => patchSection('fonts', { body: event.target.value })}
              >
                {GOOGLE_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('cmsshared.customizer.base_font_size')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  aria-label={t('cmsshared.customizer.base_font_size')}
                  className="flex-1 accent-[#6d6be8]"
                  value={state.fonts.baseSize}
                  onChange={(event) =>
                    patchSection('fonts', { baseSize: Number(event.target.value) })
                  }
                />
                <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
                  {state.fonts.baseSize}px
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p
                className="text-lg font-semibold text-zinc-900"
                style={{ fontFamily: `'${state.fonts.heading}', serif` }}
              >
                {t('cmsshared.customizer.heading_preview')}
              </p>
              <p
                className="mt-1 text-xs text-zinc-600"
                style={{ fontFamily: `'${state.fonts.body}', sans-serif` }}
              >
                {t('cmsshared.customizer.body_preview')}
              </p>
            </div>
          </div>
        );

      case 'header':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('cmsshared.customizer.logo')}</Label>
              <button
                type="button"
                onClick={() => setPicker({ kind: 'logo' })}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-2 text-left transition hover:border-[#6d6be8]"
              >
                {state.header.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.header.logo} alt="" className="h-10 w-10 rounded object-contain" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-zinc-400">
                    <ImagePlus size={16} />
                  </span>
                )}
                <span className="text-xs text-zinc-500">
                  {state.header.logo
                    ? t('cmsshared.customizer.change_logo')
                    : t('cmsshared.customizer.choose_media')}
                </span>
              </button>
              {state.header.logo ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
                  onClick={() => patchSection('header', { logo: '' })}
                >
                  {t('cmsshared.customizer.remove_logo')}
                </button>
              ) : null}
            </div>

            <div>
              <Label>{t('cmsshared.customizer.site_name')}</Label>
              <TextInput
                value={state.header.siteName}
                onChange={(value) => patchSection('header', { siteName: value })}
                placeholder={t('cmsshared.customizer.site_name_ph')}
              />
            </div>
            <div>
              <Label>{t('cmsshared.customizer.tagline')}</Label>
              <TextInput
                value={state.header.tagline}
                onChange={(value) => patchSection('header', { tagline: value })}
                placeholder={t('cmsshared.customizer.tagline_ph')}
              />
            </div>
            <div>
              <Label>{t('cmsshared.customizer.nav_style')}</Label>
              <Select
                className="py-1.5 text-xs"
                value={state.header.navStyle}
                onChange={(event) =>
                  patchSection('header', {
                    navStyle: event.target.value as ThemeCustomizations['header']['navStyle'],
                  })
                }
              >
                <option value="standard">{t('cmsshared.customizer.nav_standard')}</option>
                <option value="centered">{t('cmsshared.customizer.nav_centered')}</option>
                <option value="minimal">{t('cmsshared.customizer.nav_minimal')}</option>
              </Select>
            </div>

            <Toggle
              label={t('cmsshared.customizer.show_search')}
              checked={state.header.showSearch}
              onChange={(value) => patchSection('header', { showSearch: value })}
            />
            <Toggle
              label={t('cmsshared.customizer.show_cart')}
              checked={state.header.showCart}
              onChange={(value) => patchSection('header', { showCart: value })}
            />

            <div>
              <Label>{t('cmsshared.customizer.header_background')}</Label>
              <div className="grid grid-cols-3 gap-1">
                {HEADER_BG_MODES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => patchSection('header', { headerBgMode: option.value })}
                    className={cn(
                      'rounded border py-1.5 text-xs capitalize transition',
                      state.header.headerBgMode === option.value
                        ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              {state.header.headerBgMode === 'custom' ? (
                <div className="mt-2">
                  <ColorRow
                    label={t('cmsshared.customizer.custom_header_colour')}
                    value={state.header.headerBgColor || '#ffffff'}
                    onChange={(value) => patchSection('header', { headerBgColor: value })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );

      case 'footer':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('cmsshared.customizer.footer_columns')}</Label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setFooterColumns(count)}
                    className={cn(
                      'rounded border py-1.5 text-xs transition',
                      state.footer.columns === count
                        ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{t('cmsshared.customizer.copyright')}</Label>
              <TextInput
                value={state.footer.copyright}
                onChange={(value) => patchSection('footer', { copyright: value })}
                placeholder={t('cmsshared.customizer.copyright_ph')}
              />
            </div>

            <ColorRow
              label={t('cmsshared.customizer.footer_bg')}
              value={state.footer.background || '#faf7f1'}
              onChange={(value) => patchSection('footer', { background: value })}
            />

            <div className="space-y-3 border-t border-zinc-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t('cmsshared.customizer.columns')}
              </span>
              {state.footer.items.slice(0, state.footer.columns).map((column, columnIndex) => (
                <div key={columnIndex} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {t('cmsshared.customizer.column_number', { number: columnIndex + 1 })}
                    </span>
                  </div>
                  <TextInput
                    value={column.title}
                    onChange={(value) => patchColumn(columnIndex, { title: value })}
                    placeholder={t('cmsshared.customizer.column_title_ph')}
                  />

                  <div className="mt-2 space-y-2">
                    {column.links.map((link, linkIndex) => (
                      <div
                        key={linkIndex}
                        className="rounded border border-zinc-200 bg-white p-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                            {t('cmsshared.customizer.link_number', { number: linkIndex + 1 })}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-label={t('cmsshared.customizer.move_link_up')}
                              disabled={linkIndex === 0}
                              onClick={() => moveLink(columnIndex, linkIndex, -1)}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label={t('cmsshared.customizer.move_link_down')}
                              disabled={linkIndex === column.links.length - 1}
                              onClick={() => moveLink(columnIndex, linkIndex, 1)}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label={t('cmsshared.customizer.remove_link')}
                              onClick={() => removeLink(columnIndex, linkIndex)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <TextInput
                          value={link.label}
                          onChange={(value) => patchLink(columnIndex, linkIndex, { label: value })}
                          placeholder={t('cmsshared.field.label')}
                        />
                        <div className="mt-1.5">
                          <TextInput
                            value={link.url}
                            onChange={(value) => patchLink(columnIndex, linkIndex, { url: value })}
                            placeholder="/home/collections/…"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addLink(columnIndex)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-1.5 text-[11px] text-zinc-500 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                    >
                      <Plus size={12} /> {t('cmsshared.widgets.add_link')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'homepage':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('cmsshared.customizer.homepage_sections')}</Label>
              <div className="space-y-2">
                {HOMEPAGE_SECTION_KEYS.map((key) => (
                  <Toggle
                    key={key}
                    label={t(SECTION_LABEL_KEYS[key])}
                    checked={state.homepage.sections[key]}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        homepage: {
                          ...previous.homepage,
                          sections: { ...previous.homepage.sections, [key]: value },
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label>{t('cmsshared.customizer.hero_slides')}</Label>
                <button
                  type="button"
                  onClick={addSlide}
                  disabled={state.homepage.heroSlides.length >= MAX_HERO_SLIDES}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#4f4dd6] transition hover:bg-zinc-100 disabled:opacity-30"
                >
                  <Plus size={12} /> {t('cmsshared.customizer.add_slide')}
                </button>
              </div>

              {state.homepage.heroSlides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-[11px] leading-relaxed text-zinc-400">
                  {t('cmsshared.customizer.no_slides')}
                </p>
              ) : (
                <DndContext
                  id="hero-slides"
                  sensors={slideSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSlideDragEnd}
                >
                  <SortableContext
                    items={state.homepage.heroSlides.map((slide) => slide.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {state.homepage.heroSlides.map((slide, index) => (
                        <SortableSlide
                          key={slide.id}
                          slide={slide}
                          index={index}
                          onPatch={(value) => patchSlide(index, value)}
                          onRemove={() => removeSlide(index)}
                          onPickImage={() => setPicker({ kind: 'slide', index })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
                <div>
                  <Label>{t('cmsshared.customizer.secondary_button')}</Label>
                  <TextInput
                    value={state.homepage.heroSecondaryLabel}
                    onChange={(value) => patchSection('homepage', { heroSecondaryLabel: value })}
                    placeholder="Të gjitha librat"
                  />
                </div>
                <div>
                  <Label>{t('cmsshared.customizer.secondary_link')}</Label>
                  <TextInput
                    value={state.homepage.heroSecondaryUrl}
                    onChange={(value) => patchSection('homepage', { heroSecondaryUrl: value })}
                    placeholder="/home/products"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <Label>{t('cmsshared.customizer.hero_layout_title')}</Label>

              <div className="space-y-2">
                <div>
                  <Label>{t('cmsshared.customizer.layout')}</Label>
                  <Select
                    value={state.homepage.heroLayout}
                    onChange={(event) =>
                      patchSection('homepage', { heroLayout: event.target.value as HeroLayout })
                    }
                  >
                    <option value="image-right">{t('cmsshared.customizer.layout_image_right')}</option>
                    <option value="image-left">{t('cmsshared.customizer.layout_image_left')}</option>
                    <option value="image-full">{t('cmsshared.customizer.layout_full')}</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t('cmsshared.customizer.height')}</Label>
                    <Select
                      value={state.homepage.heroHeight}
                      onChange={(event) =>
                        patchSection('homepage', { heroHeight: event.target.value as HeroHeight })
                      }
                    >
                      <option value="compact">{t('cmsshared.customizer.height_compact')}</option>
                      <option value="standard">{t('cmsshared.customizer.height_standard')}</option>
                      <option value="full">{t('cmsshared.customizer.height_full')}</option>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('cmsshared.customizer.text_alignment')}</Label>
                    <Select
                      value={state.homepage.heroTextAlign}
                      onChange={(event) =>
                        patchSection('homepage', {
                          heroTextAlign: event.target.value as HeroTextAlign,
                        })
                      }
                    >
                      <option value="left">{t('cmsshared.customizer.align_left')}</option>
                      <option value="center">{t('cmsshared.customizer.align_center')}</option>
                    </Select>
                  </div>
                </div>

                <ColorRow
                  label={t('cmsshared.customizer.color_background')}
                  value={state.homepage.heroBackground}
                  onChange={(value) => patchSection('homepage', { heroBackground: value })}
                />
                <ColorRow
                  label={t('cmsshared.customizer.text_colour')}
                  value={state.homepage.heroTextColor}
                  onChange={(value) => patchSection('homepage', { heroTextColor: value })}
                />

                {state.homepage.heroLayout === 'image-full' ? (
                  <>
                    <ColorRow
                      label={t('cmsshared.customizer.overlay_colour')}
                      value={state.homepage.heroOverlayColor}
                      onChange={(value) => patchSection('homepage', { heroOverlayColor: value })}
                    />
                    <div>
                      <Label>
                        {t('cmsshared.customizer.overlay_opacity', {
                          value: state.homepage.heroOverlayOpacity,
                        })}
                      </Label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={state.homepage.heroOverlayOpacity}
                        onChange={(event) =>
                          patchSection('homepage', {
                            heroOverlayOpacity: Number(event.target.value),
                          })
                        }
                        className="w-full accent-[#6d6be8]"
                      />
                    </div>
                  </>
                ) : null}

                <Toggle
                  label={t('cmsshared.customizer.autoplay')}
                  checked={state.homepage.heroAutoplay}
                  onChange={(value) => patchSection('homepage', { heroAutoplay: value })}
                />
                {state.homepage.heroAutoplay ? (
                  <div>
                    <Label>
                      {t('cmsshared.customizer.interval', {
                        value: state.homepage.heroIntervalSeconds,
                      })}
                    </Label>
                    <input
                      type="range"
                      min={3}
                      max={15}
                      step={1}
                      value={state.homepage.heroIntervalSeconds}
                      onChange={(event) =>
                        patchSection('homepage', {
                          heroIntervalSeconds: Number(event.target.value),
                        })
                      }
                      className="w-full accent-[#6d6be8]"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <Label>{t('cmsshared.customizer.hero_bg_image')}</Label>
              <button
                type="button"
                onClick={() => setPicker({ kind: 'hero' })}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-2 text-left transition hover:border-[#6d6be8]"
              >
                {state.homepage.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.homepage.heroImage}
                    alt=""
                    className="h-12 w-16 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-16 items-center justify-center rounded bg-zinc-100 text-zinc-400">
                    <ImagePlus size={16} />
                  </span>
                )}
                <span className="text-xs text-zinc-500">
                  {state.homepage.heroImage
                    ? t('cmsshared.customizer.change_image')
                    : t('cmsshared.customizer.choose_media')}
                </span>
              </button>
              {state.homepage.heroImage ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
                  onClick={() => patchSection('homepage', { heroImage: '' })}
                >
                  {t('cmsshared.customizer.remove_image')}
                </button>
              ) : null}
            </div>

            <div>
              <Label>{t('cmsshared.customizer.hero_title')}</Label>
              <TextInput
                value={state.homepage.heroTitle}
                onChange={(value) => patchSection('homepage', { heroTitle: value })}
                placeholder={t('cmsshared.customizer.hero_title_ph')}
              />
            </div>
            <div>
              <Label>{t('cmsshared.customizer.hero_subtitle')}</Label>
              <TextInput
                value={state.homepage.heroSubtitle}
                onChange={(value) => patchSection('homepage', { heroSubtitle: value })}
                placeholder={t('cmsshared.customizer.hero_subtitle_ph')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('cmsshared.customizer.cta_text')}</Label>
                <TextInput
                  value={state.homepage.ctaText}
                  onChange={(value) => patchSection('homepage', { ctaText: value })}
                  placeholder={t('cmsshared.customizer.cta_ph')}
                />
              </div>
              <div>
                <Label>{t('cmsshared.customizer.cta_url')}</Label>
                <TextInput
                  value={state.homepage.ctaUrl}
                  onChange={(value) => patchSection('homepage', { ctaUrl: value })}
                  placeholder="/home"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  const activeDevice = DEVICES.find((entry) => entry.id === device) || DEVICES[0];
  const activeSection = SECTIONS.find((entry) => entry.id === section);
  const previewScale = stage.width > 0 ? Math.min(1, stage.width / activeDevice.width) : 1;

  return (
    <div className="flex h-[calc(100vh-17rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Palette size={16} className="shrink-0 text-[#5b59d6]" />
          <span className="truncate text-sm font-semibold text-zinc-900">
            {t('cmsshared.customizer.customize', { name: theme.name })}
          </span>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {t('cmsshared.menu_builder.unsaved')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={saving}>
            <RefreshCw size={13} /> {t('cmsshared.customizer.reset_defaults')}
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={saving || !dirty}>
            {saving ? t('cmsshared.menu_builder.saving') : t('cmsshared.customizer.publish')}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Panel 1 — sections */}
        <aside className="w-[200px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50/70 p-3">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {t('cmsshared.customizer.sections_label')}
          </p>
          <div className="space-y-1">
            {SECTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSection(entry.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                  section === entry.id
                    ? 'border-[#6d6be8] bg-[#6d6be8]/10 text-[#4f4dd6]'
                    : 'border-transparent text-zinc-600 hover:bg-white hover:text-zinc-900',
                )}
              >
                <entry.icon size={14} />
                {t(entry.labelKey)}
              </button>
            ))}
          </div>
        </aside>

        {/* Panel 2 — settings */}
        <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {activeSection ? t(activeSection.labelKey) : null}
          </p>
          {renderSectionPanel()}
        </aside>

        {/* Panel 3 — live preview */}
        <section className="flex min-w-0 flex-1 flex-col bg-zinc-100/70">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1">
              {DEVICES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  title={t(entry.labelKey)}
                  aria-label={t('cmsshared.customizer.preview_width_aria', {
                    device: t(entry.labelKey),
                  })}
                  onClick={() => setDevice(entry.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-zinc-500 transition',
                    device === entry.id
                      ? 'bg-[#6d6be8]/10 text-[#4f4dd6]'
                      : 'hover:bg-zinc-100 hover:text-zinc-800',
                  )}
                >
                  <entry.icon size={15} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400">
                {t('cmsshared.customizer.live_preview')}
              </span>
              <button
                type="button"
                title={t('cmsshared.customizer.reload_preview')}
                aria-label={t('cmsshared.customizer.reload_preview')}
                onClick={() => setStamp(Date.now())}
                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div ref={stageRef} className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
            <div
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-[width] duration-300"
              style={{ width: activeDevice.width * previewScale, height: stage.height || '100%' }}
            >
              <iframe
                ref={frameRef}
                key={previewUrl}
                src={previewUrl}
                title={t('cmsshared.customizer.iframe_title')}
                onLoad={sendNow}
                className="block border-0"
                style={{
                  width: activeDevice.width,
                  height: stage.height ? stage.height / previewScale : '100%',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        </section>
      </div>

      <MediaPickerModal
        open={picker !== null}
        mode="single"
        onClose={() => setPicker(null)}
        onSelect={(items) => {
          const url = items[0]?.url || '';
          if (picker?.kind === 'logo') patchSection('header', { logo: url });
          if (picker?.kind === 'hero') patchSection('homepage', { heroImage: url });
          if (picker?.kind === 'slide') patchSlide(picker.index, { image: url });
          setPicker(null);
        }}
      />
    </div>
  );
}
