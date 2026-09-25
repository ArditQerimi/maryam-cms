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

export type ProductDatum = {
  name: string;
  quantity: number;
};

function truncateLabel(value: string): string {
  return value.length > 24 ? `${value.slice(0, 23)}…` : value;
}

/** Horizontal bar chart of units sold per product (top N). */
export default function ProductBarChart({ data }: { data: ProductDatum[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-zinc-500">No product sales in this period.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#f1f5f9" strokeDasharray="3 3" />
          <XAxis
            allowDecimals={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={truncateLabel}
            tickLine={false}
            type="category"
            width={170}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
            formatter={(value) => [String(value ?? 0), 'Units sold'] as [string, string]}
            labelFormatter={(label) => String(label)}
          />
          <Bar barSize={16} dataKey="quantity" fill="#6d6be8" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
