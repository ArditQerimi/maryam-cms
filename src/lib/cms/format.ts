export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  ALL: 'L',
  MKD: 'ден',
  RSD: 'дин.',
};

export function formatMoney(value: number | string | null | undefined, currency = 'EUR') {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '—';
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${numeric.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}
