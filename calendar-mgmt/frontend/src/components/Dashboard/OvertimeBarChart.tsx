import { Card } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { OvertimeByDepartment } from '@/types/dashboard';

interface Props {
  data: OvertimeByDepartment[];
}

export function OvertimeBarChart({ data }: Props) {
  return (
    <Card title="Tăng ca theo phòng ban" style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="department_name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Bar dataKey="total_ot_hours" name="Giờ OT" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
