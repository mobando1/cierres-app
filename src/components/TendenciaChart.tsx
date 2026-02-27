'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

interface Props {
  data: Array<{ fecha: string; diferencia: number }>;
}

export default function TendenciaChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.fecha.slice(5), // MM-DD
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.abs(v / 1000)}k`} />
          <Tooltip
            formatter={(value: number | undefined) => [`$${Math.abs(value ?? 0).toLocaleString('es-CO')}`, 'Diferencia']}
            labelFormatter={(label) => `Fecha: ${label}`}
          />
          <ReferenceLine y={0} stroke="#ccc" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="diferencia"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
