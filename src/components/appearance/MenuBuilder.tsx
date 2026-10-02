'use client';

import { useEffect, useMemo, useState } from 'react';
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
  ExternalLink,
  FileText,
  GripVertical,
  IndentIncrease,
  Link2,
  Package,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, cn, inputClass } from '@/components/admin/ui';
import { saveNavMenu } from '@/app/cms/actions/theme';
import {
  NAV_MENU_LOCATIONS,
  type NavMenuItem,
  type NavMenuLocation,
  type NavMenus,
} from '@/lib/theme/types';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

export type MenuPageOption = { id: number; title: string; slug: string };
export type MenuPostOption = { id: number; title: string; slug: string };
export type MenuProductOption = { id: number; name: string };

type TabId = 'pages' | 'posts' | 'products' | 'custom';

const TABS: Array<{ id: TabId; labelKey: keyof Dictionary; icon: typeof FileText }> = [
  { id: 'pages', labelKey: 'cmsshared.menu_builder.tab_pages', icon: FileText },
  { id: 'posts', labelKey: 'cmsshared.menu_builder.tab_posts', icon: FileText },
  { id: 'products', labelKey: 'cmsshared.menu_builder.tab_products', icon: Package },
  { id: 'custom', labelKey: 'cmsshared.menu_builder.tab_custom', icon: Link2 },
];

/** Display labels for the menu locations (source constant is shared with themes). */
const LOCATION_LABEL_KEYS: Record<NavMenuLocation, keyof Dictionary> = {
  primary: 'cmsshared.menu_location.primary',
  footer: 'cmsshared.menu_location.footer',
  mobile: 'cmsshared.menu_location.mobile',
};

function makeId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDepths(items: NavMenuItem[]): NavMenuItem[] {
  return items.map((item, index) =>
    index === 0 && item.depth === 1 ? { ...item, depth: 0 as const } : item,
  );
}

/* --------------------------------------------------------------- sortable row */

