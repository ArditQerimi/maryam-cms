export type DashboardRangeKey = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisMonth' | 'lastMonth' | 'custom';

export type DashboardDateRange = {
  key: DashboardRangeKey;
  label: string;
  startDate: Date;
  endDate: Date;
};

export const dashboardRangeOptions: Array<{ key: DashboardRangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7Days', label: 'Last 7 Days' },
  { key: 'last30Days', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
];

const dayMs = 24 * 60 * 60 * 1000;

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function formatDashboardDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatDashboardDateRangeLabel(startDate: Date, endDate: Date): string {
  return `${formatDashboardDate(startDate)} - ${formatDashboardDate(endDate)}`;
}

export function parseDashboardDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getDashboardDateRangeFromSearchParams(searchParams?: Record<string, string | string[] | undefined>): DashboardDateRange {
  const now = new Date();
  const rangeKey = getSearchParamValue(searchParams?.range) as DashboardRangeKey | undefined;

  if (rangeKey === 'custom') {
    const customStart = parseDashboardDate(getSearchParamValue(searchParams?.start));
    const customEnd = parseDashboardDate(getSearchParamValue(searchParams?.end));

    if (customStart && customEnd) {
      const normalizedStart = startOfDay(customStart <= customEnd ? customStart : customEnd);
      const normalizedEnd = endOfDay(customStart <= customEnd ? customEnd : customStart);

      return {
        key: 'custom',
        label: formatDashboardDateRangeLabel(normalizedStart, normalizedEnd),
        startDate: normalizedStart,
        endDate: normalizedEnd,
      };
    }
  }

  switch (rangeKey) {
    case 'today': {
      const startDate = startOfDay(now);
      return { key: 'today', label: formatDashboardDateRangeLabel(startDate, endOfDay(now)), startDate, endDate: endOfDay(now) };
    }
    case 'yesterday': {
      const startDate = startOfDay(new Date(now.getTime() - dayMs));
      const endDate = endOfDay(startDate);
      return { key: 'yesterday', label: formatDashboardDateRangeLabel(startDate, endDate), startDate, endDate };
    }
    case 'last30Days': {
      const startDate = startOfDay(new Date(now.getTime() - (29 * dayMs)));
      return { key: 'last30Days', label: formatDashboardDateRangeLabel(startDate, endOfDay(now)), startDate, endDate: endOfDay(now) };
    }
    case 'thisMonth': {
      const startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { key: 'thisMonth', label: formatDashboardDateRangeLabel(startDate, endOfDay(now)), startDate, endDate: endOfDay(now) };
    }
    case 'lastMonth': {
      const startDate = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const endDate = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { key: 'lastMonth', label: formatDashboardDateRangeLabel(startDate, endDate), startDate, endDate };
    }
    case 'last7Days':
    default: {
      const startDate = startOfDay(new Date(now.getTime() - (6 * dayMs)));
      return { key: 'last7Days', label: formatDashboardDateRangeLabel(startDate, endOfDay(now)), startDate, endDate: endOfDay(now) };
    }
  }
}

export function getDashboardRangeLabel(range: DashboardDateRange): string {
  return range.label;
}
