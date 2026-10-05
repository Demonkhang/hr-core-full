import { useState } from 'react';
import { Card, Select, Space, Empty } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import type { DepartmentDistribution } from '@/types/dashboard';

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];

interface Props {
  data: DepartmentDistribution[];
  onFilterChange?: (includeEmpty: boolean) => void;
}

export function DepartmentPieChart({ data, onFilterChange }: Props) {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [hideEmpty, setHideEmpty] = useState(false);

  const displayData = hideEmpty ? data.filter((d) => d.employee_count > 0) : data;

  return (
    <Card
      title="Nhân viên theo phòng ban"
      extra={
        <Space size={8}>
          <Select
            size="small"
            value={hideEmpty ? 'non_empty' : 'all'}
            onChange={(v) => {
              const val = v === 'non_empty';
              setHideEmpty(val);
              if (onFilterChange) onFilterChange(!val);
            }}
            options={[
              { label: 'Tất cả phòng ban', value: 'all' },
              { label: 'Có nhân sự (>0)', value: 'non_empty' },
            ]}
            style={{ width: 140 }}
          />
          <Select
            size="small"
            value={chartType}
            onChange={setChartType}
            options={[
              { label: 'Biểu đồ Tròn', value: 'donut' },
              { label: 'Biểu đồ Cột', value: 'bar' },
            ]}
            style={{ width: 110 }}
          />
        </Space>
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {displayData.length === 0 ? (
        <Empty description="Không có dữ liệu phù hợp" style={{ margin: '40px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'donut' ? (
            <PieChart>
              <Pie
                data={displayData}
                dataKey="employee_count"
                nameKey="department_name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
              >
                {displayData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [`${value} nhân viên`, 'Số lượng']} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis dataKey="department_name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value: any) => [`${value} nhân viên`, 'Số lượng']} />
              <Bar dataKey="employee_count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </Card>
  );
}
