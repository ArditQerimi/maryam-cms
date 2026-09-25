export const POS_PAYMENT_METHOD_DEFAULTS = [
  'Cash',
  'Card',
  'Points',
  'Deposit',
  'Cheque',
  'Gift Card',
  'Scan',
  'Pay Later',
  'External',
  'Split Bill',
] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHOD_DEFAULTS)[number];

const POS_PAYMENT_METHOD_SET = new Set<PosPaymentMethod>(POS_PAYMENT_METHOD_DEFAULTS);

const LEGACY_PAYMENT_METHOD_ALIASES: Record<string, PosPaymentMethod> = {
  cod: 'Cash',
  cash: 'Cash',
  card: 'Card',
  points: 'Points',
  deposit: 'Deposit',
  cheque: 'Cheque',
  check: 'Cheque',
  'gift card': 'Gift Card',
  giftcard: 'Gift Card',
  scan: 'Scan',
  qr: 'Scan',
  'pay later': 'Pay Later',
  external: 'External',
  paypal: 'External',
  'bank transfer': 'External',
  'split bill': 'Split Bill',
};

export function normalizePosPaymentMethod(input: string | null | undefined): PosPaymentMethod | null {
  if (!input) return null;

  const normalized = input.trim();
  if (!normalized) return null;

  if (POS_PAYMENT_METHOD_SET.has(normalized as PosPaymentMethod)) {
    return normalized as PosPaymentMethod;
  }

  return LEGACY_PAYMENT_METHOD_ALIASES[normalized.toLowerCase()] ?? null;
}

export function normalizePosPaymentMethods(
  methods: string[] | null | undefined,
  fallback: ReadonlyArray<PosPaymentMethod> = POS_PAYMENT_METHOD_DEFAULTS,
): PosPaymentMethod[] {
  const source = Array.isArray(methods) ? methods : [];
  const normalized = Array.from(new Set(source.map((item) => normalizePosPaymentMethod(item)).filter((item): item is PosPaymentMethod => Boolean(item))));

  const sourceKeys = source
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean);

  // Legacy default persisted before payment methods were aligned with POS labels.
  if (sourceKeys.length === 1 && sourceKeys[0] === 'cod') {
    return [...fallback];
  }

  return normalized.length > 0 ? normalized : [...fallback];
}
