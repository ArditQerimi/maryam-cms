'use client';

import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
} from '@/components/admin/ui';
import { saveShippingClasses } from '@/app/cms/actions/shipping';
import { slugify } from '@/lib/cms/format';
import type { ShippingClass } from '@/app/cms/shipping/settings-key';

type ShippingClassesEditorProps = {
  initial: ShippingClass[];
};

function newRow(index: number): ShippingClass {
  return { id: `new-${index}-${Date.now()}`, name: '', description: '', slug: '' };
}

/** CRUD editor for the `shipping_classes` JSON list in `settings_store`. */
export default function ShippingClassesEditor({ initial }: ShippingClassesEditorProps) {
  const [classes, setClasses] = useState<ShippingClass[]>(initial);
  const [pending, setPending] = useState(false);

  const update = (index: number, patch: Partial<ShippingClass>) => {
    setClasses((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addClass = () => {
    setClasses((current) => [...current, newRow(current.length + 1)]);
  };

  const removeClass = (index: number) => {
    const target = classes[index];
    if (target?.name && !window.confirm(`Delete the shipping class “${target.name}”?`)) return;
    setClasses((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    const cleaned = classes
      .map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        description: entry.description.trim(),
        slug: entry.slug.trim() || slugify(entry.name),
      }))
      .filter((entry) => entry.name);

    if (cleaned.length !== classes.filter((entry) => entry.name.trim() || entry.description.trim() || entry.slug.trim()).length) {
      toast.error('Every shipping class needs a name.');
      return;
    }
    if (cleaned.length === 0) {
      toast.error('Add at least one shipping class, or remove them all and save.');
      return;
    }

    const slugs = cleaned.map((entry) => entry.slug || slugify(entry.name));
    if (new Set(slugs).size !== slugs.length) {
      toast.error('Each shipping class needs a unique slug.');
      return;
    }

    setPending(true);
    try {
      const result = await saveShippingClasses(
        cleaned.map((entry) => ({ ...entry, slug: entry.slug || slugify(entry.name) })),
      );
      if (!result.ok) {
        toast.error(result.error || 'Could not save the shipping classes.');
        return;
      }
      toast.success('Shipping classes saved.');
      setClasses(
        cleaned.map((entry) => ({ ...entry, slug: entry.slug || slugify(entry.name) })),
      );
    } catch {
      toast.error('Could not save the shipping classes.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {classes.length} class{classes.length === 1 ? '' : 'es'}
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={addClass} variant="outline">
            <Plus size={15} />
            Add class
          </Button>
          <Button disabled={pending} onClick={() => void save()}>
            <Save size={15} />
            {pending ? 'Saving…' : 'Save classes'}
          </Button>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={addClass}>
              <Plus size={15} />
              Add class
            </Button>
          }
          description="Add classes such as “Bulky”, “Fragile”, or “Perishable” to group products that share a shipping rate."
          icon={<Plus size={28} />}
          title="No shipping classes yet"
        />
      ) : (
        <div className="space-y-3">
          {classes.map((entry, index) => (
            <Card key={entry.id}>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field htmlFor={`class-name-${entry.id}`} label="Name">
                  <Input
                    id={`class-name-${entry.id}`}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder="e.g. Bulky items"
                    value={entry.name}
                  />
                </Field>
                <Field
                  htmlFor={`class-slug-${entry.id}`}
                  label="Slug"
                  hint="Used in rate rules. Generated from the name when left blank."
                >
                  <Input
                    id={`class-slug-${entry.id}`}
                    onChange={(event) => update(index, { slug: event.target.value })}
                    placeholder="bulky-items"
                    value={entry.slug}
                  />
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field htmlFor={`class-desc-${entry.id}`} label="Description">
                    <Input
                      id={`class-desc-${entry.id}`}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder="Large items that need a courier van"
                      value={entry.description}
                    />
                  </Field>
                  <Button
                    aria-label={`Delete ${entry.name || 'shipping class'}`}
                    onClick={() => removeClass(index)}
                    variant="ghost"
                  >
                    <Trash2 className="text-red-500" size={15} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