function SortableMenuRow({
  item,
  index,
  items,
  onPatch,
  onIndent,
  onOutdent,
  onDelete,
}: {
  item: NavMenuItem;
  index: number;
  items: NavMenuItem[];
  onPatch: (patch: Partial<NavMenuItem>) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const { t } = useLocale();

  const canIndent = index > 0 && items[index - 1].depth === 0 && item.depth === 0;
  const canOutdent = item.depth === 1;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group rounded-lg border bg-white transition',
        item.depth === 1 ? 'border-zinc-200' : 'border-zinc-200',
        isDragging && 'z-30 opacity-70 shadow-md',
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('cmsshared.menu_builder.drag_aria')}
          className="cursor-grab touch-none text-zinc-400 transition hover:text-zinc-600 active:cursor-grabbing"
        >
          <GripVertical size={15} />
        </button>

        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          style={{ paddingLeft: item.depth === 1 ? 24 : 0 }}
        >
          <input
            className={cn(inputClass, 'flex-1 px-2 py-1.5 text-xs font-medium')}
            value={item.label}
            placeholder={t('cmsshared.menu_builder.label_placeholder')}
            onChange={(event) => onPatch({ label: event.target.value })}
          />
          <input
            className={cn(inputClass, 'w-[42%] px-2 py-1.5 text-xs')}
            value={item.url}
            placeholder="/home/…"
            onChange={(event) => onPatch({ url: event.target.value })}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={t('cmsshared.menu_builder.indent_aria')}
            title={t('cmsshared.menu_builder.indent_title')}
            disabled={!canIndent}
            onClick={onIndent}
            className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
          >
            <IndentIncrease size={13} />
          </button>
          <button
            type="button"
            aria-label={t('cmsshared.menu_builder.outdent_aria')}
            title={t('cmsshared.menu_builder.outdent_title')}
            disabled={!canOutdent}
            onClick={onOutdent}
            className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
          >
            <IndentIncrease size={13} className="rotate-180" />
          </button>
          <button
            type="button"
            aria-label={t('cmsshared.menu_builder.remove_aria')}
            onClick={onDelete}
            className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- builder */

export default function MenuBuilder({
  pages,
  posts,
  initialMenus,
  initialCurrentName,
  initialItems,
  initialLocation,
}: {
  pages: MenuPageOption[];
  posts: MenuPostOption[];
  initialMenus: NavMenus;
  initialCurrentName: string;
  initialItems: NavMenuItem[];
  initialLocation: NavMenuLocation;
}) {
  const [menus, setMenus] = useState<NavMenus>(initialMenus);
  const [currentName, setCurrentName] = useState(initialCurrentName);
  const [items, setItems] = useState<NavMenuItem[]>(initialItems);
  const [location, setLocation] = useState<NavMenuLocation>(initialLocation);
  const [tab, setTab] = useState<TabId>('pages');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [products, setProducts] = useState<MenuProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { t } = useLocale();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    fetch('/api/cms/products?limit=200', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { items?: Array<{ id: number; name: string }> }) => {
        if (cancelled) return;
        setProducts(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const menuNames = useMemo(
    () => Array.from(new Set([...Object.keys(menus), currentName].filter(Boolean))),
    [menus, currentName],
  );

  function commit(next: NavMenuItem[]) {
    setItems(normalizeDepths(next));
    setDirty(true);
  }

  function addItems(entries: Array<{ label: string; url: string }>) {
    if (!entries.length) {
      toast.error(t('cmsshared.menu_builder.select_first'));
      return;
    }
    commit([
      ...items,
      ...entries.map((entry) => ({
        id: makeId(),
        label: entry.label.slice(0, 160),
        url: entry.url.slice(0, 500),
        depth: 0 as const,
      })),
    ]);
    setChecked({});
    toast.success(
      entries.length > 1
        ? t('cmsshared.menu_builder.added_many', { count: entries.length })
        : t('cmsshared.menu_builder.added_one', { count: entries.length }),
    );
  }

  function switchMenu(name: string) {
    const existing = menus[name];
    setCurrentName(name);
    if (existing) {
      setItems(existing.items);
      setLocation(existing.location);
    } else {
      setItems([]);
      setLocation('primary');
    }
    setDirty(false);
  }

  function newMenu() {
    const base = 'New menu';
    let name = base;
    let counter = 2;
    while (menuNames.includes(name)) {
      name = `${base} ${counter}`;
      counter += 1;
    }
    setCurrentName(name);
    setItems([]);
    setLocation('primary');
    setDirty(true);
  }

  async function handleSave() {
    if (saving) return;
    if (!currentName.trim()) {
      toast.error(t('cmsshared.menu_builder.name_required'));
      return;
    }
    setSaving(true);
    try {
      const result = await saveNavMenu({ name: currentName.trim(), items, location });
      if (result.ok) {
        setMenus((previous) => ({ ...previous, [currentName.trim()]: { items, location } }));
        setCurrentName(currentName.trim());
        setDirty(false);
        toast.success(t('cmsshared.menu_builder.saved', { name: currentName.trim() }));
      } else {
        toast.error(result.error || t('cmsshared.menu_builder.save_error'));
      }
    } catch (error) {
      console.error('[cms/appearance] save menu failed', error);
      toast.error(t('cmsshared.menu_builder.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commit(arrayMove(items, oldIndex, newIndex));
  }

  function patchItem(id: string, patch: Partial<NavMenuItem>) {
    commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function indentItem(id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index <= 0) return;
    commit(items.map((item, i) => (i === index ? { ...item, depth: 1 as const } : item)));
  }

  function outdentItem(id: string) {
    commit(
      items.map((item) => (item.id === id && item.depth === 1 ? { ...item, depth: 0 as const } : item)),
    );
  }

  /* ----------------------------------------------------------- source lists */

  function toggle(key: string) {
    setChecked((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  const selectedCount = Object.values(checked).filter(Boolean).length;

  function checkboxRow(key: string, label: string, meta?: string) {
    const isChecked = checked[key] === true;
    return (
      <label
        key={key}
        className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition',
          isChecked
            ? 'border-[#6d6be8] bg-[#6d6be8]/5 text-[#4f4dd6]'
            : 'border-zinc-200 text-zinc-600 hover:border-zinc-300',
        )}
      >
        <input
          type="checkbox"
          className="accent-[#6d6be8]"
          checked={isChecked}
          onChange={() => toggle(key)}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        {meta ? <span className="shrink-0 text-[10px] text-zinc-400">{meta}</span> : null}
      </label>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Add items */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t('cmsshared.menu_builder.add_items')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-1">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                    tab === entry.id
                      ? 'border-[#6d6be8] bg-[#6d6be8]/10 text-[#4f4dd6]'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  {t(entry.labelKey)}
                </button>
              ))}
            </div>

            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
              {tab === 'pages'
                ? pages.length === 0
                  ? <p className="px-1 py-4 text-center text-xs text-zinc-400">{t('cmsshared.menu_builder.no_pages')}</p>
                  : pages.map((page) =>
                      checkboxRow(`page-${page.id}`, page.title, `/home/pages/${page.slug}`),
                    )
                : null}

              {tab === 'posts'
                ? posts.length === 0
                  ? <p className="px-1 py-4 text-center text-xs text-zinc-400">{t('cmsshared.menu_builder.no_posts')}</p>
                  : posts.map((post) =>
                      checkboxRow(`post-${post.id}`, post.title, `/home/blogs/${post.slug}`),
                    )
                : null}

              {tab === 'products'
                ? productsLoading
                  ? <p className="px-1 py-4 text-center text-xs text-zinc-400">{t('cmsshared.menu_builder.loading_products')}</p>
                  : products.length === 0
                    ? <p className="px-1 py-4 text-center text-xs text-zinc-400">{t('cmsshared.menu_builder.no_products')}</p>
                    : products.map((product) =>
                        checkboxRow(`product-${product.id}`, product.name, `#${product.id}`),
                      )
                : null}

              {tab === 'custom' ? (
                <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-3">
                  <div>
                    <span className="mb-1 block text-[11px] font-medium text-zinc-600">{t('cmsshared.field.label')}</span>
                    <Input
                      className="py-1.5 text-xs"
                      placeholder="Instagram"
                      value={customLabel}
                      onChange={(event) => setCustomLabel(event.target.value)}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[11px] font-medium text-zinc-600">{t('cmsshared.field.url')}</span>
                    <Input
                      className="py-1.5 text-xs"
                      placeholder="https://instagram.com/…"
                      value={customUrl}
                      onChange={(event) => setCustomUrl(event.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (!customLabel.trim() || !customUrl.trim()) {
                        toast.error(t('cmsshared.menu_builder.custom_required'));
                        return;
                      }
                      addItems([{ label: customLabel.trim(), url: customUrl.trim() }]);
                      setCustomLabel('');
                      setCustomUrl('');
                    }}
                  >
                    <Plus size={13} /> {t('cmsshared.menu_builder.add_custom_link')}
                  </Button>
                </div>
              ) : null}
            </div>

            {tab !== 'custom' ? (
              <Button
                variant="primary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  const selected: Array<{ label: string; url: string }> = [];
                  if (tab === 'pages') {
                    for (const page of pages) {
                      if (checked[`page-${page.id}`]) {
                        selected.push({ label: page.title, url: `/home/pages/${page.slug}` });
                      }
                    }
                  } else if (tab === 'posts') {
                    for (const post of posts) {
                      if (checked[`post-${post.id}`]) {
                        selected.push({ label: post.title, url: `/home/blogs/${post.slug}` });
                      }
                    }
                  } else {
                    for (const product of products) {
                      if (checked[`product-${product.id}`]) {
                        selected.push({ label: product.name, url: `/home/products/${product.id}` });
                      }
                    }
                  }
                  addItems(selected);
                }}
              >
                <Plus size={13} /> {t('cmsshared.menu_builder.add_to_menu')}
                {selectedCount ? ` (${selectedCount})` : ''}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Menu structure */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('cmsshared.menu_builder.structure_title')}</CardTitle>
            <div className="flex items-center gap-2">
              {menuNames.length > 0 ? (
                <select
                  aria-label={t('cmsshared.menu_builder.switch_aria')}
                  className={cn(inputClass, 'w-44 py-1.5 text-xs')}
                  value={currentName}
                  onChange={(event) => switchMenu(event.target.value)}
                >
                  {menuNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button variant="outline" size="sm" onClick={newMenu}>
                <Plus size={13} /> {t('cmsshared.menu_builder.new_menu')}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1">
                <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                  {t('cmsshared.menu_builder.name_label')}
                </span>
                <Input
                  className="py-1.5 text-sm"
                  value={currentName}
                  placeholder={t('cmsshared.menu_builder.name_placeholder')}
                  onChange={(event) => {
                    setCurrentName(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              {dirty ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  {t('cmsshared.menu_builder.unsaved')}
                </span>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-zinc-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-zinc-600">
                  {t('cmsshared.menu_builder.empty_title')}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {t('cmsshared.menu_builder.empty_description')}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <SortableMenuRow
                        key={item.id}
                        item={item}
                        index={index}
                        items={items}
                        onPatch={(patch) => patchItem(item.id, patch)}
                        onIndent={() => indentItem(item.id)}
                        onOutdent={() => outdentItem(item.id)}
                        onDelete={() =>
                          commit(items.filter((entry) => entry.id !== item.id))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {items.some((item) => item.depth === 1) ? (
              <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <ExternalLink size={11} /> {t('cmsshared.menu_builder.indent_note')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Location + save */}
      <Card>
        <CardHeader>
          <CardTitle>{t('cmsshared.menu_builder.location_title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <fieldset className="flex flex-wrap gap-2">
            {NAV_MENU_LOCATIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                  location === option.value
                    ? 'border-[#6d6be8] bg-[#6d6be8]/5 text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300',
                )}
              >
                <input
                  type="radio"
                  name="nav-menu-location"
                  className="accent-[#6d6be8]"
                  checked={location === option.value}
                  onChange={() => {
                    setLocation(option.value);
                    setDirty(true);
                  }}
                />
                {t(LOCATION_LABEL_KEYS[option.value])}
              </label>
            ))}
          </fieldset>

          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('cmsshared.menu_builder.saving') : t('cmsshared.menu_builder.save_menu')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
