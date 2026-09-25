'use client';

import { useState, useTransition, type FormEvent } from 'react';
import {
  ChevronDown,
  Globe2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Label,
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
  createZone,
  deleteShippingMethod,
  deleteZone,
  removeZoneLocation,
  updateShippingMethod,
  updateZone,
  type ShippingActionResult,
} from '@/app/cms/actions/shipping';
import LocationPicker from './LocationPicker';
import type { LocationChoice } from './types';
import {
  METHOD_TYPE_LABELS,
  SHIPPING_METHOD_TYPES,
  type LocationOption,
  type ShippingMethodType,
  type ZoneDto,
  type ZoneMethodDto,
} from './shipping-shared';

type ZonesManagerProps = {
  zones: ZoneDto[];
  options: LocationOption[];
};

const DEFAULT_METHOD: Record<ShippingMethodType, { title: string; cost: string; minOrderAmount: string }> = {
  flat_rate: { title: 'Standard delivery', cost: '5.00', minOrderAmount: '0' },
  free_shipping: { title: 'Free shipping', cost: '0', minOrderAmount: '50' },
  local_pickup: { title: 'Local pickup', cost: '0', minOrderAmount: '0' },
};

function optionKey(option: LocationOption): string {
  return `${option.type}:${option.code}`;
}

