/** settings_store key for the shipping classes list (owned by the shipping module). */
export const SHIPPING_CLASSES_KEY = 'shipping_classes';

export type ShippingClass = {
  id: string;
  name: string;
  description: string;
  slug: string;
};

export function parseShippingClasses(raw: string | null | undefined): ShippingClass[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: ShippingClass[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : '';
      if (!name) continue;
      const slug = typeof record.slug === 'string' && record.slug ? record.slug : name.toLowerCase();
      result.push({
        id: typeof record.id === 'string' && record.id ? record.id : slug,
        name,
        description: typeof record.description === 'string' ? record.description : '',
        slug,
      });
    }
    return result;
  } catch {
    return [];
  }
}
