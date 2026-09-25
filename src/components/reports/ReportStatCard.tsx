import type { ComponentType } from 'react';
import { Card, CardContent } from '@/components/admin/ui';

export default function ReportStatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ size?: number }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6d6be8]/10 text-[#5b59d6]">
          <Icon size={18} />
        </span>
      </CardContent>
    </Card>
  );
}
