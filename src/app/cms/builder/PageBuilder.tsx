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
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  ImagePlus,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BLOCK_DEFS,
  BLOCK_GROUPS,
  BLOCK_LIST,
  cloneBlock,
  createBlock,
  normalizeBlocks,
  type Block,
  type BlockType,
  type FieldDef,
} from './blocks';
import BlockRenderer from './BlockRenderer';
import MediaPickerModal, { type PickedMedia } from '@/components/admin/MediaPickerModal';
import { Button, cn, inputClass } from '@/components/admin/ui';

type MediaTarget = { path: string; multi: boolean } | null;

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

/* ---------------------------------------------------------------- sortable */

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
              aria-label="Drag to reorder"
              onClick={(event) => event.stopPropagation()}
              className="cursor-grab touch-none text-zinc-400 transition hover:text-zinc-600 active:cursor-grabbing"
            >
              <GripVertical size={15} />
            </button>
            <Icon size={14} className={cn('shrink-0', def?.accent || 'text-zinc-400')} />
            <span className="truncate text-xs font-semibold text-zinc-700">{def?.label || block.type}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDuplicate ? (
              <button
                type="button"
                aria-label="Duplicate block"
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
              aria-label="Delete block"
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
  const label = <span className="mb-1.5 block text-xs font-medium text-zinc-600">{field.label}</span>;
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
            Basic HTML allowed: &lt;p&gt; &lt;strong&gt; &lt;em&gt; &lt;a&gt; &lt;br&gt;
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
                {option.label}
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
                reset
              </button>
            ) : null}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <span className="text-xs font-medium text-zinc-600">{field.label}</span>
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
              {value ? 'Change image' : 'Choose from media library'}
            </span>
          </button>
          {value ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-zinc-400 hover:text-red-500"
              onClick={() => onChange('')}
            >
              Remove
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
                  aria-label="Remove image"
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
                {align}
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
                {size}
              </button>
            ))}
          </div>
        </div>
      );

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

    case 'productSource':
      return (
        <div className="space-y-3">
          <div>
            {label}
            <select
              className={cn(inputClass, 'appearance-none')}
              value={String(value ?? 'latest')}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="latest">Latest products</option>
              <option value="featured">Featured (newest with stock)</option>
              <option value="category">By category</option>
              <option value="manual">Manual selection</option>
            </select>
          </div>
          {value === 'category' ? (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">Category</span>
              <select className={cn(inputClass, 'appearance-none')} defaultValue="">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {value === 'manual' ? (
            <p className="text-[11px] text-zinc-400">
              Use “Pick products” below to choose the exact products.
            </p>
          ) : null}
        </div>
      );

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
            placeholder="Search products…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-1.5">
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-zinc-400">No products found.</p>
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
          <p className="mt-1 text-[11px] text-zinc-400">{ids.length} selected</p>
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
            aria-label={`Reorder ${label}`}
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
          aria-label="Remove"
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
        <span className="text-xs font-medium text-zinc-600">{field.label}</span>
        <span className="text-[11px] text-zinc-400">{items.length}</span>
      </div>
      <div className="space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableItemCard
                  key={index}
                  id={ids[index]}
                  label={`${field.itemLabel} ${index + 1}`}
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
          <Plus size={13} /> {field.addLabel}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- builder */

export default function PageBuilder({
  initialBlocks,
  onChange,
}: {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(initialBlocks));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>(null);
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [pickerFilter, setPickerFilter] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    onChange(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

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

  function commit(next: Block[]) {
    setBlocks(next);
  }

  function addBlock(type: BlockType, parentId?: string | null) {
    const block = createBlock(type);
    if (parentId) {
      const parent = findBlock(blocks, parentId);
      if (parent && parent.children) {
        commit(insertChild(blocks, parentId, block));
        setSelectedId(block.id);
        return;
      }
    }
    commit([...blocks, block]);
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commit(arrayMove(blocks, oldIndex, newIndex));
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
    def.label.toLowerCase().includes(pickerFilter.trim().toLowerCase()),
  );

  return (
    <div className="flex min-h-[70vh] overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Left: block picker */}
      <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50/70 p-3">
        <input
          value={pickerFilter}
          onChange={(event) => setPickerFilter(event.target.value)}
          placeholder="Search blocks…"
          className={cn(inputClass, 'mb-3 py-1.5 text-xs')}
        />
        {BLOCK_GROUPS.map((group) => {
          const defs = filteredDefs.filter((def) => def.group === group.id);
          if (!defs.length) return null;
          return (
            <div key={group.id} className="mb-4">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {defs.map((def) => {
                  const Icon = def.icon;
                  return (
                    <button
                      key={def.type}
                      type="button"
                      onClick={() => addBlock(def.type, selectedDef?.hasChildren ? selectedId : null)}
                      title={
                        selectedDef?.hasChildren
                          ? `Add inside ${selectedDef.label}`
                          : def.description
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-white px-2.5 py-2 text-left text-xs font-medium text-zinc-700 shadow-sm transition hover:border-[#6d6be8]/40 hover:text-[#4f4dd6]"
                    >
                      <Icon size={14} className={cn('shrink-0', def.accent)} />
                      <span className="truncate">{def.label}</span>
                      <Plus size={12} className="ml-auto shrink-0 text-zinc-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      {/* Centre: canvas */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-zinc-100/60 p-5" onClick={() => setSelectedId(null)}>
        {blocks.length === 0 ? (
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-center">
            <Layers size={34} className="mb-3 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-600">
              Click a block on the left to start building
            </p>
            <p className="mt-1 text-xs text-zinc-400">Then drag the ⠿ handle to reorder.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {blocks.map((block) => (
                  <div key={block.id} onClick={(event) => event.stopPropagation()}>
                    <SortableCard
                      block={block}
                      selected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => {
                        commit(removeTree(blocks, block.id));
                        if (selectedId === block.id) setSelectedId(null);
                      }}
                      onDuplicate={() => {
                        const copy = cloneBlock(block);
                        const index = blocks.findIndex((entry) => entry.id === block.id);
                        const next = [...blocks];
                        next.splice(index + 1, 0, copy);
                        commit(next);
                        setSelectedId(copy.id);
                      }}
                    >
                      <div className="pointer-events-auto">
                        <BlockRenderer block={block} mode="edit" />
                      </div>

                      {block.children?.length ? (
                        <div className="mt-4 space-y-3 border-t border-dashed border-zinc-200 pt-3">
                          {block.children.map((child, index) => (
                            <div key={child.id} className="relative">
                              <div
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedId(child.id);
                                }}
                                className={cn(
                                  'rounded-lg border bg-white transition',
                                  selectedId === child.id
                                    ? 'border-[#6d6be8] ring-2 ring-[#6d6be8]/25'
                                    : 'border-zinc-200 hover:border-zinc-300',
                                )}
                              >
                                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-2.5 py-1.5">
                                  <span className="truncate text-[11px] font-semibold text-zinc-600">
                                    {BLOCK_DEFS[child.type]?.label || child.type}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Move up"
                                      disabled={index === 0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        reorderChild(block.id, index, -1);
                                      }}
                                      className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 disabled:opacity-30"
                                    >
                                      <ArrowUp size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Move down"
                                      disabled={index === (block.children || []).length - 1}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        reorderChild(block.id, index, 1);
                                      }}
                                      className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 disabled:opacity-30"
                                    >
                                      <ArrowDown size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        commit(removeTree(blocks, child.id));
                                      }}
                                      className="rounded p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                                <div className="pointer-events-none p-3">
                                  <BlockRenderer block={child} mode="edit" />
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(block.id);
                            }}
                            className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                          >
                            Select this block to add more content
                          </button>
                        </div>
                      ) : null}
                    </SortableCard>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Right: settings */}
      <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Layers size={26} className="mb-3 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-700">No block selected</p>
            <p className="mt-1 text-xs text-zinc-500">
              Click any block on the canvas to edit its settings.
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedDef ? (
                  <selectedDef.icon size={15} className={selectedDef.accent} />
                ) : null}
                <span className="text-sm font-semibold text-zinc-900">
                  {selectedDef?.label || selected.type}
                </span>
              </div>
              <button
                type="button"
                aria-label="Delete block"
                onClick={() => {
                  commit(removeTree(blocks, selected.id));
                  setSelectedId(null);
                }}
                className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="space-y-4">
              {selectedDef?.fields.map((field) => {
                if (field.key === 'manualIds' && selected.props.source !== 'manual') return null;
                return (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={getByPath(selected.props, field.key)}
                    onChange={(value) => patchProps(selected.id, field.key, value)}
                    onPickMedia={(multi, subPath) =>
                      setMediaTarget({
                        path: subPath ? `${field.key}.${subPath}` : field.key,
                        multi,
                      })
                    }
                    categories={categories}
                    products={products}
                  />
                );
              })}
            </div>

            {selectedDef?.hasChildren ? (
              <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="mb-2 text-xs font-semibold text-zinc-700">
                  Add to this {selectedDef.label.replace(/\d+\s*/, '').toLowerCase()}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedDef.childTypes || []).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addBlock(type, selected.id)}
                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
                    >
                      + {BLOCK_DEFS[type].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
              <span className="text-[11px] text-zinc-400">id: {selected.id.slice(0, 10)}</span>
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
                Reset settings
              </button>
            </div>
          </div>
        )}
      </aside>

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
    </div>
  );
}
