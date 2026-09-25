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
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'header', label: 'Header', icon: PanelTop },
  { id: 'footer', label: 'Footer', icon: PanelBottom },
  { id: 'homepage', label: 'Homepage', icon: Home },
] as const;

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

const COLOR_ROWS: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
];

const SECTION_LABELS: Record<HomepageSectionKey, string> = {
  hero: 'Hero',
  featured: 'Featured products',
  categories: 'Categories',
  latestPosts: 'Latest blog posts',
  testimonials: 'Testimonials',
  stats: 'Stats',
};

/** Widths are the viewport the iframe actually renders at — the preview is scaled
 *  down to fit the panel so the storefront's media queries see a real device
 *  width instead of the narrow panel (which made desktop render the mobile layout). */
const DEVICES = [
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: 1440 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 768 },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 375 },
] as const;

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
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
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
            aria-label={`Reorder slide ${index + 1}`}
            className="cursor-grab rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={13} />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Slide {index + 1}
          </span>
        </div>
        <button
          type="button"
          aria-label="Remove slide"
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
          {slide.image ? 'Change image' : 'Choose slide image'}
        </span>
      </button>

      <div className="mt-2 space-y-2">
        <div>
          <Label>Eyebrow / category</Label>
          <TextInput
            value={slide.category}
            onChange={(value) => onPatch({ category: value })}
            placeholder="Libra"
          />
        </div>
        <div>
          <Label>Title</Label>
          <TextInput
            value={slide.title}
            onChange={(value) => onPatch({ title: value })}
            placeholder="Koment i akides së Tahaviut"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Price</Label>
            <TextInput
              value={slide.price}
              onChange={(value) => onPatch({ price: value })}
              placeholder="20.00"
            />
          </div>
          <div>
            <Label>Link</Label>
            <TextInput
              value={slide.url}
              onChange={(value) => onPatch({ url: value })}
              placeholder="/shop/products/12"
            />
          </div>
        </div>
        <div>
          <Label>Button label</Label>
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

  const previewUrl = stamp ? `/shop?preview=1&ts=${stamp}` : '/shop?preview=1';

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
      if (result.ok) toast.success('Theme published — the storefront is updated.');
      else toast.error(result.error || 'Could not publish the theme.');
    } catch (error) {
      console.error('[cms/appearance] publish failed', error);
      toast.error('Something went wrong while publishing.');
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
        toast.success('Customizations reset to the theme defaults.');
      } else {
        toast.error(result.error || 'Could not reset the customizations.');
      }
    } catch (error) {
      console.error('[cms/appearance] reset failed', error);
      toast.error('Something went wrong while resetting.');
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
              Defaults come from the “{theme.name}” theme — anything you change here is stored as
              an override.
            </p>
            {COLOR_ROWS.map((row) => (
              <ColorRow
                key={row.key}
                label={row.label}
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
              <Label>Heading font</Label>
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
              <Label>Body font</Label>
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
              <Label>Base font size</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  aria-label="Base font size"
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
                Heading preview
              </p>
              <p
                className="mt-1 text-xs text-zinc-600"
                style={{ fontFamily: `'${state.fonts.body}', sans-serif` }}
              >
                Body preview — the quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>
        );

      case 'header':
        return (
          <div className="space-y-4">
            <div>
              <Label>Logo</Label>
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
                  {state.header.logo ? 'Change logo' : 'Choose from media library'}
                </span>
              </button>
              {state.header.logo ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
                  onClick={() => patchSection('header', { logo: '' })}
                >
                  Remove logo
                </button>
              ) : null}
            </div>

            <div>
              <Label>Site name</Label>
              <TextInput
                value={state.header.siteName}
                onChange={(value) => patchSection('header', { siteName: value })}
                placeholder="My store"
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <TextInput
                value={state.header.tagline}
                onChange={(value) => patchSection('header', { tagline: value })}
                placeholder="Just another store"
              />
            </div>
            <div>
              <Label>Navigation style</Label>
              <Select
                className="py-1.5 text-xs"
                value={state.header.navStyle}
                onChange={(event) =>
                  patchSection('header', {
                    navStyle: event.target.value as ThemeCustomizations['header']['navStyle'],
                  })
                }
              >
                <option value="standard">Standard</option>
                <option value="centered">Centered</option>
                <option value="minimal">Minimal</option>
              </Select>
            </div>

            <Toggle
              label="Show search"
              checked={state.header.showSearch}
              onChange={(value) => patchSection('header', { showSearch: value })}
            />
            <Toggle
              label="Show cart"
              checked={state.header.showCart}
              onChange={(value) => patchSection('header', { showCart: value })}
            />

            <div>
              <Label>Header background</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['transparent', 'white', 'custom'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => patchSection('header', { headerBgMode: option })}
                    className={cn(
                      'rounded border py-1.5 text-xs capitalize transition',
                      state.header.headerBgMode === option
                        ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {state.header.headerBgMode === 'custom' ? (
                <div className="mt-2">
                  <ColorRow
                    label="Custom header colour"
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
              <Label>Footer columns</Label>
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
              <Label>Copyright text</Label>
              <TextInput
                value={state.footer.copyright}
                onChange={(value) => patchSection('footer', { copyright: value })}
                placeholder="© 2026 My store. All rights reserved."
              />
            </div>

            <ColorRow
              label="Footer background (empty = default)"
              value={state.footer.background || '#faf7f1'}
              onChange={(value) => patchSection('footer', { background: value })}
            />

            <div className="space-y-3 border-t border-zinc-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Columns
              </span>
              {state.footer.items.slice(0, state.footer.columns).map((column, columnIndex) => (
                <div key={columnIndex} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Column {columnIndex + 1}
                    </span>
                  </div>
                  <TextInput
                    value={column.title}
                    onChange={(value) => patchColumn(columnIndex, { title: value })}
                    placeholder="Column title"
                  />

                  <div className="mt-2 space-y-2">
                    {column.links.map((link, linkIndex) => (
                      <div
                        key={linkIndex}
                        className="rounded border border-zinc-200 bg-white p-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                            Link {linkIndex + 1}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-label="Move link up"
                              disabled={linkIndex === 0}
                              onClick={() => moveLink(columnIndex, linkIndex, -1)}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label="Move link down"
                              disabled={linkIndex === column.links.length - 1}
                              onClick={() => moveLink(columnIndex, linkIndex, 1)}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label="Remove link"
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
                          placeholder="Label"
                        />
                        <div className="mt-1.5">
                          <TextInput
                            value={link.url}
                            onChange={(value) => patchLink(columnIndex, linkIndex, { url: value })}
                            placeholder="/shop/collections/…"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addLink(columnIndex)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-1.5 text-[11px] text-zinc-500 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                    >
                      <Plus size={12} /> Add link
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
              <Label>Homepage sections</Label>
              <div className="space-y-2">
                {HOMEPAGE_SECTION_KEYS.map((key) => (
                  <Toggle
                    key={key}
                    label={SECTION_LABELS[key]}
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
                <Label>Hero carousel slides</Label>
                <button
                  type="button"
                  onClick={addSlide}
                  disabled={state.homepage.heroSlides.length >= MAX_HERO_SLIDES}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#4f4dd6] transition hover:bg-zinc-100 disabled:opacity-30"
                >
                  <Plus size={12} /> Add slide
                </button>
              </div>

              {state.homepage.heroSlides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-[11px] leading-relaxed text-zinc-400">
                  No slides yet — the hero stays hidden on the storefront until you
                  add one.
                </p>
              ) : (
                <DndContext
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
                  <Label>Secondary button</Label>
                  <TextInput
                    value={state.homepage.heroSecondaryLabel}
                    onChange={(value) => patchSection('homepage', { heroSecondaryLabel: value })}
                    placeholder="Të gjitha librat"
                  />
                </div>
                <div>
                  <Label>Secondary link</Label>
                  <TextInput
                    value={state.homepage.heroSecondaryUrl}
                    onChange={(value) => patchSection('homepage', { heroSecondaryUrl: value })}
                    placeholder="/shop/products"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <Label>Hero layout &amp; style</Label>

              <div className="space-y-2">
                <div>
                  <Label>Layout</Label>
                  <Select
                    value={state.homepage.heroLayout}
                    onChange={(event) =>
                      patchSection('homepage', { heroLayout: event.target.value as HeroLayout })
                    }
                  >
                    <option value="image-right">Image right</option>
                    <option value="image-left">Image left</option>
                    <option value="image-full">Full-bleed background</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Height</Label>
                    <Select
                      value={state.homepage.heroHeight}
                      onChange={(event) =>
                        patchSection('homepage', { heroHeight: event.target.value as HeroHeight })
                      }
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="full">Full screen</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Text alignment</Label>
                    <Select
                      value={state.homepage.heroTextAlign}
                      onChange={(event) =>
                        patchSection('homepage', {
                          heroTextAlign: event.target.value as HeroTextAlign,
                        })
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                    </Select>
                  </div>
                </div>

                <ColorRow
                  label="Background"
                  value={state.homepage.heroBackground}
                  onChange={(value) => patchSection('homepage', { heroBackground: value })}
                />
                <ColorRow
                  label="Text colour"
                  value={state.homepage.heroTextColor}
                  onChange={(value) => patchSection('homepage', { heroTextColor: value })}
                />

                {state.homepage.heroLayout === 'image-full' ? (
                  <>
                    <ColorRow
                      label="Overlay colour"
                      value={state.homepage.heroOverlayColor}
                      onChange={(value) => patchSection('homepage', { heroOverlayColor: value })}
                    />
                    <div>
                      <Label>Overlay opacity — {state.homepage.heroOverlayOpacity}%</Label>
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
                  label="Autoplay slides"
                  checked={state.homepage.heroAutoplay}
                  onChange={(value) => patchSection('homepage', { heroAutoplay: value })}
                />
                {state.homepage.heroAutoplay ? (
                  <div>
                    <Label>Seconds per slide — {state.homepage.heroIntervalSeconds}s</Label>
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
              <Label>Hero background image</Label>
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
                  {state.homepage.heroImage ? 'Change image' : 'Choose from media library'}
                </span>
              </button>
              {state.homepage.heroImage ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
                  onClick={() => patchSection('homepage', { heroImage: '' })}
                >
                  Remove image
                </button>
              ) : null}
            </div>

            <div>
              <Label>Hero title</Label>
              <TextInput
                value={state.homepage.heroTitle}
                onChange={(value) => patchSection('homepage', { heroTitle: value })}
                placeholder="New season, new stories"
              />
            </div>
            <div>
              <Label>Hero subtitle</Label>
              <TextInput
                value={state.homepage.heroSubtitle}
                onChange={(value) => patchSection('homepage', { heroSubtitle: value })}
                placeholder="Hand-picked pieces, delivered fast."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>CTA text</Label>
                <TextInput
                  value={state.homepage.ctaText}
                  onChange={(value) => patchSection('homepage', { ctaText: value })}
                  placeholder="Shop now"
                />
              </div>
              <div>
                <Label>CTA URL</Label>
                <TextInput
                  value={state.homepage.ctaUrl}
                  onChange={(value) => patchSection('homepage', { ctaUrl: value })}
                  placeholder="/shop"
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
  const previewScale = stage.width > 0 ? Math.min(1, stage.width / activeDevice.width) : 1;

  return (
    <div className="flex h-[calc(100vh-17rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Palette size={16} className="shrink-0 text-[#5b59d6]" />
          <span className="truncate text-sm font-semibold text-zinc-900">
            Customize · {theme.name}
          </span>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Unsaved
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={saving}>
            <RefreshCw size={13} /> Reset to defaults
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Panel 1 — sections */}
        <aside className="w-[200px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50/70 p-3">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Sections
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
                {entry.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Panel 2 — settings */}
        <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {SECTIONS.find((entry) => entry.id === section)?.label}
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
                  title={entry.label}
                  aria-label={`Preview width: ${entry.label}`}
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
              <span className="text-[11px] text-zinc-400">Live preview</span>
              <button
                type="button"
                title="Reload preview"
                aria-label="Reload preview"
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
                title="Storefront live preview"
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
