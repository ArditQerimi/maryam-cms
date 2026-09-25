'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  cn,
} from '@/components/admin/ui';
import { formatMoney } from '@/lib/cms/format';
import {
  addZoneLocation,
  createShippingMethod,
  deleteShippingMethod,
  deleteZone,
  removeZoneLocation,
  updateShippingMethod,
  updateZone,
} from '@/app/cms/actions/shipping';
import LocationPicker from './LocationPicker';
import {
  METHOD_TYPE_LABELS,
  type CountryOption,
  type LocationChoice,
  type StateOption,
  type ZoneMethodView,
  type ZoneView,
} from './types';

type ZoneCardProps = {
  zone: ZoneView;
  countries: CountryOption[];
  states: StateOption[];
};

function methodCostCell(method: ZoneMethodView): string {
  if (method.type === 'free_shipping') {
    const min = Number(method.minOrderAmount);
    return min > 0 ? `Free over ${formatMoney(min)}` : 'Free';
  }
  if (method.type === 'local_pickup') return '—';
  return formatMoney(method.cost);
}

function minOrderCell(method: ZoneMethodView): string {
  if (method.type === 'local_pickup') return '—';
  const min = Number(method.minOrderAmount);
  return min > 0 ? formatMoney(min) : '—';
}

/* -------------------------------------------------------------------------- */
/* Inline method form (create + edit)                                          */
/* -------------------------------------------------------------------------- */

