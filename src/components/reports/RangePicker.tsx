'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { Button, Input } from '@/components/admin/ui';
import { saveReportRange } from '@/app/cms/actions/reports';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

type RangePickerProps = {
  basePath: string;
  current: { preset: string; from: string; to: string };
  label: string;
};

const PRESETS: Array<{ preset: string; labelKey: keyof Dictionary }> = [
  { preset: '7d', labelKey: 'cmsshared.reports.preset_7d' },
  { preset: '30d', labelKey: 'cmsshared.reports.preset_30d' },
  { preset: 'month', labelKey: 'cmsshared.reports.preset_month' },
  { preset: 'custom', labelKey: 'cmsshared.reports.preset_custom' },
];

/** Preset + custom date-range picker; persists the choice via saveReportRange. */
export default function RangePicker({ basePath, current, label }: RangePickerProps) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(current.preset === 'custom');
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const { t } = useLocale();

  const navigate = (preset: string, rangeFrom?: string, rangeTo?: string) => {
    void saveReportRange({ preset, from: rangeFrom, to: rangeTo }).catch(() => undefined);
    const params = new URLSearchParams({ preset });
    if (preset === 'custom' && rangeFrom && rangeTo) {
      params.set('from', rangeFrom);
      params.set('to', rangeTo);
    }
    router.push(`${basePath}?${params.toString()}`);
  };

  const applyCustom = () => {
    if (!from || !to) return;
    if (from > to) {
      navigate('custom', to, from);
      return;
    }
    navigate('custom', from, to);
  };

  const isActive = (preset: string) => current.preset === preset;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <CalendarDays size={14} />
          {t('cmsshared.reports.period')}
        </span>
        {PRESETS.map((entry) => (
          <Button
            key={entry.preset}
            onClick={() => {
              if (entry.preset === 'custom') {
                setCustomOpen((open) => !open);
                return;
              }
              setCustomOpen(false);
              navigate(entry.preset);
            }}
            size="sm"
            variant={isActive(entry.preset) ? 'primary' : 'outline'}
          >
            {t(entry.labelKey)}
          </Button>
        ))}
        <span className="ml-auto rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
          {label}
        </span>
      </div>

      {customOpen ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600" htmlFor="report-from">
              {t('cmsshared.reports.from')}
            </label>
            <Input
              className="h-9 w-40 py-1.5 text-sm"
              id="report-from"
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600" htmlFor="report-to">
              {t('cmsshared.reports.to')}
            </label>
            <Input
              className="h-9 w-40 py-1.5 text-sm"
              id="report-to"
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </div>
          <Button disabled={!from || !to} onClick={applyCustom} size="sm">
            {t('cmsshared.reports.apply_range')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
