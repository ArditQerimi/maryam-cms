import { RefreshCw } from 'lucide-react';
import { Button, PageHeader } from '@/components/admin/ui';
import { refreshReports } from '@/app/cms/actions/reports';
import { getT } from '@/lib/i18n/server';
import ReportRangePicker from './ReportRangePicker';
import type { ReportRange } from './report-range';

/**
 * Shared report chrome: page header + refresh action (+ optional date range).
 * Server-safe so every /cms/reports/* page can render it directly.
 */
export default async function ReportToolbar({
  title,
  description,
  basePath,
  range,
}: {
  title: string;
  description: string;
  basePath: string;
  range?: ReportRange;
}) {
  const t = await getT();
  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <form action={refreshReports}>
            <Button type="submit" variant="outline">
              <RefreshCw size={14} /> {t('cmsshared.reports.refresh')}
            </Button>
          </form>
        }
        description={description}
        title={title}
      />
      {range ? (
        <ReportRangePicker
          basePath={basePath}
          fromInput={range.fromInput}
          preset={range.preset}
          toInput={range.toInput}
        />
      ) : null}
    </div>
  );
}