function MethodForm({
  zoneId,
  method,
  onCancel,
  onSaved,
}: {
  zoneId: number;
  method?: ZoneMethodView;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(method?.type ?? 'flat_rate');
  const [title, setTitle] = useState(method?.title ?? '');
  const [cost, setCost] = useState(method ? String(Number(method.cost)) : '');
  const [minOrderAmount, setMinOrderAmount] = useState(
    method ? String(Number(method.minOrderAmount)) : '',
  );
  const [instructions, setInstructions] = useState(method?.instructions ?? '');
  const [sortOrder, setSortOrder] = useState(String(method?.sortOrder ?? 0));
  const [enabled, setEnabled] = useState(method?.enabled ?? true);
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Enter a method title.');
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set('type', type);
      formData.set('title', title.trim());
      formData.set('cost', cost.trim() || '0');
      formData.set('minOrderAmount', minOrderAmount.trim() || '0');
      formData.set('instructions', instructions.trim());
      formData.set('sortOrder', sortOrder.trim() || '0');
      formData.set('enabled', enabled ? 'true' : 'false');

      const result = method
        ? await updateShippingMethod(method.id, formData)
        : await createShippingMethod(zoneId, formData);

      if (!result.ok) {
        toast.error(result.error || 'Could not save the shipping method.');
        return;
      }
      toast.success(method ? 'Shipping method updated.' : 'Shipping method added.');
      onSaved();
    } catch {
      toast.error('Could not save the shipping method.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#6d6be8]/30 bg-[#6d6be8]/[0.04] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5b59d6]">
        {method ? 'Edit shipping method' : 'Add shipping method'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor={`method-type-${zoneId}`} label="Method type">
          <Select
            disabled={Boolean(method)}
            id={`method-type-${zoneId}`}
            onChange={(event) => setType(event.target.value)}
            value={type}
          >
            <option value="flat_rate">Flat Rate</option>
            <option value="free_shipping">Free Shipping</option>
            <option value="local_pickup">Local Pickup</option>
          </Select>
        </Field>

        <Field htmlFor={`method-title-${zoneId}`} label="Title">
          <Input
            id={`method-title-${zoneId}`}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Standard delivery"
            value={title}
          />
        </Field>

        {type === 'flat_rate' ? (
          <Field
            htmlFor={`method-cost-${zoneId}`}
            label="Cost"
            hint="Fixed amount charged for this method."
          >
            <Input
              id={`method-cost-${zoneId}`}
              inputMode="decimal"
              onChange={(event) => setCost(event.target.value)}
              placeholder="0.00"
              value={cost}
            />
          </Field>
        ) : null}

        {type === 'free_shipping' ? (
          <Field
            htmlFor={`method-min-${zoneId}`}
            label="Minimum order amount"
            hint="Order subtotal required for free shipping. Use 0 to always be free."
          >
            <Input
              id={`method-min-${zoneId}`}
              inputMode="decimal"
              onChange={(event) => setMinOrderAmount(event.target.value)}
              placeholder="0.00"
              value={minOrderAmount}
            />
          </Field>
        ) : null}

        {type === 'local_pickup' ? (
          <div className="sm:col-span-2">
            <Field htmlFor={`method-instructions-${zoneId}`} label="Pickup instructions">
              <Textarea
                id={`method-instructions-${zoneId}`}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="e.g. Collect from Market Street 12, Mon–Sat 09:00–17:00."
                value={instructions}
              />
            </Field>
          </div>
        ) : null}

        <Field htmlFor={`method-sort-${zoneId}`} label="Sort order">
          <Input
            id={`method-sort-${zoneId}`}
            inputMode="numeric"
            onChange={(event) => setSortOrder(event.target.value)}
            value={sortOrder}
          />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
        <input
          checked={enabled}
          className="h-4 w-4 rounded border-zinc-300 accent-[#6d6be8]"
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Enabled — customers can choose this method
      </label>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button onClick={onCancel} size="sm" variant="outline">
          Cancel
        </Button>
        <Button disabled={pending} onClick={handleSubmit} size="sm">
          <Save size={14} />
          {pending ? 'Saving…' : method ? 'Save changes' : 'Add method'}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Zone card                                                                   */
/* -------------------------------------------------------------------------- */

export default function ZoneCard({ zone, countries, states }: ZoneCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(zone.name);
  const [pending, setPending] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null);
  const [editingLocations, setEditingLocations] = useState(false);
  const [locationDraft, setLocationDraft] = useState<LocationChoice[]>([]);

  const openLocationEditor = () => {
    setLocationDraft(
      zone.locations.map((location) => ({
        type: location.type === 'state' ? 'state' : 'country',
        code: location.code,
        label: location.label,
      })),
    );
    setEditingLocations(true);
  };

  const saveName = async () => {
    const nextName = nameDraft.trim();
    if (!nextName) {
      toast.error('Enter a zone name.');
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set('name', nextName);
      const result = await updateZone(zone.id, formData);
      if (!result.ok) {
        toast.error(result.error || 'Could not rename the zone.');
        return;
      }
      toast.success('Zone renamed.');
      setEditingName(false);
    } catch {
      toast.error('Could not rename the zone.');
    } finally {
      setPending(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!window.confirm(`Delete the zone “${zone.name}”? Its locations and shipping methods will be removed too.`)) {
      return;
    }
    setPending(true);
    try {
      const result = await deleteZone(zone.id);
      if (!result.ok) {
        toast.error(result.error || 'Could not delete the zone.');
        return;
      }
      toast.success('Shipping zone deleted.');
    } catch {
      toast.error('Could not delete the zone.');
    } finally {
      setPending(false);
    }
  };

  const saveLocations = async () => {
    setPending(true);
    try {
      const keep = new Set(locationDraft.map((choice) => `${choice.type}:${choice.code}`));
      const existing = new Map(
        zone.locations.map((location) => [`${location.type}:${location.code}`, location]),
      );

      for (const choice of locationDraft) {
        const key = `${choice.type}:${choice.code}`;
        if (!existing.has(key)) {
          const result = await addZoneLocation(zone.id, choice.type, choice.code);
          if (!result.ok) {
            toast.error(result.error || 'Could not add a location.');
            return;
          }
        }
      }
      for (const location of zone.locations) {
        const key = `${location.type}:${location.code}`;
        if (!keep.has(key)) {
          const result = await removeZoneLocation(location.id);
          if (!result.ok) {
            toast.error(result.error || 'Could not remove a location.');
            return;
          }
        }
      }
      toast.success('Zone locations updated.');
      setEditingLocations(false);
    } catch {
      toast.error('Could not update the zone locations.');
    } finally {
      setPending(false);
    }
  };

  const handleDeleteMethod = async (method: ZoneMethodView) => {
    if (!window.confirm(`Delete the shipping method “${method.title}”?`)) return;
    try {
      const result = await deleteShippingMethod(method.id);
      if (!result.ok) {
        toast.error(result.error || 'Could not delete the shipping method.');
        return;
      }
      toast.success('Shipping method deleted.');
      if (editingMethodId === method.id) setEditingMethodId(null);
    } catch {
      toast.error('Could not delete the shipping method.');
    }
  };

  const visibleLocations = zone.locations.slice(0, 4);
  const hiddenLocationCount = zone.locations.length - visibleLocations.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <button
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <ChevronDown
            className={cn('shrink-0 text-zinc-400 transition', !expanded && '-rotate-90')}
            size={16}
          />
          {editingName ? (
            <span
              className="flex flex-1 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Input
                autoFocus
                className="h-8 max-w-xs py-1.5 text-sm"
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveName();
                  if (event.key === 'Escape') {
                    setNameDraft(zone.name);
                    setEditingName(false);
                  }
                }}
                value={nameDraft}
              />
              <Button disabled={pending} onClick={() => void saveName()} size="sm">
                <Save size={14} />
                Save
              </Button>
              <Button
                onClick={() => {
                  setNameDraft(zone.name);
                  setEditingName(false);
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </span>
          ) : (
            <>
              <CardTitle className="truncate">{zone.name}</CardTitle>
              <Badge tone="brand">
                {zone.locations.length} location{zone.locations.length === 1 ? '' : 's'}
              </Badge>
              <Badge tone="neutral">
                {zone.methods.length} method{zone.methods.length === 1 ? '' : 's'}
              </Badge>
            </>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {!editingName ? (
            <Button
              aria-label={`Rename ${zone.name}`}
              onClick={() => setEditingName(true)}
              size="sm"
              variant="ghost"
            >
              <Pencil size={14} />
            </Button>
          ) : null}
          <Button
            aria-label={`Delete ${zone.name}`}
            disabled={pending}
            onClick={() => void handleDeleteZone()}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="text-red-500" size={14} />
          </Button>
        </div>
      </CardHeader>

      <div className={cn(!expanded && 'hidden')}>
        <CardContent className="space-y-4">
          {/* Covered locations */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <MapPin size={13} />
                Covered locations
              </p>
              {!editingLocations ? (
                <Button onClick={openLocationEditor} size="sm" variant="outline">
                  Edit locations
                </Button>
              ) : null}
            </div>

            {!editingLocations ? (
              zone.locations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No locations yet — this zone will not match any checkout address.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {visibleLocations.map((location) => (
                    <span
                      className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                      key={`${location.type}:${location.code}`}
                    >
                      {location.label}
                    </span>
                  ))}
                  {hiddenLocationCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
                      +{hiddenLocationCount} more
                    </span>
                  ) : null}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <LocationPicker
                  compact
                  countries={countries}
                  onChange={setLocationDraft}
                  selected={locationDraft}
                  states={states}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button onClick={() => setEditingLocations(false)} size="sm" variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={pending} onClick={() => void saveLocations()} size="sm">
                    <Save size={14} />
                    {pending ? 'Saving…' : 'Save locations'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Methods */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Truck size={13} />
                Shipping methods
              </p>
              <Button
                onClick={() => {
                  setEditingMethodId(null);
                  setAddingMethod((current) => !current);
                }}
                size="sm"
                variant="outline"
              >
                <Plus size={14} />
                Add method
              </Button>
            </div>

            {zone.methods.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500">
                No shipping methods yet. Add Flat Rate, Free Shipping, or Local Pickup below.
              </p>
            ) : (
              <Table bare>
                <thead>
                  <tr>
                    <Th>Method</Th>
                    <Th>Title</Th>
                    <Th>Cost</Th>
                    <Th>Min order</Th>
                    <Th>Enabled</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {zone.methods.map((method) => (
                    <tr key={method.id} className="transition hover:bg-zinc-50">
                      <Td>
                        <Badge tone="brand">{METHOD_TYPE_LABELS[method.type] || method.type}</Badge>
                      </Td>
                      <Td className="max-w-[240px]">
                        <span className="block truncate font-medium text-zinc-900">
                          {method.title}
                        </span>
                        {method.instructions ? (
                          <span className="block truncate text-xs text-zinc-400">
                            {method.instructions}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap">{methodCostCell(method)}</Td>
                      <Td className="whitespace-nowrap">{minOrderCell(method)}</Td>
                      <Td>
                        <Badge tone={method.enabled ? 'success' : 'danger'}>
                          {method.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <Button
                            aria-label={`Edit ${method.title}`}
                            onClick={() => {
                              setAddingMethod(false);
                              setEditingMethodId((current) =>
                                current === method.id ? null : method.id,
                              );
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            aria-label={`Delete ${method.title}`}
                            onClick={() => void handleDeleteMethod(method)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="text-red-500" size={14} />
                          </Button>
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {editingMethodId !== null ? (
              <div className="mt-3">
                <MethodForm
                  key={`edit-${editingMethodId}`}
                  method={zone.methods.find((method) => method.id === editingMethodId)}
                  onCancel={() => setEditingMethodId(null)}
                  onSaved={() => setEditingMethodId(null)}
                  zoneId={zone.id}
                />
              </div>
            ) : null}

            {addingMethod ? (
              <div className="mt-3">
                <MethodForm
                  key={`add-${zone.id}`}
                  onCancel={() => setAddingMethod(false)}
                  onSaved={() => setAddingMethod(false)}
                  zoneId={zone.id}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
