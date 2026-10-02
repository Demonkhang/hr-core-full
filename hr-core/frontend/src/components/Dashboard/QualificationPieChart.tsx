import { Card } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { QualificationDistribution } from '@/types/dashboard';

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
const LEVEL_LABELS: Record<string, string> = {
  'Tiến sĩ': 'Tiến sĩ',
  'Thạc sĩ': 'Thạc sĩ',
  'Đại học': 'Đại học',
  'Cao đẳng': 'Cao đẳng',
  'Trung cấp': 'Trung cấp',
  'Khác': 'Khác',
};

interface Props {
  data: QualificationDistribution[];
}

export function QualificationPieChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    displayName: LEVEL_LABELS[d.level] || d.level,
  }));

  return (
    <Card title="Trình độ chuyên môn cao nhất" style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="displayName"
            cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
