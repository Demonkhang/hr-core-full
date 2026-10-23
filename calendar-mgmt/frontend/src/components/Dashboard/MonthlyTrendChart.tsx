import { Card, Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonthlyTrend } from '@/types/dashboard';

interface Props {
  data?: MonthlyTrend[];
}

export function MonthlyTrendChart({ data = [] }: Props) {
  const hasData = data && data.length > 0;

  const chartData = (data || []).map((d) => ({
    month: d.month.slice(0, 7),
    'Tổng giờ': d.total_hours,
    'Giờ OT': d.overtime_hours,
    'Số ca': d.total_shifts,
  }));

  return (
    <Card
      title="Xu hướng giờ làm 12 tháng"
      style={{ borderRadius: 16 }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px 24px' } }}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="h" />
            <Tooltip
              formatter={(value: any, name: any) => [
                name === 'Số ca' ? `${value} ca` : `${value} giờ`,
                name,
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
            <Line
              type="monotone"
              dataKey="Tổng giờ"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Giờ OT"
              stroke="#ec4899"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#ec4899' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="Không có dữ liệu xu hướng" />
        </div>
      )}
    </Card>
  );
}
