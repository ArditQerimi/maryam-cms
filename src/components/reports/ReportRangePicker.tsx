'use client';

import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { Button, cn } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';
import { REPORT_PRESETS, type ReportPreset } from './report-range';

const PRESET_LABEL_KEYS: Record<ReportPreset, keyof Dictionary> = {
  '7d': 'cmsshared.reports.preset_7d',
  '30d': 'cmsshared.reports.preset_30d',
  month: 'cmsshared.reports.preset_month',
  custom: 'cmsshared.reports.preset_custom',
};

type ReportRangePickerProps = {
  /** Route the picker links back to, e.g. `/cms/reports/sales`. */
  basePath: string;
  preset: ReportPreset;
  fromInput: string;
  toInput: string;
};

/**
 * Preset chips (last 7 days / last 30 days / this month) plus a custom
 * from–to form. Every state is a plain query string so reports stay linkable.
 */
export default function ReportRangePicker({
  basePath,
  preset,
  fromInput,
  toInput,
}: ReportRangePickerProps) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <CalendarRange size={14} /> {t('cmsshared.reports.period')}
        </span>
        {REPORT_PRESETS.filter((entry) => entry.id !== 'custom').map((entry) => (
          <Link
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              preset === entry.id
                ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
            )}
            href={`${basePath}?preset=${entry.id}`}
            key={entry.id}
          >
            {t(PRESET_LABEL_KEYS[entry.id])}
          </Link>
        ))}
      </div>

      <form
        action={basePath}
        className="flex flex-wrap items-end gap-2"
        key={`${fromInput}|${toInput}`}
        method="get"
      >
        <input name="preset" type="hidden" value="custom" />
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          {t('cmsshared.reports.from')}
          <input
            className="h-8 rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900 outline-none transition focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20"
            defaultValue={fromInput}
            name="from"
            required
            type="date"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          {t('cmsshared.reports.to')}
          <input
            className="h-8 rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900 outline-none transition focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20"
            defaultValue={toInput}
            name="to"
            required
            type="date"
          />
        </label>
        <Button className="h-8" size="sm" type="submit" variant={preset === 'custom' ? 'primary' : 'outline'}>
          {t('cmsshared.reports.apply')}
        </Button>
      </form>
    </div>
  );
}
