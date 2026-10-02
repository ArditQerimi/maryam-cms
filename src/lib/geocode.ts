import 'server-only';

/**
 * Free, keyless geocoding through OpenStreetMap Nominatim: turns the store's
 * postal address into "lat,lng" for the Leaflet/OSM contact map, so the map
 * never needs a Google (or any other) API key.
 *
 * Nominatim's usage policy asks for an identifying User-Agent and light,
 * cached use — the result is cached for a day by Next's fetch cache, so a
 * storefront makes roughly one lookup per address per day.
 */
export async function geocodeAddress(address: string): Promise<string | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', query);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MaryamCMS/1.0 (storefront contact map)',
        'Accept-Language': 'sq,en',
      },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  } catch {
    // Offline or rate-limited: the page falls back to a plain address link.
    return null;
  }
}
