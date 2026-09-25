'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type ProductBarPoint = {
  name: string;
  quantity: number;
  revenue: number;
};

/** Horizontal bars keep long product names readable. */
export default function TopProductsBarChart({ data }: { data: ProductBarPoint[] }) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500">
        No product sales in this period.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="#f1f5f9" strokeDasharray="3 3" />
          <XAxis
            allowDecimals={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            type="number"
          />
          <YAxis
            dataKey="name"
            interval={0}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            type="category"
            width={180}
          />
          <Tooltip
            cursor={{ fill: 'rgba(109, 107, 232, 0.06)' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => {
              if (name === 'revenue') {
                return [`€${Number(value ?? 0).toFixed(2)}`, 'Revenue'] as [string, string];
              }
              return [String(value ?? 0), 'Units sold'] as [string, string];
            }}
          />
          <Bar
            dataKey="quantity"
            fill="#6d6be8"
            maxBarSize={26}
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
