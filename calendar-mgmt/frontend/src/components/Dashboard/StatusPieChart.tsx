import { Card } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { SCHEDULE_STATUS_LABELS } from '@/utils/constants';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending: '#f59e0b',
  approved: '#10b981',
  confirmed: '#6366f1',
  rejected: '#ef4444',
  cancelled: '#64748b',
};

interface Props {
  data: Record<string, number>;
}

function renderLabel({ name, percent }: PieLabelRenderProps) {
  const pct = percent ?? 0;
  return `${name ?? ''} ${(pct * 100).toFixed(0)}%`;
}

export function StatusPieChart({ data }: Props) {
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: SCHEDULE_STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#d9d9d9',
    }));

  return (
    <Card title="Lịch trực theo trạng thái" style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name"
            cx="50%" cy="50%" outerRadius={100} innerRadius={55}
            label={renderLabel}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
