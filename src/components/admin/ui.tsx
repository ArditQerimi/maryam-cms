import * as React from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[#6d6be8] text-white hover:bg-[#5b59d6] border-transparent',
  secondary: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-transparent',
  ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
  outline: 'bg-white text-zinc-700 hover:bg-zinc-50 border-zinc-300',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-200 bg-white shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-b border-zinc-100 px-5 py-4', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-zinc-900', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  brand: 'bg-[#6d6be8]/10 text-[#4f4dd6] ring-[#6d6be8]/30',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Shared status → tone mapping so every module renders statuses identically. */
export function statusTone(status: string | null | undefined): BadgeTone {
  const value = (status || '').toLowerCase();
  if (['active', 'completed', 'delivered', 'paid', 'published', 'enabled', 'in stock', 'accepted'].includes(value)) return 'success';
  if (['processing', 'shipped', 'in progress', 'active session'].includes(value)) return 'info';
  if (['pending', 'draft', 'on hold', 'low stock', 'partial'].includes(value)) return 'warning';
  if (['cancelled', 'canceled', 'failed', 'refunded', 'disabled', 'inactive', 'out of stock', 'rejected', 'suspended'].includes(value)) return 'danger';
  if (['archived', 'returned'].includes(value)) return 'neutral';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status || 'Unknown';
  return <Badge tone={statusTone(status)}>{label}</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#6d6be8] focus:ring-2 focus:ring-[#6d6be8]/20 disabled:bg-zinc-50 disabled:text-zinc-500';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'appearance-none pr-8', className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-zinc-700', className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-zinc-400">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Table({
  className,
  bare,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { bare?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-x-auto',
        !bare && 'rounded-xl border border-zinc-200 bg-white shadow-sm',
      )}
    >
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-zinc-100 px-4 py-3 align-middle text-zinc-700', className)} {...props} />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-zinc-200', className)} />;
}
