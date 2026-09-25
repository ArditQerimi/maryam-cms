'use client';

import { useState } from 'react';
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
  Clock,
  FileText,
  GripVertical,
  LayoutTemplate,
  Mail,
  Package,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader, CardTitle, cn, inputClass } from '@/components/admin/ui';
import { saveWidgets } from '@/app/cms/actions/theme';
import {
  WIDGET_AREAS,
  WIDGET_TYPES,
  type WidgetAreaKey,
  type WidgetInstance,
  type WidgetLayout,
  type WidgetType,
} from '@/lib/theme/types';

const AREA_LABELS: Record<WidgetAreaKey, string> = {
  sidebar: 'Sidebar',
  homepage: 'Homepage',
  footer: 'Footer',
};

type CatalogueEntry = {
  type: WidgetType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  withLimit?: boolean;
};

const CATALOGUE: CatalogueEntry[] = [
  { type: 'recent-posts', label: 'Recent posts', description: 'Latest published blog posts', icon: Clock, withLimit: true },
  { type: 'recent-products', label: 'Recent products', description: 'Newest products in the catalogue', icon: Package, withLimit: true },
  { type: 'categories', label: 'Categories', description: 'Product category links', icon: LayoutTemplate, withLimit: true },
  { type: 'text', label: 'Text/HTML', description: 'Free-form text or embedded HTML', icon: FileText },
  { type: 'newsletter', label: 'Newsletter signup', description: 'Email capture form', icon: Mail },
  { type: 'social', label: 'Social links', description: 'Links to your social profiles', icon: Share2 },
];

const CATALOGUE_BY_TYPE = new Map(CATALOGUE.map((entry) => [entry.type, entry]));

function makeId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInstance(type: WidgetType): WidgetInstance {
  const entry = CATALOGUE_BY_TYPE.get(type);
  return {
    id: makeId(),
    type,
    settings: {
      title: entry?.label ?? 'Widget',
      limit: entry?.withLimit ? 5 : 0,
      html: '',
      links: type === 'social' ? [{ label: 'Instagram', url: 'https://instagram.com' }] : [],
    },
  };
}

/* ------------------------------------------------------------------ row */

