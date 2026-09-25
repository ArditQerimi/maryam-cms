/**
 * Date-range helpers shared by every /cms/reports/* page.
 * All boundaries are computed in UTC so the server, the chart labels and the
 * SQL `date_trunc('day', …)` buckets agree.
 */

export type ReportPreset = '7d' | '30d' | 'month' | 'custom';

export type ReportRange = {
  preset: ReportPreset;
  label: string;
  /** Inclusive start of the first day. */
  from: Date;
  /** Exclusive end — start of the day after the last included day. */
  to: Date;
  /** `YYYY-MM-DD` values for the `<input type="date">` controls. */
  fromInput: string;
  toInput: string;
};

export const REPORT_PRESETS: ReadonlyArray<{ id: ReportPreset; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

export const MAX_RANGE_DAYS = 366;

/** UTC `YYYY-MM-DD` for a date. */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → UTC start of that day, or null when unusable. */
export function parseDay(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfToday(): Date {
  const now = new Date();
  return addDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), 1);
}

function customRange(from: Date, rawTo: Date | null): ReportRange {
  const today = endOfToday();
  let to = rawTo ? addDays(rawTo, 1) : today;
  if (to > today) to = today;
  if (to <= from) to = addDays(from, 1);

  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const bounded = spanDays > MAX_RANGE_DAYS ? addDays(from, MAX_RANGE_DAYS) : to;

  return {
    preset: 'custom',
    label: `${formatDay(from)} → ${formatDay(addDays(bounded, -1))}`,
    from,
    to: bounded,
    fromInput: formatDay(from),
    toInput: formatDay(addDays(bounded, -1)),
  };
}

export type SearchLike = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Resolves `?preset=&from=&to=` into an inclusive-from / exclusive-to range. */
export function resolveReportRange(params: SearchLike): ReportRange {
  const preset = firstParam(params.preset);
  const fromInput = firstParam(params.from);
  const toInput = firstParam(params.to);

  const today = endOfToday();

  if (preset === 'custom' || (!preset && fromInput && toInput)) {
    const from = parseDay(fromInput) ?? addDays(today, -29);
    const rawTo = parseDay(toInput);
    return customRange(from, rawTo);
  }

  if (preset === '7d') {
    const from = addDays(today, -7);
    return {
      preset: '7d',
      label: 'Last 7 days',
      from,
      to: today,
      fromInput: formatDay(from),
      toInput: formatDay(addDays(today, -1)),
    };
  }

  if (preset === 'month') {
    const from = startOfMonth(new Date());
    return {
      preset: 'month',
      label: 'This month',
      from,
      to: today,
      fromInput: formatDay(from),
      toInput: formatDay(addDays(today, -1)),
    };
  }

  // Default (and `30d`): last 30 days.
  const from = addDays(today, -30);
  return {
    preset: '30d',
    label: 'Last 30 days',
    from,
    to: today,
    fromInput: formatDay(from),
    toInput: formatDay(addDays(today, -1)),
  };
}

/** Every `YYYY-MM-DD` bucket between range.from and range.to. */
export function eachDay(range: ReportRange): string[] {
  const days: string[] = [];
  const total = Math.min(
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000),
    MAX_RANGE_DAYS,
  );
  for (let index = 0; index < total; index += 1) {
    days.push(formatDay(addDays(range.from, index)));
  }
  return days;
}
