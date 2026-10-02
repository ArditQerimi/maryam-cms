import type { Dictionary } from '@/lib/i18n/dictionaries/en';

/** settings_store key holding the reporter's remembered range (report_* namespace). */
export const REPORT_SALES_RANGE_KEY = 'report_sales_range';

export type ReportPreset = '7d' | '30d' | 'month' | 'custom';

export const REPORT_PRESETS: readonly ReportPreset[] = ['7d', '30d', 'month', 'custom'];

export type ReportRange = {
  preset: ReportPreset;
  /** Inclusive start boundary (UTC midnight). */
  from: Date;
  /** Exclusive end boundary (UTC midnight of the day after the last day). */
  to: Date;
  label: string;
  /**
   * Dictionary key of the localized `label` for preset ranges (custom ranges
   * keep a literal date label). Resolve with `t(range.labelKey)`.
   */
  labelKey?: keyof Dictionary;
  fromParam: string;
  toParam: string;
};

export type ReportRangeSearch = {
  preset?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseUtcDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toDayParam(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Resolve `?preset=7d|30d|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
 * into an inclusive-from / exclusive-to UTC range. Falls back to "last 30
 * days" for missing or malformed input so reports always render.
 */
export function resolveReportRange(search: ReportRangeSearch): ReportRange {
  const presetRaw = first(search.preset);
  const now = new Date();
  const todayStart = utcDayStart(now);

  const build = (
    preset: ReportPreset,
    from: Date,
    toExclusive: Date,
    label: string,
    labelKey?: keyof Dictionary,
  ): ReportRange => ({
    preset,
    from,
    to: toExclusive,
    label,
    labelKey,
    fromParam: toDayParam(from),
    toParam: toDayParam(new Date(toExclusive.getTime() - DAY_MS)),
  });

  if (presetRaw === '7d') {
    return build('7d', new Date(todayStart.getTime() - 6 * DAY_MS), new Date(todayStart.getTime() + DAY_MS), 'Last 7 days', 'cmsdash.range.last7');
  }
  if (presetRaw === '30d') {
    return build('30d', new Date(todayStart.getTime() - 29 * DAY_MS), new Date(todayStart.getTime() + DAY_MS), 'Last 30 days', 'cmsdash.range.last30');
  }
  if (presetRaw === 'month') {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return build('month', monthStart, new Date(todayStart.getTime() + DAY_MS), 'This month', 'cmsdash.range.thisMonth');
  }
  if (presetRaw === 'custom') {
    const from = parseUtcDay(first(search.from));
    const to = parseUtcDay(first(search.to));
    if (from && to && from.getTime() <= to.getTime()) {
      const toExclusive = new Date(to.getTime() + DAY_MS);
      const label = from.getTime() === to.getTime()
        ? shortDate(from)
        : `${shortDate(from)} – ${shortDate(to)}`;
      return build('custom', from, toExclusive, label);
    }
  }

  return build('30d', new Date(todayStart.getTime() - 29 * DAY_MS), new Date(todayStart.getTime() + DAY_MS), 'Last 30 days', 'cmsdash.range.last30');
}

/** All UTC day keys (`YYYY-MM-DD`) covered by the range, for chart gap filling. */
export function dayKeys(range: ReportRange): string[] {
  const keys: string[] = [];
  const limit = Math.min(Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS), 1500);
  for (let index = 0; index < limit; index += 1) {
    keys.push(toDayParam(new Date(range.from.getTime() + index * DAY_MS)));
  }
  return keys;
}

/** `current month start` as a UTC Date (for "new this month" style stats). */
export function utcMonthStart(reference = new Date()): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
}