function SortableWidget({
  widget,
  onPatch,
  onDelete,
}: {
  widget: WidgetInstance;
  onPatch: (patch: Partial<WidgetInstance['settings']>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const entry = CATALOGUE_BY_TYPE.get(widget.type);
  const Icon = entry?.icon ?? LayoutTemplate;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-lg border border-zinc-200 bg-white', isDragging && 'z-30 opacity-70 shadow-md')}
    >
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-zinc-400 transition hover:text-zinc-600 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <Icon size={13} className="shrink-0 text-[#5b59d6]" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-700">
          {widget.settings.title || entry?.label || widget.type}
        </span>
        <button
          type="button"
          aria-label="Remove widget"
          onClick={onDelete}
          className="rounded p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="space-y-2 p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Title</span>
          <input
            className={cn(inputClass, 'px-2 py-1.5 text-xs')}
            value={widget.settings.title ?? ''}
            onChange={(event) => onPatch({ title: event.target.value })}
          />
        </label>

        {entry?.withLimit ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">Limit</span>
            <input
              type="number"
              min={1}
              max={50}
              className={cn(inputClass, 'px-2 py-1.5 text-xs')}
              value={widget.settings.limit ?? 5}
              onChange={(event) => onPatch({ limit: Number(event.target.value) })}
            />
          </label>
        ) : null}

        {widget.type === 'text' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">HTML content</span>
            <textarea
              rows={4}
              className={cn(inputClass, 'min-h-20 resize-y px-2 py-1.5 font-mono text-xs')}
              placeholder="<p>Some <strong>HTML</strong>…</p>"
              value={widget.settings.html ?? ''}
              onChange={(event) => onPatch({ html: event.target.value })}
            />
          </label>
        ) : null}

        {widget.type === 'social' ? (
          <div>
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">Links</span>
            <div className="space-y-1.5">
              {(widget.settings.links ?? []).map((link, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    className={cn(inputClass, 'w-1/3 px-2 py-1.5 text-xs')}
                    value={link.label}
                    placeholder="Label"
                    onChange={(event) => {
                      const links = (widget.settings.links ?? []).map((entry2, i) =>
                        i === index ? { ...entry2, label: event.target.value } : entry2,
                      );
                      onPatch({ links });
                    }}
                  />
                  <input
                    className={cn(inputClass, 'flex-1 px-2 py-1.5 text-xs')}
                    value={link.url}
                    placeholder="https://…"
                    onChange={(event) => {
                      const links = (widget.settings.links ?? []).map((entry2, i) =>
                        i === index ? { ...entry2, url: event.target.value } : entry2,
                      );
                      onPatch({ links });
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() =>
                      onPatch({
                        links: (widget.settings.links ?? []).filter((_, i) => i !== index),
                      })
                    }
                    className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onPatch({ links: [...(widget.settings.links ?? []), { label: '', url: '' }] })
                }
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-1.5 text-[11px] text-zinc-500 transition hover:border-[#6d6be8] hover:text-[#4f4dd6]"
              >
                <Plus size={11} /> Add link
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- area */

function WidgetAreaCard({
  area,
  widgets,
  onChange,
}: {
  area: WidgetAreaKey;
  widgets: WidgetInstance[];
  onChange: (next: WidgetInstance[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex((widget) => widget.id === active.id);
    const newIndex = widgets.findIndex((widget) => widget.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(widgets, oldIndex, newIndex));
  }

  return (
    <Card className="flex h-fit flex-col">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{AREA_LABELS[area]}</CardTitle>
        <span className="text-[11px] text-zinc-400">{widgets.length} widget(s)</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {widgets.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-200 px-3 py-8 text-center">
            <p className="text-xs text-zinc-400">No widgets in this area yet.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={widgets.map((widget) => widget.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onPatch={(patch) =>
                      onChange(
                        widgets.map((entry) =>
                          entry.id === widget.id
                            ? { ...entry, settings: { ...entry.settings, ...patch } }
                            : entry,
                        ),
                      )
                    }
                    onDelete={() => onChange(widgets.filter((entry) => entry.id !== widget.id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div>
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Add widget</span>
          <select
            aria-label={`Add widget to ${AREA_LABELS[area]}`}
            className={cn(inputClass, 'appearance-none px-2.5 py-1.5 text-xs')}
            value=""
            onChange={(event) => {
              const type = event.target.value as WidgetType;
              if (!type) return;
              onChange([...widgets, createInstance(type)]);
            }}
          >
            <option value="">— Choose a widget —</option>
            {CATALOGUE.map((entry) => (
              <option key={entry.type} value={entry.type}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- manager */

export default function WidgetsManager({ initialLayout }: { initialLayout: WidgetLayout }) {
  const [layout, setLayout] = useState<WidgetLayout>(initialLayout);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(layout) !== JSON.stringify(initialLayout);

  function setArea(area: WidgetAreaKey, next: WidgetInstance[]) {
    setLayout((previous) => ({ ...previous, [area]: next }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveWidgets(layout);
      if (result.ok) toast.success('Widget layout saved.');
      else toast.error(result.error || 'Could not save the widget layout.');
    } catch (error) {
      console.error('[cms/appearance] save widgets failed', error);
      toast.error('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {WIDGET_AREAS.map((area) => (
          <WidgetAreaCard
            key={area}
            area={area}
            widgets={layout[area] ?? []}
            onChange={(next) => setArea(area, next)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>
            {CATALOGUE.length} widget types available across {WIDGET_AREAS.length} areas.
          </span>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Unsaved
            </span>
          ) : null}
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save widgets'}
        </Button>
      </div>
    </div>
  );
}
