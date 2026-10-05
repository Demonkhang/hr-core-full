import { useState } from 'react';
import { Card, Select, Space, Empty } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { QualificationDistribution } from '@/types/dashboard';

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

interface Props {
  data: QualificationDistribution[];
  onSourceChange?: (source: string) => void;
}

export function QualificationPieChart({ data, onSourceChange }: Props) {
  const [source, setSource] = useState<string>('auto');

  const handleSourceChange = (val: string) => {
    setSource(val);
    if (onSourceChange) onSourceChange(val);
  };

  const chartData = data.map((d) => ({
    ...d,
    displayName: d.level,
  }));

  return (
    <Card
      title="Phân bổ Trình độ chuyên môn"
      extra={
        <Select
          size="small"
          value={source}
          onChange={handleSourceChange}
          options={[
            { label: 'Tự động tổng hợp', value: 'auto' },
            { label: 'Bằng cấp nhân sự', value: 'employee' },
            { label: 'Yêu cầu theo Vị trí', value: 'job_position' },
          ]}
          style={{ width: 165 }}
        />
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {chartData.length === 0 ? (
        <Empty description="Không có dữ liệu trình độ" style={{ margin: '40px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="displayName"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => [`${value}`, 'Số lượng']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
