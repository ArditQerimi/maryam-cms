import { Badge, statusTone } from '@/components/admin/ui';

/** Human labels for the shared `status` enum used by pages and posts. */
const STATUS_LABELS: Record<string, string> = {
  Active: 'Published',
  Pending: 'Draft',
  Archived: 'Archived',
  Inactive: 'Inactive',
  Suspended: 'Suspended',
};

export type DbStatus = 'Active' | 'Inactive' | 'Archived' | 'Pending' | 'Suspended';

export type StatusFilterValue = 'All' | 'Published' | 'Draft' | 'Archived';

export const STATUS_FILTERS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'All', label: 'All statuses' },
  { value: 'Published', label: 'Published' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Archived', label: 'Archived' },
];

const FILTER_TO_DB: Record<Exclude<StatusFilterValue, 'All'>, DbStatus> = {
  Published: 'Active',
  Draft: 'Pending',
  Archived: 'Archived',
};

/** `?status=` filter value → stored enum value (null when no filter applies). */
export function dbStatusForFilter(value: string): DbStatus | null {
  if (!value || value === 'All') return null;
  if (value === 'Published' || value === 'Draft' || value === 'Archived') {
    return FILTER_TO_DB[value];
  }
  return null;
}

/** Stored enum → the label the admin shows (Active → Published, Pending → Draft). */
export function contentStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] || status;
}

export function ContentStatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge tone={statusTone(status)}>{contentStatusLabel(status)}</Badge>;
}
