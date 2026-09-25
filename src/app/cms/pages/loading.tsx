import { Card, CardHeader, PageHeader, Skeleton } from '@/components/admin/ui';

export default function PagesLoading() {
  return (
    <div>
      <PageHeader title="Pages" description="Loading pages…" />
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-72" />
        </CardHeader>
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
