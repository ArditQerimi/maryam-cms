import { asc, eq, inArray } from 'drizzle-orm';
import { Globe, MapPin } from 'lucide-react';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import {
  cmsCountries,
  cmsStates,
  shippingMethods,
  shippingZoneLocations,
  shippingZones,
} from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { getT, type Translator } from '@/lib/i18n/server';
import { EmptyState, PageHeader } from '@/components/admin/ui';
import AddZoneForm from '@/components/shipping/AddZoneForm';
import ZoneCard from '@/components/shipping/ZoneCard';
import type { CountryOption, StateOption, ZoneView } from '@/components/shipping/types';

export const dynamic = 'force-dynamic';

/** ISO code missing from `cms_countries` in most seeds. */
const KOSOVO: CountryOption = { code: 'XK', name: 'Kosovo' };

function buildCountryOptions(rows: Array<{ id: number; code: string; name: string }>): CountryOption[] {
  const options: CountryOption[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const code = row.code.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    options.push({ code, name: row.name });
  }
  if (!seen.has(KOSOVO.code)) options.push(KOSOVO);
  options.sort((a, b) => a.name.localeCompare(b.name));
  return options;
}

function locationLabel(
  location: { type: string; code: string },
  countryByCode: Map<string, string>,
  stateById: Map<string, { name: string; countryName: string }>,
  t: Translator,
): string {
  if (location.type === 'state') {
    const state = stateById.get(location.code);
    return state
      ? `${state.name} — ${state.countryName}`
      : t('cmsorders.shipping.state_fallback', { code: location.code });
  }
  const code = location.code.trim().toUpperCase();
  const name = code === KOSOVO.code ? KOSOVO.name : countryByCode.get(code);
  return name ? `${name} (${code})` : code;
}

export default async function ShippingZonesPage() {
  await requireCmsSession();
  const t = await getT();

  const company = await getContextCompany();
  const db = await getContextDb();

  const [zones, countryRows, stateRows] = await Promise.all([
    db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.companyId, company.id))
      .orderBy(asc(shippingZones.priority), asc(shippingZones.name)),
    db
      .select({ id: cmsCountries.id, code: cmsCountries.code, name: cmsCountries.name })
      .from(cmsCountries)
      .orderBy(asc(cmsCountries.name)),
    db
      .select({ id: cmsStates.id, countryId: cmsStates.countryId, name: cmsStates.name })
      .from(cmsStates)
      .orderBy(asc(cmsStates.name)),
  ]);

  const zoneIds = zones.map((zone) => zone.id);
  let locations: (typeof shippingZoneLocations.$inferSelect)[] = [];
  let methods: (typeof shippingMethods.$inferSelect)[] = [];
  if (zoneIds.length > 0) {
    [locations, methods] = await Promise.all([
      db.select().from(shippingZoneLocations).where(inArray(shippingZoneLocations.zoneId, zoneIds)),
      db
        .select()
        .from(shippingMethods)
        .where(inArray(shippingMethods.zoneId, zoneIds))
        .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.cost)),
    ]);
  }

  const countries = buildCountryOptions(countryRows);
  const countryNameById = new Map(countryRows.map((row) => [row.id, row.name]));
  const countryByCode = new Map(countries.map((country) => [country.code, country.name]));
  const states: StateOption[] = stateRows.map((row) => ({
    code: String(row.id),
    name: row.name,
    countryName: countryNameById.get(row.countryId) ?? '—',
  }));
  const stateById = new Map(states.map((state) => [state.code, state]));

  const locationsByZone = new Map<number, ZoneView['locations']>();
  for (const location of locations) {
    const list = locationsByZone.get(location.zoneId) ?? [];
    list.push({
      id: location.id,
      type: location.type,
      code: location.code,
      label: locationLabel(location, countryByCode, stateById, t),
    });
    locationsByZone.set(location.zoneId, list);
  }

  const methodsByZone = new Map<number, ZoneView['methods']>();
  for (const method of methods) {
    const list = methodsByZone.get(method.zoneId) ?? [];
    list.push({
      id: method.id,
      zoneId: method.zoneId,
      type: method.type,
      title: method.title,
      cost: String(method.cost),
      minOrderAmount: String(method.minOrderAmount),
      enabled: method.enabled,
      instructions: method.instructions,
      sortOrder: method.sortOrder,
    });
    methodsByZone.set(method.zoneId, list);
  }

  const zoneViews: ZoneView[] = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    priority: zone.priority,
    locations: locationsByZone.get(zone.id) ?? [],
    methods: methodsByZone.get(zone.id) ?? [],
  }));

  return (
    <div>
      <PageHeader
        title={t('cmsorders.shipping.zones_title')}
        description={t('cmsorders.shipping.zones_description')}
      />

      <div className="mb-6">
        <AddZoneForm countries={countries} states={states} />
      </div>

      {zoneViews.length === 0 ? (
        <EmptyState
          description={t('cmsorders.shipping.zones_empty_desc')}
          icon={<Globe size={28} />}
          title={t('cmsorders.shipping.zones_empty_title')}
        />
      ) : (
        <div className="space-y-4">
          {zoneViews.map((zone) => (
            <ZoneCard countries={countries} key={zone.id} states={states} zone={zone} />
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
        <MapPin className="mt-0.5 shrink-0 text-[#5b59d6]" size={14} />
        {t('cmsorders.shipping.zones_help')}
      </p>
    </div>
  );
}
