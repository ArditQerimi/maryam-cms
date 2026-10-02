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
import { useLocale } from '@/lib/i18n/LocaleProvider';
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
  const { t } = useLocale();

  const update = (index: number, patch: Partial<ShippingClass>) => {
    setClasses((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addClass = () => {
    setClasses((current) => [...current, newRow(current.length + 1)]);
  };

  const removeClass = (index: number) => {
    const target = classes[index];
    if (
      target?.name &&
      !window.confirm(t('cmsshared.shipping.classes.delete_confirm', { name: target.name }))
    )
      return;
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
      toast.error(t('cmsshared.shipping.classes.name_required'));
      return;
    }
    if (cleaned.length === 0) {
      toast.error(t('cmsshared.shipping.classes.at_least_one'));
      return;
    }

    const slugs = cleaned.map((entry) => entry.slug || slugify(entry.name));
    if (new Set(slugs).size !== slugs.length) {
      toast.error(t('cmsshared.shipping.classes.unique_slug'));
      return;
    }

    setPending(true);
    try {
      const result = await saveShippingClasses(
        cleaned.map((entry) => ({ ...entry, slug: entry.slug || slugify(entry.name) })),
      );
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.shipping.classes.save_error'));
        return;
      }
      toast.success(t('cmsshared.shipping.classes.saved'));
      setClasses(
        cleaned.map((entry) => ({ ...entry, slug: entry.slug || slugify(entry.name) })),
      );
    } catch {
      toast.error(t('cmsshared.shipping.classes.save_error'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {classes.length === 1
            ? t('cmsshared.shipping.classes.count_one', { count: classes.length })
            : t('cmsshared.shipping.classes.count_many', { count: classes.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={addClass} variant="outline">
            <Plus size={15} />
            {t('cmsshared.shipping.classes.add_class')}
          </Button>
          <Button disabled={pending} onClick={() => void save()}>
            <Save size={15} />
            {pending
              ? t('cmsshared.menu_builder.saving')
              : t('cmsshared.shipping.classes.save_classes')}
          </Button>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={addClass}>
              <Plus size={15} />
              {t('cmsshared.shipping.classes.add_class')}
            </Button>
          }
          description={t('cmsshared.shipping.classes.empty_desc')}
          icon={<Plus size={28} />}
          title={t('cmsshared.shipping.classes.empty_title')}
        />
      ) : (
        <div className="space-y-3">
          {classes.map((entry, index) => (
            <Card key={entry.id}>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field htmlFor={`class-name-${entry.id}`} label={t('cmsshared.field.name')}>
                  <Input
                    id={`class-name-${entry.id}`}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder={t('cmsshared.shipping.classes.name_ph')}
                    value={entry.name}
                  />
                </Field>
                <Field
                  htmlFor={`class-slug-${entry.id}`}
                  label={t('cmsshared.shipping.classes.slug')}
                  hint={t('cmsshared.shipping.classes.slug_hint')}
                >
                  <Input
                    id={`class-slug-${entry.id}`}
                    onChange={(event) => update(index, { slug: event.target.value })}
                    placeholder="bulky-items"
                    value={entry.slug}
                  />
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field
                    htmlFor={`class-desc-${entry.id}`}
                    label={t('cmsshared.field.description')}
                  >
                    <Input
                      id={`class-desc-${entry.id}`}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder={t('cmsshared.shipping.classes.desc_ph')}
                      value={entry.description}
                    />
                  </Field>
                  <Button
                    aria-label={t('cmsshared.shipping.classes.delete_aria', {
                      name: entry.name || t('cmsshared.shipping.classes.class_word'),
                    })}
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
