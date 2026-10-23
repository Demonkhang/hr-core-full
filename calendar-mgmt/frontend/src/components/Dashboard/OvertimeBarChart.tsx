import { Card, Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { OvertimeByDepartment } from '@/types/dashboard';

interface Props {
  data?: OvertimeByDepartment[];
}

export function OvertimeBarChart({ data = [] }: Props) {
  const hasData = data && data.length > 0;

  return (
    <Card
      title="Tăng ca theo phòng ban"
      style={{ borderRadius: 16, height: '100%', minHeight: 380 }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' }, body: { padding: '20px 24px' } }}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="department_name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="h" />
            <Tooltip
              formatter={(value: any) => [`${value} giờ`, 'Giờ OT']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="total_ot_hours" name="Giờ OT" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="Không có dữ liệu tăng ca trong tháng này" />
        </div>
      )}
    </Card>
  );
}
