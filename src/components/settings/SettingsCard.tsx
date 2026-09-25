import { Card, CardContent, CardHeader, CardTitle, cn } from '@/components/admin/ui';

/**
 * Shared chrome for every /cms/settings page: a titled Card with an optional
 * description and an optional footer row (save buttons, meta, …).
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3.5">{footer}</div>
      ) : null}
    </Card>
  );
}

export function SettingsSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-t border-zinc-100 pt-5 first:border-t-0 first:pt-0', className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h4>
      {hint ? <p className="mt-0.5 text-xs text-zinc-400">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
