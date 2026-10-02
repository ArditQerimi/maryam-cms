'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button, Select, cn, inputClass } from '@/components/admin/ui';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Search + category + status filter bar for /cms/products.
 * Submits as a GET navigation so `?q=` / `?category=` / `?status=` stay in the
 * URL and the page number resets to 1 whenever a filter changes.
 */
export default function ProductFilters({
  basePath,
  initialQuery,
  initialCategory,
  initialStatus,
  categories,
  statuses,
}: {
  basePath: string;
  initialQuery: string;
  initialCategory: string;
  initialStatus: string;
  categories: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setCategory(initialCategory), [initialCategory]);
  useEffect(() => setStatus(initialStatus), [initialStatus]);

  function apply(nextQuery: string, nextCategory: string, nextStatus: string) {
    const params = new URLSearchParams();
    const trimmed = nextQuery.trim();
    if (trimmed) params.set('q', trimmed);
    if (nextCategory) params.set('category', nextCategory);
    if (nextStatus) params.set('status', nextStatus);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <form
      method="get"
      action={basePath}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        apply(query, category, status);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('cmsshared.product_filters.search_placeholder')}
          aria-label={t('cmsshared.product_filters.search_aria')}
          className={cn(inputClass, 'w-60 pl-9')}
        />
      </div>
      <Select
        aria-label={t('cmsshared.product_filters.category_aria')}
        value={category}
        onChange={(event) => {
          setCategory(event.target.value);
          apply(query, event.target.value, status);
        }}
        className="w-44"
      >
        <option value="">{t('cmsshared.product_filters.all_categories')}</option>
        {categories.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t('cmsshared.product_filters.status_aria')}
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          apply(query, category, event.target.value);
        }}
        className="w-40"
      >
        <option value="">{t('cmsshared.product_filters.all_statuses')}</option>
        {statuses.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="outline" size="sm">
        {t('cmsshared.product_filters.search')}
      </Button>
    </form>
  );
}
