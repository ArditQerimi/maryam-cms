import type { Metadata } from 'next';
import { inArray } from 'drizzle-orm';
import { settingsStore } from '@/db/schema-tenant';
import { getContextCompany, getContextDb } from '@/lib/tenant';
import { geocodeAddress } from '@/lib/geocode';
import ContactClient from './ContactClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Na Kontaktoni',
  description: 'Kontaktoni dyqanin — informacionet e kontaktit dhe formulari i mesazheve.',
};

function readMerchantSettings(values: Record<string, string>) {
  // Settings saved through the admin forms are JSON-stringified; older rows
  // are plain text. Accept both so either source renders correctly.
  const read = (key: string) => {
    const raw = (values[key] || '').trim();
    if (!raw) return null;
    let value = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'string') value = parsed.trim();
    } catch {
      // plain-text row — use as-is
    }
    return value.length > 0 ? value : null;
  };
  return {
    email: read('email'),
    phone: read('phone'),
    address: read('address'),
    mapCoordinates: read('general_map_coordinates'),
  };
}

/** "lat, lng" → normalized pair; anything else is ignored (address fallback). */
function normalizeCoordinates(value: string | null): string | null {
  if (!value) return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `${lat},${lng}`;
}

export default async function ShopContactPage() {
  // Merchant contact details come from the tenant settings the admin edits
  // under Settings → General (settings_store). Missing values stay null and
  // the client keeps its honest "not configured" placeholders.
  let merchant = {
    email: null,
    phone: null,
    address: null,
    mapCoordinates: null,
  } as {
    email: string | null;
    phone: string | null;
    address: string | null;
    mapCoordinates: string | null;
  };
  try {
    const db = await getContextDb();
    const rows = await db
      .select({ key: settingsStore.key, value: settingsStore.value })
      .from(settingsStore)
      .where(
        inArray(settingsStore.key, ['email', 'phone', 'address', 'general_map_coordinates']),
      );
    merchant = readMerchantSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  } catch (error) {
    console.error('[Contact page] Settings load failed', error);
  }

  // The map pin prefers the exact coordinates from Settings → General; the
  // readable address (settings first, company record second) stays the caption.
  merchant.mapCoordinates = normalizeCoordinates(merchant.mapCoordinates);

  // Fallback: the company record carries the store's verified postal address,
  // so the contact panel and the map stay correct before the admin fills
  // Settings → General. An explicit settings value always wins.
  if (!merchant.address) {
    const company = await getContextCompany().catch(() => null);
    const fallbackAddress = company?.address?.trim();
    if (fallbackAddress) {
      merchant = { ...merchant, address: fallbackAddress };
    }
  }

  // No saved pin: look the address up on OpenStreetMap (free, no API key) so
  // the contact map is always the keyless Leaflet/OSM map.
  if (!merchant.mapCoordinates && merchant.address) {
    merchant = { ...merchant, mapCoordinates: await geocodeAddress(merchant.address) };
  }

  return <ContactClient merchant={merchant} />;
}
