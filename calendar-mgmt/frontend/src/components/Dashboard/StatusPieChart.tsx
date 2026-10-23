import { Card, Empty } from 'antd';
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
  data?: Record<string, number>;
}

function renderLabel({ name, percent }: PieLabelRenderProps) {
  const pct = percent ?? 0;
  return `${name ?? ''} ${(pct * 100).toFixed(0)}%`;
}

export function StatusPieChart({ data = {} }: Props) {
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: SCHEDULE_STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#d9d9d9',
    }));

  const hasData = chartData.length > 0;

  return (
    <Card
      title="Lịch trực theo trạng thái"
      style={{ borderRadius: 16, height: '100%', minHeight: 380 }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px 24px' } }}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={55}
              label={renderLabel}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => [`${value} ca`, name]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="Không có lịch trực nào trong tháng này" />
        </div>
      )}
    </Card>
  );
}
