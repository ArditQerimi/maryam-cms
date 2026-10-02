'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
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
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Layers,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  Redo2,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react';
import {
  BLOCK_DEFS,
  BLOCK_GROUPS,
  BLOCK_LIST,
  cloneBlock,
  countBlocks,
  createBlock,
  createColumn,
  createRow,
  getTransformTargets,
  isBlockType,
  normalizeBlocks,
  transformBlock,
  type Block,
  type Breakpoint,
  type FieldDef,
  type FieldTab,
  type NodeType,
} from './blocks';
import BlockRenderer, { type RendererProduct } from './BlockRenderer';
import { PRODUCT_SOURCE_OPTIONS } from './product-sources';
import { tr } from './labels';
import MediaPickerModal, { type PickedMedia } from '@/components/admin/MediaPickerModal';
import { Button, cn, inputClass } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { parseImageUrl } from '@/lib/image-url';

/** Active-locale copy helpers: `t` for keyed strings, `L` for registry labels. */
function useCopy() {
  const { t } = useLocale();
  return { t, L: (text: string) => tr(t, text) };
}

type MediaTarget = { path: string; multi: boolean } | null;

type PanelTab = 'modules' | 'rows' | 'templates' | 'saved';

/** Live drop indicator produced while dragging onto the canvas. */
type DropHint = {
  /**
   * - `page` — the page-level row list (index splices rows)
   * - `row`  — a row's column list (column moves) or a bare row to fill
   * - `column` — a column's children list (modules and nested rows)
   */
  target: 'page' | 'row' | 'column' | 'module';
  id: string;
  /** Insert position inside the target container. */
  index: number;
  /** Direction the drop line is drawn: `vertical` = stacking top to bottom. */
  orientation: 'horizontal' | 'vertical';
};

type DragPayload =
  | { kind: 'move'; id: string }
  | { kind: 'new-module'; blockType: NodeType }
  | { kind: 'new-row'; widths: number[] };

type DragState = {
  payload: DragPayload;
  hint: DropHint | null;
  /** Viewport box of the drop target, used for the highlight ring. */
  box: { top: number; left: number; width: number; height: number } | null;
  point: { x: number; y: number } | null;
};

type NodeKind = 'row' | 'column' | 'module';

/** Hover/selection colours per node kind, so nesting stays legible. */
const KIND_ACCENT: Record<NodeKind, { chip: string; ring: string }> = {
  row: { chip: 'bg-sky-600', ring: 'ring-sky-500' },
  column: { chip: 'bg-violet-600', ring: 'ring-violet-500' },
  module: { chip: 'bg-[#6d6be8]', ring: 'ring-[#6d6be8]' },
};

const PANEL_TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'modules', label: 'Modules' },
  { id: 'rows', label: 'Rows' },
  { id: 'templates', label: 'Templates' },
  { id: 'saved', label: 'Saved' },
];

/** Rows tab: visual column-layout presets (thumbnail = real proportions). */
const ROW_PRESETS: Array<{ id: string; label: string; widths: number[] }> = [
  { id: '1', label: '1 Column', widths: [100] },
  { id: '2', label: '2 Columns', widths: [50, 50] },
  { id: '3', label: '3 Columns', widths: [33.34, 33.33, 33.33] },
  { id: '4', label: '4 Columns', widths: [25, 25, 25, 25] },
  { id: '5', label: '5 Columns', widths: [20, 20, 20, 20, 20] },
  { id: '6', label: '6 Columns', widths: [16.67, 16.67, 16.66, 16.67, 16.67, 16.66] },
  { id: 'left-sidebar', label: 'Left Sidebar', widths: [30, 70] },
  { id: 'right-sidebar', label: 'Right Sidebar', widths: [70, 30] },
  { id: 'both-sidebars', label: 'Left & Right Sidebar', widths: [25, 50, 25] },
];

/** Does `root` contain `id`? Used to reject dropping a node inside itself. */
function containsBlock(root: Block, id: string): boolean {
  if (root.id === id) return true;
  return (root.children || []).some((child) => containsBlock(child, id));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------- tree utils */

function setByPath(source: any, path: string, value: unknown) {
  const parts = path.split('.');
  const clone = Array.isArray(source) ? [...source] : { ...source };
  let cursor: any = clone;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : { ...(cursor[key] ?? {}) };
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return clone;
}

function getByPath(source: any, path: string): any {
  return path.split('.').reduce((cursor, key) => (cursor == null ? cursor : cursor[key]), source);
}

function mapTree(blocks: Block[], id: string, updater: (block: Block) => Block): Block[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (block.children?.length) {
      return { ...block, children: mapTree(block.children, id, updater) };
    }
    return block;
  });
}

function removeTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) =>
      block.children?.length ? { ...block, children: removeTree(block.children, id) } : block,
    );
}

function insertChild(blocks: Block[], parentId: string, child: Block): Block[] {
  return blocks.map((block) => {
    if (block.id === parentId) {
      return { ...block, children: [...(block.children || []), child] };
    }
    if (block.children?.length) {
      return { ...block, children: insertChild(block.children, parentId, child) };
    }
    return block;
  });
}

function findBlock(blocks: Block[], id: string | null): Block | null {
  if (!id) return null;
  for (const block of blocks) {
    if (block.id === id) return block;
    const nested = findBlock(block.children || [], id);
    if (nested) return nested;
  }
  return null;
}

/** The direct parent of `id`, or `null` when it sits at the top level. */
function findParent(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.children?.some((child) => child.id === id)) return block;
    const nested = findParent(block.children || [], id);
    if (nested) return nested;
  }
  return null;
}

/* ---------------------------------------------------------------- sortable */

/**
 * Anything that can start a canvas drag (library tile, row preset, toolbar
 * grip). dnd-kit owns the pointer tracking; a plain click still reaches
 * `onClick` because the drag only begins after a few pixels of movement.
 */
function DragSource({
  id,
  data,
  disabled,
  title,
  ariaLabel,
  className,
  onClick,
  children,
}: {
  id: string;
  data: DragPayload;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { listeners, setNodeRef } = useDraggable({ id, data, disabled });
  return (
    <button
      type="button"
      ref={setNodeRef}
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
    >
      {children}
    </button>
  );
}

/**
 * The hover/selection surface over a node. It also starts a drag, so a module
 * (or column/row) can be grabbed anywhere on its body, Elementor-style — not
 * only by the toolbar grip. A plain click still just selects it.
 */
function DragSurface({
  id,
  data,
  disabled,
  className,
  style,
  onClick,
}: {
  id: string;
  data: DragPayload;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { listeners, setNodeRef } = useDraggable({ id, data, disabled });
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={style}
      onClick={onClick}
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined}
    />
  );
}

