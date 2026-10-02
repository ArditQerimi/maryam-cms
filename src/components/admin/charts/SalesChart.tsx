'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export type SalesPoint = {
  day: string;
  orders: number;
  revenue: number;
};

export default function SalesChart({ data }: { data: SalesPoint[] }) {
  const { t } = useLocale();

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500">{t('cmscommon.chart.noSales')}</p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6d6be8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6d6be8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: '#cbd5e1' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => {
              const isRevenue = name === 'revenue';
              const display = isRevenue
                ? `€${Number(value ?? 0).toFixed(2)}`
                : String(value ?? 0);
              return [
                display,
                isRevenue ? t('cmscommon.chart.revenue') : t('cmscommon.chart.orders'),
              ] as [string, string];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6d6be8"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
