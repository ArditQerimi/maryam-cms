'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getContextDb } from '@/lib/tenant';
import { settingsStore } from '@/db/schema-tenant';
import { requireCmsSession } from '@/lib/cms/session';
import { REPORT_PRESETS, REPORT_SALES_RANGE_KEY } from '@/app/cms/reports/report-range';

export type ReportRangeActionResult = {
  ok: boolean;
  error?: string;
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Remember the reporter's chosen date range (`report_sales_range` in
 * `settings_store`) so /cms/reports/sales opens with the last used preset when
 * it is loaded without query params.
 */
export async function saveReportRange(input: {
  preset: string;
  from?: string;
  to?: string;
}): Promise<ReportRangeActionResult> {
  await requireCmsSession();

  const preset = REPORT_PRESETS.includes(input.preset as (typeof REPORT_PRESETS)[number])
    ? input.preset
    : '30d';
  const day = (value: string | undefined) =>
    typeof value === 'string' && DAY_PATTERN.test(value) ? value : '';

  const payload = JSON.stringify({ preset, from: day(input.from), to: day(input.to) });

  const db = await getContextDb();
  await db
    .insert(settingsStore)
    .values({ key: REPORT_SALES_RANGE_KEY, value: payload, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsStore.key,
      set: { value: payload, updatedAt: new Date() },
    });

  revalidatePath('/cms/reports/sales');
  return { ok: true };
}

/**
 * Form action behind the shared "Refresh" button in `ReportToolbar` — pulls the
 * freshest numbers for every report page in one go.
 */
export async function refreshReports(): Promise<void> {
  await requireCmsSession();
  revalidatePath('/cms/reports', 'layout');
}
