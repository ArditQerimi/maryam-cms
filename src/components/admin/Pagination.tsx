'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/components/admin/ui';

/**
 * Query-string pagination shared by every admin list page.
 * `basePath` must be the route without a query string, e.g. `/cms/products`.
 */
export default function Pagination({
  basePath,
  page,
  totalPages,
  total,
  searchParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  total?: number;
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) {
    return total === undefined ? null : (
      <p className="mt-3 text-xs text-zinc-400">
        {total} {total === 1 ? 'result' : 'results'}
      </p>
    );
  }

  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams || {})) {
      if (value) params.set(key, value);
    }
    params.set('page', String(target));
    return `${basePath}?${params.toString()}`;
  }

  const windowed = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (value) => value === 1 || value === totalPages || Math.abs(value - page) <= 2,
  );

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {total === undefined ? null : (
        <p className="text-xs text-zinc-400">
          {total} {total === 1 ? 'result' : 'results'}
        </p>
      )}
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50',
            page <= 1 && 'pointer-events-none opacity-40',
          )}
        >
          <ChevronLeft size={15} />
        </Link>
        {windowed.map((value, index) => (
          <span key={value} className="flex items-center">
            {index > 0 && value - windowed[index - 1] > 1 && (
              <span className="px-1 text-xs text-zinc-400">…</span>
            )}
            <Link
              href={href(value)}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition',
                value === page
                  ? 'border-[#6d6be8] bg-[#6d6be8] text-white'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {value}
            </Link>
          </span>
        ))}
        <Link
          href={href(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50',
            page >= totalPages && 'pointer-events-none opacity-40',
          )}
        >
          <ChevronRight size={15} />
        </Link>
      </nav>
    </div>
  );
}
