import { useState } from 'react';
import { Card, Progress, Space, Typography, Empty, Select } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import type { WorkplaceDistribution } from '@/types/dashboard';

interface Props {
  data: WorkplaceDistribution[];
}

const COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#7c3aed', '#f59e0b', '#ec4899'];

export function WorkplaceBarChart({ data }: Props) {
  const [filterMode, setFilterMode] = useState<'all' | 'non_zero'>('all');

  const displayData = filterMode === 'non_zero' ? data.filter((w) => w.employee_count > 0) : data;
  const total = displayData.reduce((acc, curr) => acc + curr.employee_count, 0);

  return (
    <Card
      title={
        <Space size={8}>
          <EnvironmentOutlined style={{ color: '#06b6d4' }} />
          <span>Nhân viên theo Nơi làm việc / Chi nhánh</span>
        </Space>
      }
      extra={
        <Select
          size="small"
          value={filterMode}
          onChange={setFilterMode}
          options={[
            { label: 'Tất cả nơi làm việc', value: 'all' },
            { label: 'Có nhân sự (>0)', value: 'non_zero' },
          ]}
          style={{ width: 150 }}
        />
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {displayData.length === 0 ? (
        <Empty description="Chưa có dữ liệu nơi làm việc" style={{ margin: '30px 0' }} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {displayData.map((wp, idx) => {
            const percent = total > 0 ? Math.round((wp.employee_count / total) * 100) : 0;
            const color = COLORS[idx % COLORS.length];

            return (
              <div key={wp.workplace_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {wp.workplace_name}
                  </Typography.Text>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    <b>{wp.employee_count}</b> nhân sự ({percent}%)
                  </span>
                </div>
                <Progress
                  percent={percent}
                  strokeColor={color}
                  showInfo={false}
                  style={{ margin: 0 }}
                />
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
}