function toFormData(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/* -------------------------------------------------------------------------- */
/* Create zone                                                                */
/* -------------------------------------------------------------------------- */

function CreateZoneForm({
  options,
  onCancel,
  onCreate,
}: {
  options: LocationOption[];
  onCancel: () => void;
  onCreate: (formData: FormData) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<LocationOption[]>([]);

  /**
   * The shared `LocationPicker` speaks `LocationChoice[]`; translate back into
   * `LocationOption[]` so the submit handler and the rest of this form stay as
   * they were. Known options keep their original grouping label.
   */
  const applyChoices = (next: LocationChoice[]) => {
    setSelected(
      next.map((choice) => {
        const key = `${choice.type}:${choice.code}`;
        const known = options.find((option) => option.key === key);
        return (
          known ?? {
            key,
            type: choice.type,
            code: choice.code,
            label: choice.label,
            group: choice.label,
          }
        );
      }),
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a zone name.');
      return;
    }
    const formData = new FormData();
    formData.set('name', trimmed);
    formData.set(
      'locations',
      JSON.stringify(
        selected.map((option) => ({ type: option.type, code: option.code })),
      ),
    );
    onCreate(formData);
  };

  return (
    <Card className="border-[#6d6be8]/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add shipping zone</CardTitle>
        <button
          aria-label="Cancel"
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          onClick={onCancel}
          type="button"
        >
          <X size={16} />
        </button>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <Field htmlFor="new-zone-name" label="Zone name">
            <Input
              id="new-zone-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Kosovo & Albania"
              value={name}
            />
          </Field>

          <div>
            <Label>Locations covered</Label>
            <p className="-mt-1 mb-2 text-xs text-zinc-500">
              Pick every country (and optionally state) this zone applies to. Zones with no
              locations never match an order.
            </p>
            <LocationPicker
              countries={options
                .filter((option) => option.type === 'country')
                .map((option) => ({ code: option.code, name: option.label }))}
              states={[]}
              selected={selected.map((option) => ({
                type: option.type,
                code: option.code,
                label: option.label,
              }))}
              onChange={applyChoices}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">Create zone</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline zone name                                                           */
/* -------------------------------------------------------------------------- */

function ZoneNameField({
  zoneId,
  name,
  disabled,
  onRename,
}: {
  zoneId: number;
  name: string;
  disabled: boolean;
  onRename: (zoneId: number, nextName: string) => void;
}) {
  const [value, setValue] = useState(name);
  const dirty = value.trim() !== name.trim() && value.trim().length > 0;

  const save = () => {
    if (!dirty) return;
    onRename(zoneId, value.trim());
  };

  return (
    <Input
      aria-label="Zone name"
      className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 font-semibold text-zinc-900 hover:border-zinc-300 focus:border-[#6d6be8] focus:bg-white"
      disabled={disabled}
      onBlur={save}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      value={value}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Method form                                                                */
/* -------------------------------------------------------------------------- */

function MethodForm({
  method,
  onCancel,
  onSubmit,
}: {
  method: ZoneMethodDto | null;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const initialType = (method?.type && SHIPPING_METHOD_TYPES.includes(method.type as ShippingMethodType)
    ? method.type
    : 'flat_rate') as ShippingMethodType;

  const [type, setType] = useState<ShippingMethodType>(initialType);
  const [title, setTitle] = useState(method?.title ?? DEFAULT_METHOD[initialType].title);
  const [cost, setCost] = useState(method?.cost ?? DEFAULT_METHOD[initialType].cost);
  const [minOrderAmount, setMinOrderAmount] = useState(
    method?.minOrderAmount ?? DEFAULT_METHOD[initialType].minOrderAmount,
  );
  const [instructions, setInstructions] = useState(method?.instructions ?? '');
  const [enabled, setEnabled] = useState(method?.enabled ?? true);

  const changeType = (next: ShippingMethodType) => {
    setType(next);
    if (!method) {
      setTitle(DEFAULT_METHOD[next].title);
      setCost(DEFAULT_METHOD[next].cost);
      setMinOrderAmount(DEFAULT_METHOD[next].minOrderAmount);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error('Enter a method title.');
      return;
    }
    const formData = new FormData();
    formData.set('type', type);
    formData.set('title', title.trim());
    formData.set('cost', cost);
    formData.set('minOrderAmount', minOrderAmount);
    formData.set('instructions', instructions);
    formData.set('enabled', enabled ? 'true' : 'false');
    formData.set('sortOrder', String(method?.sortOrder ?? 0));
    onSubmit(formData);
  };

  return (
    <form className="space-y-3 rounded-lg border border-[#6d6be8]/30 bg-[#6d6be8]/5 p-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field htmlFor="method-type" label="Method type">
          <Select
            disabled={Boolean(method)}
            id="method-type"
            onChange={(event) => changeType(event.target.value as ShippingMethodType)}
            value={type}
          >
            {SHIPPING_METHOD_TYPES.map((value) => (
              <option key={value} value={value}>
                {METHOD_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field htmlFor="method-title" label="Title shown at checkout">
          <Input
            id="method-title"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </Field>

        {type === 'flat_rate' ? (
          <Field
            htmlFor="method-cost"
            hint="What the customer pays for delivery."
            label="Cost"
          >
            <Input
              id="method-cost"
              inputMode="decimal"
              onChange={(event) => setCost(event.target.value)}
              value={cost}
            />
          </Field>
        ) : null}

        {type === 'free_shipping' ? (
          <Field
            htmlFor="method-min-order"
            hint="Minimum order subtotal. Use 0 to always be free."
            label="Minimum order amount"
          >
            <Input
              id="method-min-order"
              inputMode="decimal"
              onChange={(event) => setMinOrderAmount(event.target.value)}
              value={minOrderAmount}
            />
          </Field>
        ) : null}
      </div>

      {type === 'local_pickup' ? (
        <Field htmlFor="method-instructions" label="Pickup instructions">
          <Textarea
            id="method-instructions"
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Address, opening hours, what to bring…"
            value={instructions}
          />
        </Field>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          checked={enabled}
          className="h-4 w-4 rounded border-zinc-300 accent-[#6d6be8]"
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Enabled
      </label>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">{method ? 'Save method' : 'Add method'}</Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Zone card                                                                  */
/* -------------------------------------------------------------------------- */

function ZoneCard({
  zone,
  options,
  disabled,
  onToggle,
  expanded,
  onRename,
  onDelete,
  onRemoveLocation,
  onAddLocation,
  onSaveMethod,
  onDeleteMethod,
}: {
  zone: ZoneDto;
  options: LocationOption[];
  disabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRename: (zoneId: number, nextName: string) => void;
  onDelete: (zoneId: number) => void;
  onRemoveLocation: (locationId: number) => void;
  onAddLocation: (zoneId: number, option: LocationOption) => void;
  onSaveMethod: (zoneId: number, methodId: number | null, formData: FormData) => void;
  onDeleteMethod: (methodId: number) => void;
}) {
  const [addingMethod, setAddingMethod] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);

  const selectedKeys = zone.locations.map(
    (location) => `${location.type}:${location.code}`,
  );
  const usedKeys = new Set(selectedKeys);

  const removeLocation = (locationId: number) => {
    if (!window.confirm('Remove this location from the zone?')) return;
    onRemoveLocation(locationId);
  };

  const removeMethod = (methodId: number) => {
    if (!window.confirm('Delete this shipping method?')) return;
    onDeleteMethod(methodId);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <button
          aria-expanded={expanded}
          aria-label={`Toggle zone ${zone.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6d6be8]/10 text-[#5b59d6] transition hover:bg-[#6d6be8]/20"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown
            className={cn('transition-transform', expanded && 'rotate-180')}
            size={16}
          />
        </button>

        <div className="min-w-0 flex-1">
          <ZoneNameField
            disabled={disabled}
            name={zone.name}
            onRename={onRename}
            zoneId={zone.id}
          />
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="info">
              {zone.locations.length} {zone.locations.length === 1 ? 'location' : 'locations'}
            </Badge>
            <Badge tone="neutral">
              {zone.methods.length} {zone.methods.length === 1 ? 'method' : 'methods'}
            </Badge>
          </span>
        </div>

        <button
          aria-label={`Delete zone ${zone.name}`}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
          disabled={disabled}
          onClick={() => onDelete(zone.id)}
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </CardHeader>

      {expanded ? (
        <CardContent className="space-y-6">
          {/* Locations */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">Covered locations</h4>
                <p className="text-xs text-zinc-500">
                  Countries and states this zone ships to.
                </p>
              </div>
              <Button
                onClick={() => setAddingLocation((current) => !current)}
                size="sm"
                variant="outline"
              >
                <Plus size={14} /> Add location
              </Button>
            </div>

            {zone.locations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-500">
                No locations yet — this zone will not match any order.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {zone.locations.map((location) => (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                    key={location.id}
                  >
                    {location.type === 'state' ? (
                      <MapPin size={12} className="text-zinc-400" />
                    ) : (
                      <Globe2 size={12} className="text-zinc-400" />
                    )}
                    {location.label}
                    <span className="text-zinc-400">({location.code})</span>
                    <button
                      aria-label={`Remove ${location.label}`}
                      className="rounded-full p-0.5 transition hover:bg-zinc-200"
                      disabled={disabled}
                      onClick={() => removeLocation(location.id)}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {addingLocation ? (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <LocationPicker
                  countries={options
                    .filter((option) => option.type === 'country')
                    .map((option) => ({ code: option.code, name: option.label }))}
                  states={options
                    .filter((option) => option.type === 'state')
                    .map((option) => ({
                      code: option.code,
                      countryName: option.group,
                      name: option.label,
                    }))}
                  selected={zone.locations.map((location) => ({
                    type: location.type,
                    code: location.code,
                    label: location.label,
                  }))}
                  onChange={(next) => {
                    const nextKeys = new Set(
                      next.map((choice) => `${choice.type}:${choice.code}`),
                    );
                    // Newly picked locations are added…
                    for (const choice of next) {
                      const key = `${choice.type}:${choice.code}`;
                      if (usedKeys.has(key)) continue;
                      const option = options.find((entry) => entry.key === key);
                      if (option) onAddLocation(zone.id, option);
                    }
                    // …locations the admin deselected are removed.
                    for (const location of zone.locations) {
                      if (!nextKeys.has(`${location.type}:${location.code}`)) {
                        removeLocation(location.id);
                      }
                    }
                  }}
                />
              </div>
            ) : null}
          </section>

          {/* Methods */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">Shipping methods</h4>
                <p className="text-xs text-zinc-500">
                  Methods offered when the order ships to this zone.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingMethodId(null);
                  setAddingMethod((current) => !current);
                }}
                size="sm"
                variant="outline"
              >
                <Plus size={14} /> Add method
              </Button>
            </div>

            {zone.methods.length === 0 && !addingMethod ? (
              <EmptyState
                action={
                  <Button onClick={() => setAddingMethod(true)} size="sm">
                    <Plus size={14} /> Add method
                  </Button>
                }
                description="This zone has no methods yet, so checkout will use the default fallback."
                icon={<Truck size={26} />}
                title="No shipping methods"
              />
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
                  {zone.methods.map((method) =>
                    editingMethodId === method.id ? (
                      <tr key={method.id}>
                        <Td className="bg-[#6d6be8]/5" colSpan={6}>
                          <MethodForm
                            key={method.id}
                            method={method}
                            onCancel={() => setEditingMethodId(null)}
                            onSubmit={(formData) =>
                              onSaveMethod(zone.id, method.id, formData)
                            }
                          />
                        </Td>
                      </tr>
                    ) : (
                      <tr className="transition hover:bg-zinc-50" key={method.id}>
                        <Td>
                          <Badge tone={method.enabled ? 'brand' : 'neutral'}>
                            {METHOD_TYPE_LABELS[
                              (SHIPPING_METHOD_TYPES as readonly string[]).includes(method.type)
                                ? (method.type as ShippingMethodType)
                                : 'flat_rate'
                            ] ?? method.type}
                          </Badge>
                        </Td>
                        <Td className="font-medium text-zinc-900">{method.title}</Td>
                        <Td className="whitespace-nowrap">
                          {method.type === 'flat_rate'
                            ? formatMoney(method.cost)
                            : method.type === 'free_shipping'
                              ? 'Free'
                              : '—'}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {Number.parseFloat(method.minOrderAmount) > 0
                            ? formatMoney(method.minOrderAmount)
                            : 'Any'}
                        </Td>
                        <Td>
                          <input
                            aria-label={`Enable ${method.title}`}
                            checked={method.enabled}
                            className="h-4 w-4 rounded border-zinc-300 accent-[#6d6be8]"
                            disabled={disabled}
                            onChange={(event) => {
                              const formData = toFormData({
                                type: method.type,
                                title: method.title,
                                cost: method.cost,
                                minOrderAmount: method.minOrderAmount,
                                instructions: method.instructions ?? '',
                                enabled: event.target.checked ? 'true' : 'false',
                                sortOrder: String(method.sortOrder),
                              });
                              onSaveMethod(zone.id, method.id, formData);
                            }}
                            type="checkbox"
                          />
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <button
                              aria-label={`Edit ${method.title}`}
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                              disabled={disabled}
                              onClick={() => {
                                setAddingMethod(false);
                                setEditingMethodId(method.id);
                              }}
                              type="button"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`Delete ${method.title}`}
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                              disabled={disabled}
                              onClick={() => removeMethod(method.id)}
                              type="button"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ),
                  )}
                </tbody>
              </Table>
            )}

            {addingMethod ? (
              <div className="mt-3">
                <MethodForm
                  method={null}
                  onCancel={() => setAddingMethod(false)}
                  onSubmit={(formData) => onSaveMethod(zone.id, null, formData)}
                />
              </div>
            ) : null}
          </section>
        </CardContent>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Manager                                                                    */
/* -------------------------------------------------------------------------- */

export default function ZonesManager({ zones, options }: ZonesManagerProps) {
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(zones[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ShippingActionResult>, success: string) => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(success);
        else toast.error(result.error ?? 'Something went wrong.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  const renameZone = (zoneId: number, nextName: string) => {
    const formData = new FormData();
    formData.set('name', nextName);
    run(() => updateZone(zoneId, formData), 'Zone updated.');
  };

  const saveMethod = (zoneId: number, methodId: number | null, formData: FormData) => {
    if (methodId === null) {
      run(() => createShippingMethod(zoneId, formData), 'Method added.');
    } else {
      run(() => updateShippingMethod(methodId, formData), 'Method saved.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Zones decide which methods a shopper sees at checkout. The first zone that covers the
          destination country wins.
        </p>
        <Button
          disabled={pending || creating}
          onClick={() => setCreating((current) => !current)}
        >
          <Plus size={16} /> Add zone
        </Button>
      </div>

      {creating ? (
        <CreateZoneForm
          onCancel={() => setCreating(false)}
          onCreate={(formData) =>
            run(() => createZone(formData).then((result) => {
              if (result.ok) setCreating(false);
              return result;
            }), 'Zone created.')
          }
          options={options}
        />
      ) : null}

      {zones.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Add zone
            </Button>
          }
          description="Create your first zone to tell the storefront where you ship and which methods apply."
          icon={<Truck size={28} />}
          title="No shipping zones yet"
        />
      ) : (
        <div className="space-y-3">
          {zones.map((zone) => (
            <ZoneCard
              expanded={expandedId === zone.id}
              key={zone.id}
              onAddLocation={(zoneId, option) =>
                run(
                  () => addZoneLocation(zoneId, option.type, option.code),
                  `${option.label} added.`,
                )
              }
              onDelete={(zoneId) => {
                if (!window.confirm('Delete this zone and all of its methods?')) return;
                run(() => deleteZone(zoneId), 'Zone deleted.');
              }}
              onDeleteMethod={(methodId) =>
                run(() => deleteShippingMethod(methodId), 'Method deleted.')
              }
              onRemoveLocation={(locationId) =>
                run(() => removeZoneLocation(locationId), 'Location removed.')
              }
              onRename={renameZone}
              onSaveMethod={saveMethod}
              onToggle={() =>
                setExpandedId((current) => (current === zone.id ? null : zone.id))
              }
              options={options}
              disabled={pending}
              zone={zone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
