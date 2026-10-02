import { Card } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DepartmentDistribution } from '@/types/dashboard';

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];

interface Props {
  data: DepartmentDistribution[];
}

export function DepartmentPieChart({ data }: Props) {
  return (
    <Card title="Nhân viên theo phòng ban" style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="employee_count" nameKey="department_name"
            cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
            {data.map((_, i) => (
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
