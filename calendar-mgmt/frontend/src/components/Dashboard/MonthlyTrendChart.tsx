import { Card } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonthlyTrend } from '@/types/dashboard';

interface Props {
  data: MonthlyTrend[];
}

export function MonthlyTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: d.month.slice(0, 7),
    'Tổng giờ': d.total_hours,
    'Giờ OT': d.overtime_hours,
  }));

  return (
    <Card title="Xu hướng giờ làm 12 tháng" style={{ borderRadius: 16 }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="Tổng giờ" stroke="#6366f1" strokeWidth={2}
            dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Giờ OT" stroke="#ec4899" strokeWidth={2}
            dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
