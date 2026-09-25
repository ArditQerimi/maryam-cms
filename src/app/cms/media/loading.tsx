import { PageHeader, Skeleton } from '@/components/admin/ui';

export default function MediaLoading() {
  return (
    <div>
      <PageHeader title="Media library" description="Loading files…" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-56" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-zinc-200">
            <Skeleton className="aspect-square rounded-none" />
            <Skeleton className="m-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
