'use client';

import { useState } from 'react';
import { Globe, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, Field, Input } from '@/components/admin/ui';
import { createZone } from '@/app/cms/actions/shipping';
import LocationPicker from './LocationPicker';
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

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Enter a zone name.');
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
        toast.error(result.error || 'Could not create the shipping zone.');
        return;
      }
      toast.success(`Zone “${name.trim()}” created.`);
      setName('');
      setLocations([]);
      setOpen(false);
    } catch {
      toast.error('Could not create the shipping zone.');
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} />
        Add Zone
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">New shipping zone</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              A zone groups the countries (and optionally states) that share the same shipping
              methods.
            </p>
          </div>
          <Button
            aria-label="Close new zone form"
            onClick={() => setOpen(false)}
            size="sm"
            variant="ghost"
          >
            <X size={15} />
          </Button>
        </div>

        <Field htmlFor="new-zone-name" label="Zone name">
          <Input
            id="new-zone-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Europe, Local pickup — Prishtina"
            value={name}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Covered locations</p>
          <LocationPicker
            countries={countries}
            onChange={setLocations}
            selected={locations}
            states={states}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={handleCreate}>
            <Globe size={15} />
            {pending ? 'Creating…' : 'Create zone'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
