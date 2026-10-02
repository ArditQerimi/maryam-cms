'use client';

import { useState } from 'react';
import { Globe, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, Field, Input } from '@/components/admin/ui';
import { createZone } from '@/app/cms/actions/shipping';
import LocationPicker from './LocationPicker';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { CountryOption, LocationChoice, StateOption } from './types';

type AddZoneFormProps = {
  countries: CountryOption[];
  states: StateOption[];
};

/** "Add Zone" button that expands into an inline create form. */
export default function AddZoneForm({ countries, states }: AddZoneFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [locations, setLocations] = useState<LocationChoice[]>([]);
  const [pending, setPending] = useState(false);
  const { t } = useLocale();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('cmsshared.shipping.zone_name_required'));
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set('name', name.trim());
      formData.set(
        'locations',
        JSON.stringify(locations.map((choice) => ({ type: choice.type, code: choice.code }))),
      );
      const result = await createZone(formData);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.shipping.create_error'));
        return;
      }
      toast.success(t('cmsshared.shipping.created', { name: name.trim() }));
      setName('');
      setLocations([]);
      setOpen(false);
    } catch {
      toast.error(t('cmsshared.shipping.create_error'));
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} />
        {t('cmsshared.shipping.add_zone_btn')}
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              {t('cmsshared.shipping.new_shipping_zone')}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {t('cmsshared.shipping.zone_help')}
            </p>
          </div>
          <Button
            aria-label={t('cmsshared.shipping.close_aria')}
            onClick={() => setOpen(false)}
            size="sm"
            variant="ghost"
          >
            <X size={15} />
          </Button>
        </div>

        <Field htmlFor="new-zone-name" label={t('cmsshared.shipping.zone_name')}>
          <Input
            id="new-zone-name"
            onChange={(event) => setName(event.target.value)}
            placeholder={t('cmsshared.shipping.zone_ph2')}
            value={name}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">
            {t('cmsshared.shipping.covered_locations')}
          </p>
          <LocationPicker
            countries={countries}
            onChange={setLocations}
            selected={locations}
            states={states}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            {t('cmsshared.action.cancel')}
          </Button>
          <Button disabled={pending} onClick={handleCreate}>
            <Globe size={15} />
            {pending ? t('cmsshared.shipping.creating') : t('cmsshared.shipping.create_zone')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
