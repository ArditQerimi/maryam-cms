'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button, Select, cn, inputClass } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Shared search + status-filter bar for the admin list pages.
 * Submits a GET navigation so `?q=` / `?status=` stay in the URL (and the
 * page number resets to 1 on every filter change).
 */
export default function ListFilters({
  basePath,
  initialQuery,
  initialStatus,
  statuses,
}: {
  basePath: string;
  initialQuery: string;
  initialStatus: string;
  statuses: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setStatus(initialStatus), [initialStatus]);

  function go(nextQuery: string, nextStatus: string) {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set('q', trimmed);
    if (nextStatus && nextStatus !== 'All') params.set('status', nextStatus);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <form
      method="get"
      action={basePath}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        go(query, status);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('cmsshared.list_filters.search_placeholder')}
          aria-label={t('cmsshared.list_filters.search_aria')}
          className={cn(inputClass, 'w-56 pl-9')}
        />
      </div>
      <Select
        aria-label={t('cmsshared.list_filters.status_aria')}
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          go(query, event.target.value);
        }}
        className="w-44"
      >
        {statuses.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="outline" size="sm">
        {t('cmsshared.list_filters.search')}
      </Button>
    </form>
  );
}