function SortableCard({
  block,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  children,
  compact,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { t, L } = useCopy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { type: block.type },
  });

  const def = BLOCK_DEFS[block.type];
  const Icon = def?.icon || Layers;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-30 opacity-70')}
    >
      <div
        onClick={onSelect}
        className={cn(
          'relative rounded-xl border bg-white transition',
          selected
            ? 'border-[#6d6be8] ring-2 ring-[#6d6be8]/25'
            : 'border-zinc-200 hover:border-zinc-300',
          compact && 'rounded-lg',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2',
            selected ? 'bg-[#6d6be8]/5' : 'bg-zinc-50/70',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={L('Drag to reorder')}
              onClick={(event) => event.stopPropagation()}
              className="cursor-grab touch-none text-zinc-400 transition hover:text-zinc-600 active:cursor-grabbing"
            >
              <GripVertical size={15} />
            </button>
            <Icon size={14} className={cn('shrink-0', def?.accent || 'text-zinc-400')} />
            <span className="truncate text-xs font-semibold text-zinc-700">
              {def ? L(def.label) : block.type}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDuplicate ? (
              <button
                type="button"
                aria-label={L('Duplicate block')}
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate();
                }}
                className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
              >
                <Copy size={13} />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={L('Delete block')}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="pointer-events-none p-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ settings UI */

function FieldControl({
  field,
  value,
  onChange,
  onPickMedia,
  categories,
  products,
}: {
  field: FieldDef;
  value: any;
  onChange: (value: unknown) => void;
  /** `subPath` addresses a field nested inside this one (repeater rows). */
  onPickMedia: (multi: boolean, subPath?: string) => void;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
}) {
  const { t, L } = useCopy();
  const label = (
    <span className="mb-1.5 block text-xs font-medium text-zinc-600">{L(field.label)}</span>
  );
  const [term, setTerm] = useState('');

  switch (field.kind) {
    case 'text':
      return (
        <div>
          {label}
          <input
            className={inputClass}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case 'link': {
      const listId = `link-options-${field.key}`;
      const routes: Array<[string, string]> = [
        ['/home', L('Home page')],
        ['/home/products', L('All products')],
        ['/home/blogs', L('Blog')],
        ['/home/about-us', L('About us')],
        ['/home/contact', L('Contact')],
        ['/home/cart', L('Cart')],
        ['/home/checkout', L('Checkout')],
        ['/home/account', L('My account')],
      ];
      return (
        <div>
          {label}
          <input
            className={inputClass}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            list={listId}
            onChange={(event) => onChange(event.target.value)}
          />
          <datalist id={listId}>
            {routes.map(([url, name]) => (
              <option key={url} value={url}>
                {name}
              </option>
            ))}
            {products.slice(0, 200).map((product) => (
              <option key={product.id} value={`/home/products/${product.id}`}>
                {product.name}
              </option>
            ))}
          </datalist>
          <p className="mt-1 text-[10px] text-zinc-400">
            {L('Pick a page or product, or paste any address.')}
          </p>
        </div>
      );
    }

    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            className={cn(inputClass, 'min-h-20 resize-y')}
            rows={field.rows || 3}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case 'richtext':
      return (
        <div>
          {label}
          <textarea
            className={cn(inputClass, 'min-h-32 resize-y')}
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            {L('Basic HTML allowed: <p> <strong> <em> <a> <br>')}
          </p>
        </div>
      );

    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            className={inputClass}
            value={value === undefined || value === null ? '' : Number(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          {label}
          <select
            className={cn(inputClass, 'appearance-none')}
            value={value ?? ''}
            onChange={(event) => {
              const option = field.options.find((entry) => String(entry.value) === event.target.value);
              onChange(option ? option.value : event.target.value);
            }}
          >
            {field.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {L(option.label)}
              </option>
            ))}
          </select>
        </div>
      );

    case 'color':
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-11 cursor-pointer rounded border border-zinc-300 bg-white p-1"
              value={value || '#000000'}
              onChange={(event) => onChange(event.target.value)}
            />
            <input
              className={cn(inputClass, 'flex-1')}
              value={String(value ?? '')}
              placeholder="inherit"
              onChange={(event) => onChange(event.target.value)}
            />
            {value ? (
              <button
                type="button"
                className="text-[11px] text-zinc-400 hover:text-zinc-600"
                onClick={() => onChange('')}
              >
                {L('reset')}
              </button>
            ) : null}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <span className="text-xs font-medium text-zinc-600">{L(field.label)}</span>
          <span
            className={cn(
              'relative h-5 w-9 rounded-full transition',
              value ? 'bg-[#6d6be8]' : 'bg-zinc-300',
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition',
                value ? 'left-[18px]' : 'left-0.5',
              )}
            />
          </span>
        </label>
      );

    case 'range':
      return (
        <div>
          {label}
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="flex-1 accent-[#6d6be8]"
              min={field.min}
              max={field.max}
              step={field.step || 1}
              value={Number(value ?? field.min)}
              onChange={(event) => onChange(Number(event.target.value))}
            />
            <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
              {Number(value ?? 0)}
              {field.unit || ''}
            </span>
          </div>
        </div>
      );

    case 'image':
      return (
        <div>
          {label}
          <button
            type="button"
            onClick={() => onPickMedia(false)}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-2 text-left transition hover:border-[#6d6be8]"
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={String(value)} alt="" className="h-12 w-12 rounded object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded bg-zinc-100 text-zinc-400">
                <ImagePlus size={16} />
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {value ? L('Change image') : L('Choose from media library')}
            </span>
          </button>
          {value ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
              onClick={() => onChange('')}
            >
              {L('Remove')}
            </button>
          ) : null}
        </div>
      );

    case 'images': {
      const list: PickedMedia[] = Array.isArray(value) ? value : [];
      return (
        <div>
          {label}
          <div className="grid grid-cols-3 gap-2">
            {list.map((item, index) => (
              <div key={`${item.url}-${index}`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="aspect-square w-full rounded object-cover" />
                <button
                  type="button"
                  aria-label={L('Remove image')}
                  onClick={() => onChange(list.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 rounded bg-zinc-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onPickMedia(true)}
              className="flex aspect-square items-center justify-center rounded border border-dashed border-zinc-300 text-zinc-400 transition hover:border-[#6d6be8] hover:text-[#6d6be8]"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      );
    }

    case 'heading':
      return (
        <div>
          {label}
          <div className="grid grid-cols-6 gap-1">
            {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onChange(level)}
                className={cn(
                  'rounded border py-1.5 text-xs font-semibold capitalize transition',
                  value === level
                    ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      );

    case 'alignment':
      return (
        <div>
          {label}
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onChange(align)}
                className={cn(
                  'rounded border py-1.5 text-xs capitalize transition',
                  (value || 'left') === align
                    ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {L(align)}
              </button>
            ))}
          </div>
        </div>
      );

    case 'spacing':
      return (
        <div>
          {label}
          <div className="grid grid-cols-4 gap-1">
            {['none', 'small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange(size)}
                className={cn(
                  'rounded border py-1.5 text-[11px] capitalize transition',
                  (value || 'large') === size
                    ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {L(size)}
              </button>
            ))}
          </div>
        </div>
      );

    case 'box': {
      const current: Record<string, number> =
        value && typeof value === 'object' && !Array.isArray(value)
          ? { top: 0, right: 0, bottom: 0, left: 0, ...(value as Record<string, number>) }
          : { top: 0, right: 0, bottom: 0, left: 0 };
      const labels: Record<string, string> = {
        top: 'Top',
        right: 'Right',
        bottom: 'Bottom',
        left: 'Left',
      };
      const update = (side: string, raw: string) => {
        const num = Number(raw);
        onChange({ ...current, [side]: Number.isFinite(num) ? num : 0 });
      };
      return (
        <div>
          {label}
          <div className="grid grid-cols-4 gap-1">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <label key={side} className="flex flex-col items-center gap-0.5" title={t('cmscontent.builder.boxSideTitle', { side: L(labels[side]), field: L(field.label) })}>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                  {L(labels[side])[0]}
                </span>
                <input
                  type="number"
                  min={0}
                  step={4}
                  aria-label={t('cmscontent.builder.boxSidePixels', { side: L(labels[side]), field: L(field.label) })}
                  className={cn(inputClass, 'px-1 py-1 text-center text-[11px]')}
                  value={Number.isFinite(Number(current[side])) ? Number(current[side]) : 0}
                  onChange={(event) => update(side, event.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            {L('Pixels — top, right, bottom, left.')}
          </p>
        </div>
      );
    }

    case 'columns':
      return (
        <div>
          {label}
          <div className="grid grid-cols-3 gap-1">
            {['2', '3', '4'].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChange(count)}
                className={cn(
                  'rounded border py-1.5 text-xs transition',
                  String(value) === count
                    ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      );

    case 'category':
      return (
        <div>
          {label}
          <select
            className={cn(inputClass, 'appearance-none')}
            value={String(value ?? 0)}
            onChange={(event) => onChange(Number(event.target.value))}
          >
            <option value="0">{L('All categories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      );

    case 'productSource': {
      const current = String(value ?? 'latest');
      const option = PRODUCT_SOURCE_OPTIONS.find((entry) => entry.value === current);
      return (
        <div className="space-y-3">
          <div>
            {label}
            <select
              className={cn(inputClass, 'appearance-none')}
              value={current}
              onChange={(event) => onChange(event.target.value)}
            >
              {PRODUCT_SOURCE_OPTIONS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {L(entry.label)}
                </option>
              ))}
            </select>
          </div>
          {option?.hint ? <p className="text-[11px] text-zinc-400">{L(option.hint)}</p> : null}
        </div>
      );
    }

    case 'products': {
      const ids: number[] = Array.isArray(value) ? value.map(Number) : [];
      const visible = products.filter((product) =>
        term ? product.name.toLowerCase().includes(term.toLowerCase()) : true,
      );
      return (
        <div>
          {label}
          <input
            className={cn(inputClass, 'mb-2 py-1.5 text-xs')}
            placeholder={L('Search products…')}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-1.5">
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-zinc-400">
                {L('No products found.')}
              </p>
            ) : (
              visible.map((product) => {
                const checked = ids.includes(product.id);
                return (
                  <label
                    key={product.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition',
                      checked ? 'bg-[#6d6be8]/10 text-[#4f4dd6]' : 'text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#6d6be8]"
                      checked={checked}
                      onChange={() =>
                        onChange(
                          checked
                            ? ids.filter((id) => id !== product.id)
                            : [...ids, product.id],
                        )
                      }
                    />
                    <span className="truncate">{product.name}</span>
                  </label>
                );
              })
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {t('cmscontent.builder.selectedCount', { count: ids.length })}
          </p>
        </div>
      );
    }

    case 'items':
      return (
        <ItemsField
          field={field}
          items={Array.isArray(value) ? value : []}
          onChange={onChange}
          onPickMedia={onPickMedia}
          categories={categories}
          products={products}
        />
      );

    default:
      return null;
  }
}

/** One repeater row. The whole card moves, but only the grip starts a drag. */
function SortableItemCard({
  id,
  label,
  onRemove,
  children,
}: {
  id: string;
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { t } = useCopy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-lg border border-zinc-200 bg-zinc-50/60 p-3',
        isDragging && 'relative z-10 shadow-lg ring-1 ring-[#6d6be8]',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('cmscontent.builder.reorderItem', { label })}
            className="cursor-grab rounded p-1 text-zinc-300 hover:bg-white hover:text-zinc-600 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={12} />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {label}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('cmscontent.builder.remove')}
          onClick={onRemove}
          className="rounded p-1 text-zinc-400 hover:bg-white hover:text-red-600"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Repeater control (hero slides, FAQ entries…) with drag-to-reorder rows. */
function ItemsField({
  field,
  items,
  onChange,
  onPickMedia,
  categories,
  products,
}: {
  field: Extract<FieldDef, { kind: 'items' }>;
  items: Array<Record<string, unknown>>;
  onChange: (value: unknown) => void;
  /** `subPath` addresses a field nested inside this one (repeater rows). */
  onPickMedia: (multi: boolean, subPath?: string) => void;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
}) {
  const { t, L } = useCopy();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Rows have no stable id of their own, so the index is the drag id — safe
  // because the order only changes once the drop has been applied.
  const ids = items.map((_, index) => `item-${index}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">{L(field.label)}</span>
        <span className="text-[11px] text-zinc-400">{items.length}</span>
      </div>
      <div className="space-y-2">
        {/* Stable id: dnd-kit otherwise numbers its aria ids from a global
            counter, which drifts between the server and client renders. */}
        <DndContext
          id={`items-${field.key}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableItemCard
                  key={index}
                  id={ids[index]}
                  label={`${L(field.itemLabel)} ${index + 1}`}
                  onRemove={() => onChange(items.filter((_, i) => i !== index))}
                >
                  {field.fields.map((nested) => (
                    <div key={nested.key} className="pl-1">
                      <FieldControl
                        field={nested}
                        value={getByPath(item, nested.key)}
                        onChange={(next) => onChange(setByPath(items, `${index}.${nested.key}`, next))}
                        onPickMedia={(multi, subPath) =>
                          onPickMedia(
                            multi,
                            subPath
                              ? `${index}.${nested.key}.${subPath}`
                              : `${index}.${nested.key}`,
                          )
                        }
                        categories={categories}
                        products={products}
                      />
                    </div>
                  ))}
                </SortableItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange([...items, {}])}
        >
          <Plus size={13} /> {L(field.addLabel)}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- builder */

export default function PageBuilder({
  initialBlocks,
  onChange,
  pageLabel = 'this page',
  previewTheme,
  onSave,
}: {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  /** Shown in the full-screen header so you know what you are editing. */
  pageLabel?: string;
  /** Storefront `--cms-*` variables so the canvas previews the real theme. */
  previewTheme?: Record<string, string>;
  /** Wired by the host form so `Ctrl/Cmd+S` publishes from inside the shell. */
  onSave?: () => void | Promise<void>;
}) {
  const { t, L } = useCopy();
  const [fullscreen, setFullscreen] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(initialBlocks));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>(null);
  const [products, setProducts] = useState<
    Array<{
      id: number;
      name: string;
      price?: string | number | null;
      imageUrl?: string | null;
      stock?: number | null;
      categoryId?: number | null;
      status?: string | null;
      createdAt?: string | number | null;
      soldCount?: number | null;
      salePrice?: string | number | null;
      rating?: number | null;
    }>
  >([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [pickerFilter, setPickerFilter] = useState('');

  /* ---------------------------------------------------------- shell state */
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [previewMode, setPreviewMode] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('modules');
  const [settingsTab, setSettingsTab] = useState<FieldTab>('general');
  const [moduleGroup, setModuleGroup] = useState('all');
  /** Node whose "Transform to" menu is open. */
  const [transformMenuFor, setTransformMenuFor] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Live drag over the canvas: what is dragged and where it would land. */
  const [drag, setDrag] = useState<DragState | null>(null);
  /** True right after a drop, so the source tile's `click` does not also fire. */
  const justDroppedRef = useRef(false);
  /** Latest pointer position and payload of the drag dnd-kit is running. */
  const dragPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  /** Scrollable canvas, auto-scrolled while a drag nears its top/bottom edge. */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /** Where the selected module's toolbar floats, in canvas-content coordinates. */
  const [moduleToolbarBox, setModuleToolbarBox] = useState<{ top: number; left: number } | null>(null);

  /* -------------------------------------------------------------- history */
  const historyRef = useRef<Block[][]>([blocks]);
  const pointerRef = useRef(0);
  const blocksRef = useRef<Block[]>(blocks);
  blocksRef.current = blocks;
  const [histFlags, setHistFlags] = useState({ canUndo: false, canRedo: false });

  // Initial sync only; every later change is pushed by `commit`.
  useEffect(() => {
    onChange(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cms/products?limit=500', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setProducts(Array.isArray(data.items) ? data.items : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => findBlock(blocks, selectedId), [blocks, selectedId]);
  const selectedDef = selected ? BLOCK_DEFS[selected.type] : null;

  /** The catalogue mapped the way `BlockRenderer` renders it, so the canvas
   *  shows the real products instead of the empty-state placeholder. */
  const canvasProducts = useMemo<RendererProduct[]>(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        price: String(product.price ?? ''),
        // Media-library rows can store JSON arrays; parseImageUrl unwraps them.
        image: parseImageUrl(product.imageUrl) || null,
        href: `/home/products/${product.id}`,
        stock: product.stock ?? null,
        categoryId: product.categoryId ?? null,
        // Automatic sources: new-arrivals order, best-seller rank, sale price.
        createdAt: product.createdAt ?? null,
        soldCount: product.soldCount ?? 0,
        salePrice: product.salePrice ?? null,
        rating: product.rating ?? 0,
        status: product.status ?? null,
      })),
    [products],
  );

  /** Append a snapshot to the history stack (max 60 steps, ≥50 as spec asks). */
  function pushHistory(next: Block[]) {
    const history = historyRef.current.slice(0, pointerRef.current + 1);
    history.push(next);
    while (history.length > 60) history.shift();
    historyRef.current = history;
    pointerRef.current = history.length - 1;
    setHistFlags({ canUndo: pointerRef.current > 0, canRedo: false });
  }

  /** Every mutation goes through here, so the parent is told synchronously —
   *  waiting on an effect let a save read the pre-edit array. */
  function commit(next: Block[]) {
    const snapshot = historyRef.current[pointerRef.current];
    if (snapshot && JSON.stringify(snapshot) === JSON.stringify(next)) return; // no-op edit
    setBlocks(next);
    pushHistory(next);
    onChange(next);
  }

  /** Apply a change WITHOUT touching history — used while dragging a gutter. */
  function liveSet(next: Block[]) {
    setBlocks(next);
    onChange(next);
  }

  function jumpTo(index: number) {
    const history = historyRef.current;
    if (index < 0 || index >= history.length) return;
    pointerRef.current = index;
    const snapshot = history[index];
    setBlocks(snapshot);
    onChange(snapshot);
    setHistFlags({ canUndo: index > 0, canRedo: index < history.length - 1 });
  }

  const undo = () => jumpTo(pointerRef.current - 1);
  const redo = () => jumpTo(pointerRef.current + 1);

  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash((current) => (current === message ? null : current)), 1800);
  }

  async function saveNow() {
    if (!onSave) return;
    try {
      await onSave();
      showFlash(t('cmscontent.builder.savedFlash'));
    } catch {
      showFlash(t('cmscontent.builder.saveFailed'));
    }
  }

  function removeNode(id: string) {
    commit(removeTree(blocksRef.current, id));
    if (selectedId === id) setSelectedId(null);
  }

  /** Move a node one step inside its parent (keyboard-friendly "move to"). */
  function moveNode(id: string, delta: number) {
    const tree = blocksRef.current;
    const parent = findParent(tree, id);
    const siblings = parent ? parent.children || [] : tree;
    const index = siblings.findIndex((entry) => entry.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const moved = arrayMove(siblings, index, target);
    commit(parent ? mapTree(tree, parent.id, (node) => ({ ...node, children: moved })) : moved);
  }

  // Shortcuts: undo/redo, save, delete the selection, escape to deselect.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable),
      );
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        void saveNow();
        return;
      }
      if (typing) return;
      if (event.key === 'Escape') {
        setDrag(null);
        setTransformMenuFor(null);
        setSelectedId(null);
        if (previewMode) setPreviewMode(false);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeNode(selectedId);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

/**
   * One click "make this a carousel": the row's current layout (e.g. image |
   * text) becomes slide 1, nested inside a full-width column, and the row is
   * switched to carousel mode. More slides are copies of the last one.
   */
  function makeCarousel(rowId: string) {
    const tree = blocksRef.current;
    const row = findBlock(tree, rowId);
    if (!row || row.type !== 'row') return;
    const inner = createRow(1);
    inner.props = {
      ...inner.props,
      valign: row.props.valign ?? 'center',
      gap: row.props.gap ?? 24,
    };
    inner.children = row.children || [];
    const slide = createColumn(100, [inner]);
    commit(
      mapTree(tree, rowId, (entry) => ({
        ...entry,
        props: {
          ...entry.props,
          layout: 'carousel',
          slidesPerView: 1,
          autoplay: true,
          intervalSeconds: Number(entry.props.intervalSeconds) || 5,
          arrows: true,
          dots: true,
        },
        children: [slide],
      })),
    );
    setSelectedId(rowId);
  }

  /** Carousel rows: append a copy of the last slide (fresh ids), ready to edit. */
  function addSlide(rowId: string) {
    const tree = blocksRef.current;
    const row = findBlock(tree, rowId);
    const slides = row?.children || [];
    if (!row || !slides.length) return;
    const copy = cloneBlock(slides[slides.length - 1]);
    commit(mapTree(tree, rowId, (entry) => ({ ...entry, children: [...slides, copy] })));
    showFlash(L('Slide added — use the arrows on the canvas to reach it.'));
  }

  /** Re-shape a row to `widths` columns; content of removed columns moves into the last one kept. */
  function setRowLayout(rowId: string, widths: number[]) {
    const tree = blocksRef.current;
    const row = findBlock(tree, rowId);
    if (!row || row.type !== 'row') return;
    const columns = [...(row.children || [])];
    let next: Block[];
    if (widths.length >= columns.length) {
      next = widths.map((width, index) =>
        columns[index]
          ? { ...columns[index], props: { ...columns[index].props, width } }
          : createColumn(width),
      );
    } else {
      const kept = columns.slice(0, widths.length);
      const spill = columns.slice(widths.length).flatMap((column) => column.children || []);
      next = kept.map((column, index) => ({
        ...column,
        props: { ...column.props, width: widths[index] },
        children:
          index === kept.length - 1 ? [...(column.children || []), ...spill] : column.children,
      }));
    }
    commit(mapTree(tree, rowId, (entry) => ({ ...entry, children: next })));
  }

  /** WordPress-style "Transform to": same block, new type, text kept. */
  function transformNode(id: string, target: { type: NodeType; level?: string }) {
    const current = findBlock(blocksRef.current, id);
    setTransformMenuFor(null);
    if (!current) return;
    const next = transformBlock(current, target);
    commit(mapTree(blocksRef.current, id, () => next));
    setSelectedId(id);
  }

  // Follow the selected module (scroll, resize, carousel paging, edits) so its
  // floating toolbar stays glued just above it.
  const selectedIsModule = Boolean(
    selectedId && !previewMode && (() => {
      const node = findBlock(blocks, selectedId);
      return node && node.type !== 'row' && node.type !== 'column';
    })(),
  );
  useEffect(() => {
    // Nothing to follow: the toolbar is simply not rendered (see the canvas).
    if (!selectedIsModule || !selectedId) return;
    let frame = 0;
    let last = '';
    const measure = () => {
      const canvas = canvasRef.current;
      const target = canvas?.querySelector(`[data-node="${selectedId}"]`) as HTMLElement | null;
      if (canvas && target) {
        const rect = target.getBoundingClientRect();
        const base = canvas.getBoundingClientRect();
        let top = rect.top - base.top + canvas.scrollTop - 34;
        // At the very top of the canvas, tuck it inside the module instead.
        if (top < canvas.scrollTop) top = rect.top - base.top + canvas.scrollTop + 4;
        const left = Math.max(4, rect.left - base.left + canvas.scrollLeft);
        const key = `${Math.round(top)}:${Math.round(left)}`;
        if (key !== last) {
          last = key;
          setModuleToolbarBox({ top, left });
        }
      }
      frame = window.requestAnimationFrame(measure);
    };
    frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [selectedIsModule, selectedId]);

  // The canvas is not an ancestor of the library tiles, so dnd-kit's own
  // auto-scroll never reaches it: scroll it while the pointer rests near an edge.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      const point = dragPointRef.current;
      const payload = dragPayloadRef.current;
      if (canvas && point && payload) {
        const rect = canvas.getBoundingClientRect();
        const edge = 64;
        let dy = 0;
        if (point.x >= rect.left && point.x <= rect.right) {
          if (point.y < rect.top + edge) {
            dy = -Math.min(24, Math.ceil((rect.top + edge - point.y) / 3));
          } else if (point.y > rect.bottom - edge) {
            dy = Math.min(24, Math.ceil((point.y - (rect.bottom - edge)) / 3));
          }
        }
        if (dy !== 0) {
          const before = canvas.scrollTop;
          canvas.scrollTop += dy;
          if (canvas.scrollTop !== before) setDrag(computeDrag(payload, point));
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  function addBlock(type: NodeType, parentId?: string | null) {
    // The old flat `columns_N` blocks are expressed as real rows now.
    const legacyCount =
      type === 'columns_2' ? 2 : type === 'columns_3' ? 3 : type === 'columns_4' ? 4 : 0;
    const block = legacyCount ? createRow(legacyCount) : createBlock(type);

    const parent = parentId ? findBlock(blocks, parentId) : null;
    const canNest =
      parent &&
      (parent.type === 'row' || parent.type === 'column' || Boolean(parent.children));

    if (parent && canNest) {
      let next = blocks;
      let targetId = parent.id;
      if (parent.type === 'row') {
        if (parent.children?.length) {
          // Modules live inside columns, never directly under a row.
          targetId = parent.children[parent.children.length - 1].id;
        } else {
          const column = createColumn(100);
          next = mapTree(next, parent.id, (node) => ({ ...node, children: [column] }));
          targetId = column.id;
        }
      }
      commit(insertChild(next, targetId, block));
      setSelectedId(block.id);
      return;
    }
    // The page level only holds rows, so a lone module gets its own row.
    if (block.type === 'row' || block.type === 'column') {
      commit([...blocks, block]);
    } else {
      const row = createRow(1);
      row.children = [createColumn(100, [block])];
      commit([...blocks, row]);
    }
    setSelectedId(block.id);
  }

  function patchProps(id: string, path: string, value: unknown) {
    commit(
      mapTree(blocks, id, (block) => ({
        ...block,
        props: setByPath(block.props, path, value),
      })),
    );
  }

  /** Ticking products in the picker also flips the source to "manual" — in one
   *  history step — so the picks actually take effect as soon as they exist. */
  function patchProductPick(id: string, path: string, value: unknown) {
    commit(
      mapTree(blocks, id, (block) => ({
        ...block,
        props: setByPath(setByPath(block.props, path, value), 'source', 'manual'),
      })),
    );
  }

  function reorderChild(parentId: string, index: number, delta: number) {
    const parent = findBlock(blocks, parentId);
    if (!parent?.children) return;
    const target = index + delta;
    if (target < 0 || target >= parent.children.length) return;
    commit(
      mapTree(blocks, parentId, (block) => ({
        ...block,
        children: arrayMove(block.children || [], index, target),
      })),
    );
  }

  const filteredDefs = BLOCK_LIST.filter((def) =>
    L(def.label).toLowerCase().includes(pickerFilter.trim().toLowerCase()),
  );
  const groupDefs = filteredDefs.filter(
    (def) => moduleGroup === 'all' || def.group === moduleGroup,
  );

  const settingsTabs: FieldTab[] = ['general', 'style', 'advanced'];
  const settingsFields = selectedDef
    ? selectedDef.fields.filter((field) => {
        // A category only matters when the source select asks for one.
        if (
          field.kind === 'category' &&
          typeof selected?.props.source === 'string' &&
          selected?.props.source !== 'category'
        ) {
          return false;
        }
        return (field.tab ?? 'general') === settingsTab;
      })
    : [];

  /* ------------------------------------------------------------ drag & drop */

  /** Short name for the floating drag label. */
  function dragLabel(payload: DragPayload): string {
    if (payload.kind === 'new-row') return L('Row');
    const type =
      payload.kind === 'new-module'
        ? payload.blockType
        : findBlock(blocks, payload.id)?.type;
    const def = type ? BLOCK_DEFS[type] : null;
    return def ? L(def.label) : L('Row');
  }

  /** Where would `payload` land if dropped at `point` right now? */
  function computeDrag(
    payload: DragPayload,
    point: { x: number; y: number },
  ): DragState {
    const empty: DragState = { payload, hint: null, box: null, point };
    const host =
      (document
        .elementsFromPoint(point.x, point.y)
        .map((entry) => (entry as HTMLElement).closest?.('[data-node]'))
        .find(Boolean) as HTMLElement | undefined) ?? null;
    if (!host) return empty;

    const tree = blocksRef.current;
    const rectOf = (nodeId: string) => {
      const found = document.querySelector(`[data-node="${nodeId}"]`) as HTMLElement | null;
      return found ? found.getBoundingClientRect() : null;
    };
    const boxOf = (rect: DOMRect | null) =>
      rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
    const id = host.dataset.node || '';

    // Margin of the canvas, or the empty-page placeholder.
    if (id === 'page') {
      return {
        payload,
        hint: { target: 'page', id: 'page', index: tree.length, orientation: 'vertical' },
        box: boxOf(host.getBoundingClientRect()),
        point,
      };
    }

    const node = findBlock(tree, id);
    if (!node) return empty;
    const hostRect = host.getBoundingClientRect();
    const moving = payload.kind === 'move' ? findBlock(tree, payload.id) : null;

    /** Insertion index inside `kids`, from the pointer along `axis`. */
    const indexFrom = (kids: Block[], axis: 'x' | 'y') => {
      for (let i = 0; i < kids.length; i += 1) {
        const rect = rectOf(kids[i].id);
        if (!rect) continue;
        const middle =
          axis === 'y' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
        if (axis === 'y' ? point.y < middle : point.x < middle) return i;
      }
      return kids.length;
    };

    // Moving a column: reposition it horizontally inside a row.
    if (moving?.type === 'column') {
      // Over a module (or a nested row) the pointer is deeper than the row the
      // column lives in: walk up until the row that holds columns.
      let row: Block | null = node.type === 'row' ? node : findParent(tree, node.id);
      while (row && row.type !== 'row') row = findParent(tree, row.id);
      if (!row) return empty;
      return {
        payload,
        hint: {
          target: 'row',
          id: row.id,
          index: indexFrom(row.children || [], 'x'),
          orientation: 'horizontal',
        },
        box: boxOf(rectOf(row.id) || hostRect),
        point,
      };
    }

    if (node.type === 'column') {
      return {
        payload,
        hint: {
          target: 'column',
          id: node.id,
          index: indexFrom(node.children || [], 'y'),
          orientation: 'vertical',
        },
        box: boxOf(hostRect),
        point,
      };
    }

    if (node.type === 'row') {
      const parent = findParent(tree, node.id);
      const droppingRow = payload.kind === 'new-row' || moving?.type === 'row';

      if (droppingRow && !parent) {
        const position = tree.findIndex((entry) => entry.id === node.id);
        return {
          payload,
          hint: {
            target: 'page',
            id: node.id,
            index: position + (point.y >= hostRect.top + hostRect.height / 2 ? 1 : 0),
            orientation: 'vertical',
          },
          box: boxOf(hostRect),
          point,
        };
      }

      const cols = node.children || [];
      if (!cols.length) {
        // A row without columns receives its first one on drop.
        return {
          payload,
          hint: { target: 'row', id: node.id, index: 0, orientation: 'vertical' },
          box: boxOf(hostRect),
          point,
        };
      }

      // Land in whichever column sits under the pointer (fallback: last).
      let target = cols[cols.length - 1];
      for (const col of cols) {
        const rect = rectOf(col.id);
        if (rect && point.x >= rect.left && point.x <= rect.right) {
          target = col;
          break;
        }
      }
      return {
        payload,
        hint: {
          target: 'column',
          id: target.id,
          index: indexFrom(target.children || [], 'y'),
          orientation: 'vertical',
        },
        box: boxOf(rectOf(target.id) || hostRect),
        point,
      };
    }

    // A module (or a nested row): drop beside it in the same column.
    const parent = findParent(tree, node.id);
    if (parent && parent.type === 'column') {
      const kids = parent.children || [];
      const index =
        kids.findIndex((entry) => entry.id === node.id) +
        (point.y >= hostRect.top + hostRect.height / 2 ? 1 : 0);
      return {
        payload,
        hint: { target: 'column', id: parent.id, index, orientation: 'vertical' },
        box: boxOf(rectOf(parent.id) || hostRect),
        point,
      };
    }
    return empty;
  }

  /** Apply a completed drop: remove the moved node first, then re-insert it. */
  function applyDrag(payload: DragPayload, hint: DropHint) {
    let tree = blocksRef.current;
    let node: Block;
    let fromIndex = -1;
    let sameContainer = false;

    if (payload.kind === 'move') {
      const moving = findBlock(tree, payload.id);
      if (!moving) return;
      if (containsBlock(moving, hint.id)) return; // never drop inside itself
      const oldParent = findParent(tree, payload.id);
      const oldSiblings = oldParent ? oldParent.children || [] : tree;
      fromIndex = oldSiblings.findIndex((entry) => entry.id === payload.id);
      sameContainer =
        hint.target === 'page' ? !oldParent : Boolean(oldParent) && oldParent?.id === hint.id;
      node = moving;
      tree = removeTree(tree, payload.id);
    } else if (payload.kind === 'new-module') {
      node = createBlock(payload.blockType);
    } else {
      node = createRow(payload.widths.length);
      node.children = payload.widths.map((width) => createColumn(width));
    }

    // The removal above shifted everything after the old position.
    let index = hint.index;
    if (sameContainer && fromIndex >= 0 && fromIndex < index) index -= 1;

    const clamp = (value: number, length: number) =>
      Math.min(Math.max(value, 0), length);
    const commitWith = (next: Block[]) => {
      commit(next);
      setSelectedId(node.id);
    };

    if (hint.target === 'page') {
      const next = [...tree];
      if (node.type !== 'row') {
        // A lone module dropped at page level gets a full-width row of its own.
        const row = createRow(1);
        row.children = [createColumn(100, [node])];
        next.splice(clamp(index, next.length), 0, row);
      } else {
        next.splice(clamp(index, next.length), 0, node);
      }
      commitWith(next);
      return;
    }

    if (hint.target === 'column') {
      const column = findBlock(tree, hint.id);
      if (!column || column.type !== 'column') return;
      commitWith(
        mapTree(tree, hint.id, (entry) => {
          const kids = [...(entry.children || [])];
          kids.splice(clamp(index, kids.length), 0, node);
          return { ...entry, children: kids };
        }),
      );
      return;
    }

    if (hint.target === 'row') {
      const row = findBlock(tree, hint.id);
      if (!row || row.type !== 'row') return;
      if (node.type === 'column') {
        commitWith(
          mapTree(tree, row.id, (entry) => {
            const kids = [...(entry.children || [])];
            kids.splice(clamp(index, kids.length), 0, node);
            return { ...entry, children: kids };
          }),
        );
        return;
      }
      if (node.type === 'row') {
        const position = tree.findIndex((entry) => entry.id === row.id);
        const next = [...tree];
        next.splice(position < 0 ? next.length : position + 1, 0, node);
        commitWith(next);
        return;
      }
      commitWith(
        mapTree(tree, row.id, (entry) => ({
          ...entry,
          children: [createColumn(100, [node])],
        })),
      );
    }
  }

  /* dnd-kit drives the gesture (sensors, Escape-to-cancel, overlay); the layout
     maths above turns the pointer position into a drop target. */
  function pointOf(event: { activatorEvent: Event; delta: { x: number; y: number } }) {
    const origin = event.activatorEvent as PointerEvent;
    return { x: origin.clientX + event.delta.x, y: origin.clientY + event.delta.y };
  }

  function endGesture() {
    dragPayloadRef.current = null;
    dragPointRef.current = null;
    document.body.classList.remove('select-none');
  }

  function handleDragStart(event: DragStartEvent) {
    const payload = event.active.data.current as DragPayload | undefined;
    if (!payload || previewMode) return;
    const origin = event.activatorEvent as PointerEvent;
    dragPayloadRef.current = payload;
    dragPointRef.current = { x: origin.clientX, y: origin.clientY };
    document.body.classList.add('select-none');
    setDrag(computeDrag(payload, dragPointRef.current));
  }

  function handleDragMove(event: DragMoveEvent) {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    const point = pointOf(event);
    dragPointRef.current = point;
    setDrag(computeDrag(payload, point));
  }

  function handleDragEnd(event: DragEndEvent) {
    const payload = dragPayloadRef.current;
    const point = pointOf(event);
    endGesture();
    setDrag(null);
    if (!payload) return;
    const final = computeDrag(payload, point);
    if (!final.hint) return;
    justDroppedRef.current = true;
    window.setTimeout(() => {
      justDroppedRef.current = false;
    }, 0);
    window.getSelection()?.removeAllRanges();
    applyDrag(payload, final.hint);
  }

  function handleDragCancel() {
    endGesture();
    setDrag(null);
  }

  function addRow(widths: number[]) {
    const row = createRow(widths.length);
    row.children = widths.map((width) => createColumn(width));
    commit([...blocksRef.current, row]);
    setSelectedId(row.id);
  }

  function duplicateNode(id: string) {
    const tree = blocksRef.current;
    const original = findBlock(tree, id);
    if (!original) return;
    const copy = cloneBlock(original);
    const parent = findParent(tree, id);
    const siblings = parent ? parent.children || [] : tree;
    const index = siblings.findIndex((entry) => entry.id === id);
    if (!parent) {
      const next = [...tree];
      next.splice(index + 1, 0, copy);
      commit(next);
    } else {
      commit(
        mapTree(tree, parent.id, (entry) => {
          const kids = [...(entry.children || [])];
          kids.splice(Math.max(index, 0) + 1, 0, copy);
          return { ...entry, children: kids };
        }),
      );
    }
    setSelectedId(copy.id);
  }

  /** Column seam: one history entry for the whole drag, live preview meanwhile. */
  function startResize(event: React.PointerEvent, rowId: string, index: number) {
    event.preventDefault();
    event.stopPropagation();
    const host = (event.currentTarget as HTMLElement).closest(
      '.bb-row-inner',
    ) as HTMLElement | null;
    const total = host?.getBoundingClientRect().width || 1000;
    const startX = event.clientX;
    const snapshot = blocksRef.current;

    const widths = (): [number, number] | null => {
      const row = findBlock(snapshot, rowId);
      const cols = row?.children || [];
      const previous = cols[index - 1];
      const next = cols[index];
      if (!previous || !next) return null;
      return [Number(previous.props.width) || 50, Number(next.props.width) || 50];
    };
    const pair = widths();
    if (!pair) return;
    const [startPrev, startNext] = pair;
    const min = 5;
    const max = Math.max(min, startPrev + startNext - min);

    const onMove = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / total) * 100;
      // 5% snap, and the pair always keeps adding up to what it started at.
      const width = Math.min(Math.max(Math.round((startPrev + delta) / 5) * 5, min), max);
      const other = round2(startPrev + startNext - width);
      liveSet(
        mapTree(blocksRef.current, rowId, (row) => ({
          ...row,
          children: (row.children || []).map((child, position) =>
            position === index - 1
              ? { ...child, props: { ...child.props, width } }
              : position === index
                ? { ...child, props: { ...child.props, width: other } }
                : child,
          ),
        })),
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      if (JSON.stringify(snapshot) !== JSON.stringify(blocksRef.current)) {
        pushHistory(blocksRef.current); // exactly one undo step for the drag
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  /** Keyboard equivalent of the gutter drag: Arrow keys, 5% steps. */
  function resizeByKey(event: React.KeyboardEvent, rowId: string, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const tree = blocksRef.current;
    const row = findBlock(tree, rowId);
    const cols = row?.children || [];
    const previous = cols[index - 1];
    const next = cols[index];
    if (!previous || !next) return;
    const before = Number(previous.props.width) || 50;
    const after = Number(next.props.width) || 50;
    const min = 5;
    const max = Math.max(min, before + after - min);
    const step = event.key === 'ArrowRight' ? 5 : -5;
    const width = Math.min(Math.max(before + step, min), max);
    const other = round2(before + after - width);
    commit(
      mapTree(tree, rowId, (entry) => ({
        ...entry,
        children: (entry.children || []).map((child, position) =>
          position === index - 1
            ? { ...child, props: { ...child.props, width } }
            : position === index
              ? { ...child, props: { ...child.props, width: other } }
              : child,
        ),
      })),
    );
  }

  /** Resize gutters, shown when their row is hovered (or focused). */
  function renderGutter(row: Block): React.ReactNode {
    const cols = row.children || [];
    if (cols.length < 2) return null;
    const gap = Number(row.props.gap) || 0;
    let before = 0; // Σ widths to the left of the current seam
    return (
      <>
        <style>{`.bb-${row.id}:hover .bb-gutter,.bb-gutter:focus{opacity:1}`}</style>
        {cols.map((col, position) => {
          const width = Number(col.props.width) || 0;
          const left = before;
          before += width;
          if (position === 0) return null;
          // Centre of the gap: widths so far, minus the shrink the gap costs.
          const offset = round2(
            (position - 1) * gap + gap / 2 - (gap * left) / 100,
          );
          return (
            <div
              key={`gutter-${col.id}`}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('cmscontent.builder.resizeColumns', {
                a: position,
                b: position + 1,
              })}
              tabIndex={0}
              className="bb-gutter absolute bottom-0 top-0 z-40 w-1.5 -translate-x-1/2 cursor-col-resize rounded-sm bg-amber-400/70 opacity-0 transition hover:bg-[#6d6be8] focus:outline-none focus:ring-2 focus:ring-[#6d6be8]"
              style={{ left: `calc(${round2(left)}% + ${offset}px)` }}
              onPointerDown={(event) => startResize(event, row.id, position)}
              onKeyDown={(event) => resizeByKey(event, row.id, position)}
            />
          );
        })}
      </>
    );
  }

  /** Floating toolbar + selection ring, rendered inside every node. */
  function renderChrome(node: Block): React.ReactNode {
    const kind: NodeKind =
      node.type === 'row' ? 'row' : node.type === 'column' ? 'column' : 'module';
    const accent = KIND_ACCENT[kind];
    const def = BLOCK_DEFS[node.type];
    const label = def ? L(def.label) : node.type;
    const isSelected = selectedId === node.id;
    const selection = isSelected ? { opacity: 1 } : undefined;
    const parent = findParent(blocks, node.id);
    const siblings = parent ? parent.children || [] : blocks;
    const index = siblings.findIndex((entry) => entry.id === node.id);
    const moveLabels =
      kind === 'column'
        ? [L('Move left'), L('Move right')]
        : [L('Move up'), L('Move down')];

    return (
      <>
        {/* Only the innermost hovered node lights up, so a row's and a column's
            toolbars never pile up over the module the pointer is on. */}
        <style>{`.bb-${node.id}:hover:not(:has([data-node]:hover))>.bb-chrome{opacity:1}.bb-${node.id}:hover:not(:has([data-node]:hover))>.bb-toolbar{pointer-events:auto}`}</style>
        {/* Keyboard entry point: focus selects the node. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(node.id);
          }}
          className="sr-only focus:not-sr-only focus:absolute focus:left-1 focus:top-1 focus:z-40 focus:rounded focus:bg-[#6d6be8] focus:px-2 focus:py-1 focus:text-[11px] focus:font-semibold focus:text-white"
        >
          {t('cmscontent.builder.selectNode', { label })}
        </button>
        <DragSurface
          id={`surface:${node.id}`}
          data={{ kind: 'move', id: node.id }}
          disabled={previewMode}
          className={cn(
            'bb-chrome absolute inset-0 cursor-grab touch-none opacity-0 ring-2 ring-inset transition-opacity active:cursor-grabbing',
            accent.ring,
            // Above a module's own positioned content (image, cards) so it gets the
            // click and the drag; rows/columns stay below their children.
            kind === 'module' && 'z-10',
          )}
          style={isSelected ? { opacity: 1, pointerEvents: 'none' } : undefined}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(node.id);
          }}
        />
        {kind === 'module' ? null : renderToolbar(node, false)}
      </>
    );
  }

  /**
   * The node's action bar (label, transform, drag grip, settings, move,
   * duplicate, delete). Rows and columns show it inside their corner on hover;
   * a selected module gets it floating above it on the canvas (see
   * `moduleToolbarBox`), where no carousel or column can clip it and it never
   * covers the text being edited.
   */
  function renderToolbar(node: Block, floating: boolean): React.ReactNode {
    const kind: NodeKind =
      node.type === 'row' ? 'row' : node.type === 'column' ? 'column' : 'module';
    const accent = KIND_ACCENT[kind];
    const def = BLOCK_DEFS[node.type];
    const label = def ? L(def.label) : node.type;
    const isSelected = selectedId === node.id;
    const parent = findParent(blocks, node.id);
    const siblings = parent ? parent.children || [] : blocks;
    const index = siblings.findIndex((entry) => entry.id === node.id);
    const moveLabels =
      kind === 'column'
        ? [L('Move left'), L('Move right')]
        : [L('Move up'), L('Move down')];

    return (
        <div
          className={cn(
            'z-30 flex items-center gap-0.5 whitespace-nowrap rounded-md bg-white/95 p-0.5 shadow-sm ring-1 ring-black/10',
            floating
              ? 'relative'
              : cn(
                  'bb-chrome bb-toolbar pointer-events-none absolute opacity-0 transition-opacity',
                  kind === 'row' ? 'right-1 top-1' : 'left-1 top-1',
                ),
          )}
          style={!floating && isSelected ? { opacity: 1, pointerEvents: 'auto' } : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <span
            className={cn(
              'mr-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white',
              accent.chip,
            )}
          >
            {label}
          </span>
          {kind === 'module' && getTransformTargets(node).length > 0 ? (
            <div className="relative">
              <button
                type="button"
                title={L('Transform to')}
                aria-label={L('Transform to')}
                aria-haspopup="menu"
                aria-expanded={transformMenuFor === node.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setTransformMenuFor(transformMenuFor === node.id ? null : node.id);
                }}
                className="flex items-center gap-0.5 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                {def ? <def.icon size={12} /> : null}
                <ChevronDown size={10} />
              </button>
              {transformMenuFor === node.id ? (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-50 mt-1 max-h-72 w-44 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 text-left shadow-lg"
                >
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {L('Transform to')}
                  </p>
                  {getTransformTargets(node).map((target) => {
                    const TargetIcon = BLOCK_DEFS[target.type].icon;
                    return (
                      <button
                        key={`${target.type}-${target.level || ''}`}
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          transformNode(node.id, target);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                      >
                        <TargetIcon size={13} className="shrink-0 text-zinc-400" />
                        {L(target.label)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <DragSource
            id={`move:${node.id}`}
            data={{ kind: 'move', id: node.id }}
            disabled={previewMode}
            title={L('Drag to move')}
            ariaLabel={t('cmscontent.builder.dragNode', { label })}
            className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </DragSource>
          <button
            type="button"
            title={L('Settings')}
            aria-label={t('cmscontent.builder.nodeSettings', { label })}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(node.id);
              setSettingsTab('general');
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Wrench size={12} />
          </button>
          {[0, 1].map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={index + (slot === 0 ? -1 : 1) < 0 || index + (slot === 0 ? -1 : 1) >= siblings.length}
              title={moveLabels[slot]}
              aria-label={t('cmscontent.builder.moveLabel', {
                move: moveLabels[slot],
                label,
              })}
              onClick={(event) => {
                event.stopPropagation();
                moveNode(node.id, slot === 0 ? -1 : 1);
              }}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
            >
              {kind === 'column' ? (
                slot === 0 ? <ArrowLeft size={12} /> : <ArrowRight size={12} />
              ) : slot === 0 ? (
                <ArrowUp size={12} />
              ) : (
                <ArrowDown size={12} />
              )}
            </button>
          ))}
          <button
            type="button"
            title={L('Duplicate')}
            aria-label={t('cmscontent.builder.duplicateNode', { label })}
            onClick={(event) => {
              event.stopPropagation();
              duplicateNode(node.id);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            title={L('Delete')}
            aria-label={t('cmscontent.builder.deleteNode', { label })}
            onClick={(event) => {
              event.stopPropagation();
              removeNode(node.id);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={12} />
          </button>
        </div>
    );
  }

  const canvasWidth =
    breakpoint === 'desktop' ? '100%' : breakpoint === 'tablet' ? '834px' : '390px';

  return (
    <DndContext
      id="page-builder"
      sensors={dndSensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
    <div
      className={cn(
        'bb-shell flex flex-col overflow-hidden bg-white',
        fullscreen
          ? 'fixed inset-0 z-[60]'
          : 'h-[80vh] rounded-xl border border-zinc-200 shadow-sm',
      )}
    >
      {/* Honour the OS motion preference for the editing chrome. */}
      <style>{`@media (prefers-reduced-motion: reduce){.bb-shell,.bb-shell *{transition-duration:.01ms!important;animation-duration:.01ms!important;scroll-behavior:auto!important}}`}</style>
      {/* --------------------------------------------------------- top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-3 py-2 text-white">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400">
            {L('Editing')}
          </p>
          <p className="truncate text-sm font-semibold leading-tight">{pageLabel}</p>
        </div>

        <div className="flex items-center gap-0.5 border-l border-white/10 pl-2">
          <button
            type="button"
            aria-label={L('Undo')}
            title={L('Undo — Ctrl/Cmd+Z')}
            disabled={!histFlags.canUndo}
            onClick={undo}
            className="rounded p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            aria-label={L('Redo')}
            title={L('Redo — Ctrl/Cmd+Shift+Z')}
            disabled={!histFlags.canRedo}
            onClick={redo}
            className="rounded p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-md bg-white/10 p-0.5"
          role="group"
          aria-label={L('Canvas breakpoint')}
        >
          {([
            ['desktop', Monitor, 'desktop'],
            ['tablet', Tablet, 'tablet'],
            ['mobile', Smartphone, 'mobile'],
          ] as const).map(([value, Icon, name]) => (
            <button
              key={value}
              type="button"
              aria-label={t('cmscontent.builder.previewAs', { name: L(name) })}
              aria-pressed={breakpoint === value}
              onClick={() => setBreakpoint(value)}
              className={cn(
                'rounded p-1.5 transition',
                breakpoint === value
                  ? 'bg-[#6d6be8] text-white'
                  : 'text-zinc-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPreviewMode((value) => !value)}
          aria-pressed={previewMode}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
            previewMode
              ? 'bg-[#6d6be8] text-white'
              : 'text-zinc-300 hover:bg-white/10 hover:text-white',
          )}
        >
          {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">
            {previewMode ? L('Back to editing') : L('Preview')}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {flash ? (
            <span
              role="status"
              className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-300"
            >
              {flash}
            </span>
          ) : null}
          <span className="hidden text-xs text-zinc-400 md:inline">
            {t('cmscontent.builder.blockCount', { count: countBlocks(blocks) })}
          </span>
          <button
            type="button"
            aria-label={fullscreen ? L('Exit full screen') : L('Edit full screen')}
            title={fullscreen ? L('Exit full screen') : L('Edit full screen')}
            onClick={() => setFullscreen((value) => !value)}
            className="rounded p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          {fullscreen ? (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              {L('Done')}
            </button>
          ) : null}
          {onSave ? (
            <button
              type="button"
              onClick={() => void saveNow()}
              className="rounded-md bg-[#6d6be8] px-3.5 py-1.5 text-xs font-semibold transition hover:bg-[#5b59d6]"
            >
              {L('Publish')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ------------------------------------------------------- canvas */}
        <div
          ref={canvasRef}
          className={cn(
            'relative min-w-0 flex-1 overflow-y-auto',
            previewMode ? 'bg-white' : 'bg-zinc-100/60',
          )}
          style={{
            ...(previewTheme as React.CSSProperties | undefined),
            fontFamily: previewTheme?.['--cms-body-font'] || undefined,
          }}
          /* Editing and preview only: a click inside the canvas must never
             navigate away (storefront links, next/link included). Capture
             runs before any link handler, so `defaultPrevented` is already
             set when next/link checks it; the block under the link gets
             selected instead. */
          onClickCapture={(event) => {
            const target = event.target as Element | null;
            const anchor = target?.closest?.('a');
            if (!anchor) return;
            event.preventDefault();
            const node = target?.closest('[data-node]') as HTMLElement | null;
            const id = node?.dataset.node;
            if (id && id !== 'page') setSelectedId(id);
          }}
          onAuxClickCapture={(event) => {
            const target = event.target as Element | null;
            if (target?.closest?.('a')) event.preventDefault();
          }}
          onClick={(event) => {
            // Link clicks keep the selection the capture handler made.
            if ((event.target as Element | null)?.closest?.('a')) return;
            setTransformMenuFor(null);
            const host = (event.target as Element | null)?.closest?.('[data-node]') as HTMLElement | null;
            if (host && host.dataset.node && host.dataset.node === selectedId) return;
            setSelectedId(null);
          }}
        >
          <div
            data-node="page"
            className={cn(
              'mx-auto min-h-full transition-[width] duration-200',
              `bp-${breakpoint}`,
            )}
            style={{ width: canvasWidth, maxWidth: '100%' }}
          >
            {blocks.length === 0 ? (
              <div
                className="m-5 flex min-h-[320px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white/60 text-center"
                onClick={(event) => event.stopPropagation()}
              >
                <Layers size={32} className="mb-3 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-600">{L('This page is empty')}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {L('Drag a Row or a Module here, or start below.')}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addRow([100])}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
                  >
                    {L('+ Add a row')}
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock('heading')}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                  >
                    {L('+ Add a heading')}
                  </button>
                </div>
              </div>
            ) : (
              blocks.map((row) => (
                <BlockRenderer
                  key={row.id}
                  block={row}
                  mode="edit"
                  breakpoint={breakpoint}
                  products={canvasProducts}
                  categories={categories}
                  editChrome={previewMode ? undefined : renderChrome}
                  editGutter={previewMode ? undefined : renderGutter}
                  onInlineEdit={previewMode ? undefined : (id, key, value) => patchProps(id, key, value)}
                  selectedId={previewMode ? null : selectedId}
                />
              ))
            )}
          </div>

          {selectedIsModule && moduleToolbarBox && selected && !drag ? (
            <div
              className="absolute z-40"
              style={{ top: moduleToolbarBox.top, left: moduleToolbarBox.left }}
            >
              {renderToolbar(selected, true)}
            </div>
          ) : null}

          {drag && drag.hint && drag.box ? (
            <div className="pointer-events-none fixed inset-0 z-[65]">
              <div
                className="absolute rounded-md ring-2 ring-[#6d6be8]"
                style={{
                  top: drag.box.top,
                  left: drag.box.left,
                  width: drag.box.width,
                  height: drag.box.height,
                }}
              />
              {drag.point ? (
                drag.hint.orientation === 'vertical' ? (
                  <div
                    className="absolute h-[3px] rounded-full bg-[#6d6be8] shadow"
                    style={{
                      top: drag.point.y - 1.5,
                      left: drag.box.left,
                      width: drag.box.width,
                    }}
                  />
                ) : (
                  <div
                    className="absolute w-[3px] rounded-full bg-[#6d6be8] shadow"
                    style={{
                      left: drag.point.x - 1.5,
                      top: drag.box.top,
                      height: drag.box.height,
                    }}
                  />
                )
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------- right panel */}
        {!previewMode ? (
          <aside className="flex w-[300px] shrink-0 flex-col border-l border-zinc-200 bg-white">
            {selected ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2.5 py-2">
                  <button
                    type="button"
                    aria-label={L('Back to the panel')}
                    onClick={() => setSelectedId(null)}
                    className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  {selectedDef ? (
                    <selectedDef.icon size={15} className={selectedDef.accent} />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
                    {selectedDef ? L(selectedDef.label) : selected.type}
                  </span>
                  <button
                    type="button"
                    aria-label={L('Delete block')}
                    onClick={() => removeNode(selected.id)}
                    className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div
                  className="flex shrink-0 border-b border-zinc-200 px-1"
                  role="tablist"
                  aria-label={L('Settings sections')}
                >
                  {settingsTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={settingsTab === tab}
                      onClick={() => setSettingsTab(tab)}
                      className={cn(
                        'flex-1 border-b-2 px-2 py-2 text-xs font-semibold capitalize transition',
                        settingsTab === tab
                          ? 'border-[#6d6be8] text-[#4f4dd6]'
                          : 'border-transparent text-zinc-500 hover:text-zinc-800',
                      )}
                    >
                      {L(tab)}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                  {selected.type === 'row' && settingsTab === 'general' ? (
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                        {L('Columns')} ({(selected.children || []).length})
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {ROW_PRESETS.map((preset) => {
                          const current =
                            (selected.children || []).length === preset.widths.length &&
                            (selected.children || []).every(
                              (column, index) =>
                                Math.abs(Number(column.props.width) - preset.widths[index]) < 1,
                            );
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              title={L(preset.label)}
                              aria-label={L(preset.label)}
                              aria-pressed={current}
                              onClick={() => setRowLayout(selected.id, preset.widths)}
                              className={cn(
                                'rounded border bg-white p-1 transition',
                                current
                                  ? 'border-[#6d6be8] ring-1 ring-[#6d6be8]'
                                  : 'border-zinc-200 hover:border-[#6d6be8]',
                              )}
                            >
                              <span className="flex h-6 gap-0.5">
                                {preset.widths.map((width, position) => (
                                  <span
                                    key={position}
                                    className="rounded-sm bg-zinc-300"
                                    style={{ width: `${width}%` }}
                                  />
                                ))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400">
                        {L('Fewer columns keep their content: it moves into the last column.')}
                      </p>
                      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                        <p className="mb-1.5 text-xs font-semibold text-zinc-700">{L('Carousel')}</p>
                        {selected.props.layout === 'carousel' ? (
                          <>
                            <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                              {L('Each column is one slide. Edit a slide on the canvas, page with the arrows.')}{' '}
                              ({(selected.children || []).length} {L('slides')})
                            </p>
                            <button
                              type="button"
                              onClick={() => addSlide(selected.id)}
                              className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700"
                            >
                              {L('+ Add slide (copy of the last one)')}
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                              {L('Turn this row into a slider: its current layout becomes slide 1.')}
                            </p>
                            <button
                              type="button"
                              onClick={() => makeCarousel(selected.id)}
                              className="w-full rounded-md bg-[#6d6be8] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#5b59d6]"
                            >
                              {L('Make carousel')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {settingsFields.length ? (
                    settingsFields.map((field) => (
                      <FieldControl
                        key={field.key}
                        field={field}
                        value={getByPath(selected.props, field.key)}
                        onChange={(value) => {
                          const autoManual =
                            field.kind === 'products' &&
                            Array.isArray(value) &&
                            value.length > 0 &&
                            typeof selected.props.source === 'string' &&
                            selected.props.source !== 'manual';
                          if (autoManual) {
                            patchProductPick(selected.id, field.key, value);
                          } else {
                            patchProps(selected.id, field.key, value);
                          }
                        }}
                        onPickMedia={(multi, subPath) =>
                          setMediaTarget({
                            path: subPath ? `${field.key}.${subPath}` : field.key,
                            multi,
                          })
                        }
                        categories={categories}
                        products={products}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-zinc-400">
                      {t('cmscontent.builder.noSettings', {
                        tab: L(settingsTab).toLowerCase(),
                        block: (
                          selectedDef ? L(selectedDef.label) : L('block')
                        ).toLowerCase(),
                      })}
                    </p>
                  )}

                  {selectedDef?.hasChildren ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-zinc-700">
                        {t('cmscontent.builder.addChildTo', {
                          block: L(selectedDef.label).toLowerCase(),
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedDef.childTypes || []).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => addBlock(type, selected.id)}
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                          >
                            {t('cmscontent.builder.addChild', {
                              label: L(BLOCK_DEFS[type].label),
                            })}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-3 py-2">
                  <span className="text-[11px] text-zinc-400">
                    id: {selected.id.slice(0, 10)}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-zinc-500 hover:text-[#4f4dd6]"
                    onClick={() => {
                      const def = BLOCK_DEFS[selected.type];
                      commit(
                        mapTree(blocks, selected.id, (block) => ({
                          ...block,
                          props: def.defaultProps(),
                        })),
                      );
                    }}
                  >
                    {L('Reset settings')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  className="flex shrink-0 border-b border-zinc-200"
                  role="tablist"
                  aria-label={L('Builder panel')}
                >
                  {PANEL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={panelTab === tab.id}
                      onClick={() => setPanelTab(tab.id)}
                      className={cn(
                        'flex-1 border-b-2 px-1 py-2.5 text-[11px] font-semibold transition',
                        panelTab === tab.id
                          ? 'border-[#6d6be8] text-[#4f4dd6]'
                          : 'border-transparent text-zinc-500 hover:text-zinc-800',
                      )}
                    >
                      {L(tab.label)}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1">
                  {/* Panels stay mounted (hidden), so switching tabs is instant. */}
                  {PANEL_TABS.map((tab) => (
                    <div
                      key={tab.id}
                      hidden={panelTab !== tab.id}
                      className="h-full overflow-y-auto p-3"
                    >
                      {tab.id === 'modules' ? (
                    <div>
                      <select
                        value={moduleGroup}
                        onChange={(event) => setModuleGroup(event.target.value)}
                        aria-label={L('Module group')}
                        className={cn(inputClass, 'mb-2 py-1.5 text-xs')}
                      >
                        <option value="all">{L('All groups')}</option>
                        {BLOCK_GROUPS.map((group) => (
                          <option key={group.id} value={group.id}>
                            {L(group.label)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={pickerFilter}
                        onChange={(event) => setPickerFilter(event.target.value)}
                        placeholder={L('Search modules…')}
                        aria-label={t('cmscontent.builder.searchModules')}
                        className={cn(inputClass, 'py-1.5 text-xs')}
                      />
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        {groupDefs.map((def) => {
                          const Icon = def.icon;
                          return (
                            <DragSource
                              key={def.type}
                              id={`new:${def.type}`}
                              data={{ kind: 'new-module', blockType: def.type }}
                              disabled={previewMode}
                              title={def.description ? L(def.description) : undefined}
                              onClick={() => {
                                if (justDroppedRef.current) return;
                                addBlock(
                                  def.type,
                                  selectedDef?.hasChildren ? selectedId : null,
                                );
                              }}
                              className="flex cursor-grab touch-none flex-col items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-2.5 text-center transition hover:border-[#6d6be8]/60 hover:bg-[#6d6be8]/5 hover:shadow-sm active:cursor-grabbing"
                            >
                              <Icon size={18} className={cn('shrink-0', def.accent)} />
                              <span className="w-full truncate text-[11px] font-medium text-zinc-700">
                                {L(def.label)}
                              </span>
                            </DragSource>
                          );
                        })}
                      </div>
                      {!groupDefs.length ? (
                        <p className="py-6 text-center text-xs text-zinc-400">
                          {L('No modules match that filter.')}
                        </p>
                      ) : null}
                      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
                        {L(
                          'Click to append to the page, or drag onto the canvas to place it exactly.',
                        )}
                      </p>
                    </div>
                  ) : null}

                  {tab.id === 'rows' ? (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        {ROW_PRESETS.map((preset) => (
                          <DragSource
                            key={preset.id}
                            id={`row:${preset.id}`}
                            data={{ kind: 'new-row', widths: preset.widths }}
                            disabled={previewMode}
                            onClick={() => {
                              if (justDroppedRef.current) return;
                              addRow(preset.widths);
                            }}
                            className="group cursor-grab touch-none rounded-lg border border-zinc-200 bg-white p-2 text-left transition hover:border-[#6d6be8] hover:shadow-sm active:cursor-grabbing"
                          >
                            <span className="mb-1.5 flex h-8 gap-0.5 rounded border border-zinc-200 bg-zinc-50 p-0.5">
                              {preset.widths.map((width, position) => (
                                <span
                                  key={position}
                                  className="rounded-sm bg-zinc-300 transition group-hover:bg-[#6d6be8]/40"
                                  style={{ width: `${width}%` }}
                                />
                              ))}
                            </span>
                            <span className="block truncate text-[11px] font-medium text-zinc-600">
                              {L(preset.label)}
                            </span>
                          </DragSource>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
                        {L(
                          'Click to append a row, or drag it onto the canvas. Resize columns by dragging the seam between them (Arrow keys work too).',
                        )}
                      </p>
                    </div>
                  ) : null}

                  {tab.id === 'templates' ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                      <Layers size={24} className="mb-2.5 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-700">
                        {L('Page templates')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {L(
                          'Full-page layouts you can apply in one click land here with the templates phase.',
                        )}
                      </p>
                    </div>
                  ) : null}

                  {tab.id === 'saved' ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                      <Copy size={24} className="mb-2.5 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-700">{L('Saved blocks')}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {L('Reusable blocks you save will show up here.')}
                      </p>
                    </div>
                  ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <MediaPickerModal
        open={Boolean(mediaTarget)}
        mode={mediaTarget?.multi ? 'multi' : 'single'}
        onClose={() => setMediaTarget(null)}
        onSelect={(items) => {
          if (!mediaTarget || !selectedId) return;
          const value = mediaTarget.multi
            ? items.map((item) => ({ url: item.url, alt: item.alt || '' }))
            : items[0]?.url || '';
          patchProps(selectedId, mediaTarget.path, value);
        }}
      />

      {flash ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl"
        >
          {flash}
        </div>
      ) : null}
    </div>
    <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
      {drag ? (
        <div className="pointer-events-none rounded-md bg-zinc-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
          {dragLabel(drag.payload)}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}
