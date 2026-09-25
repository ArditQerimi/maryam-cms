import { RefreshCw } from 'lucide-react';
import { Button, PageHeader } from '@/components/admin/ui';
import { refreshReports } from '@/app/cms/actions/reports';
import ReportRangePicker from './ReportRangePicker';
import type { ReportRange } from './report-range';

/**
 * Shared report chrome: page header + refresh action (+ optional date range).
 * Server-safe so every /cms/reports/* page can render it directly.
 */
export default function ReportToolbar({
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
  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <form action={refreshReports}>
            <Button type="submit" variant="outline">
              <RefreshCw size={14} /> Refresh
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
