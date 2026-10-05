import { useState } from 'react';
import { Card, Progress, Tag, Space, Typography, Empty, Button, Select } from 'antd';
import { SolutionOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { JobPositionCapacity } from '@/types/dashboard';

interface Props {
  data: JobPositionCapacity[];
  onCapacityFilterChange?: (filter: string) => void;
}

export function HeadcountCapacityCard({ data, onCapacityFilterChange }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'available' | 'full'>('all');

  const handleFilterChange = (val: 'all' | 'available' | 'full') => {
    setFilter(val);
    if (onCapacityFilterChange) onCapacityFilterChange(val);
  };

  const displayData = data.filter((jp) => {
    const isFull = jp.current_headcount >= jp.max_headcount;
    if (filter === 'full') return isFull;
    if (filter === 'available') return !isFull;
    return true;
  });

  return (
    <Card
      title={
        <Space size={8}>
          <SolutionOutlined style={{ color: '#7c3aed' }} />
          <span>Quy hoạch Định biên Vị trí việc làm</span>
        </Space>
      }
      extra={
        <Space size={8}>
          <Select
            size="small"
            value={filter}
            onChange={handleFilterChange}
            options={[
              { label: 'Tất cả vị trí', value: 'all' },
              { label: 'Còn chỉ tiêu', value: 'available' },
              { label: 'Đã đủ chỉ tiêu', value: 'full' },
            ]}
            style={{ width: 130 }}
          />
          <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate('/job-positions')}>
            Chi tiết
          </Button>
        </Space>
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {displayData.length === 0 ? (
        <Empty description="Chưa có dữ liệu vị trí việc làm" style={{ margin: '30px 0' }} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {displayData.map((jp) => {
            const percent = jp.max_headcount > 0 ? Math.round((jp.current_headcount / jp.max_headcount) * 100) : 0;
            const isFull = percent >= 100;

            return (
              <div key={jp.id} style={{ borderBottom: '1px dashed rgba(140, 140, 140, 0.12)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <Typography.Text strong style={{ fontSize: 14 }}>
                      {jp.name}
                    </Typography.Text>
                    {jp.department_name && (
                      <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                        ({jp.department_name})
                      </Typography.Text>
                    )}
                  </div>
                  <Space size={6}>
                    <Tag color="purple">Bậc {jp.professional_level}</Tag>
                    {isFull ? <Tag color="red">Đã đủ</Tag> : <Tag color="green">Còn trống {jp.max_headcount - jp.current_headcount}</Tag>}
                  </Space>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Progress
                    percent={percent}
                    status={isFull ? 'exception' : 'active'}
                    strokeColor={isFull ? '#ef4444' : '#7c3aed'}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <span style={{ fontSize: 12, color: '#64748b', minWidth: 65, textAlign: 'right' }}>
                    <b>{jp.current_headcount}</b>/{jp.max_headcount} người
                  </span>
                </div>
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
}
