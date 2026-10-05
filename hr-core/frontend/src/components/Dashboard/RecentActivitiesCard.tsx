import { useState } from 'react';
import { Card, Timeline, Tag, Typography, Empty, Button, Space, Select } from 'antd';
import { AuditOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import type { RecentActivity } from '@/types/dashboard';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  'employee.create': { label: 'Thêm nhân sự', color: 'green' },
  'employee.update': { label: 'Sửa nhân sự', color: 'blue' },
  'employee.deactivate': { label: 'Ngưng nhân sự', color: 'orange' },
  'employee.hard_delete': { label: 'Xóa vĩnh viễn nhân sự', color: 'red' },
  'employee.restore': { label: 'Khôi phục nhân sự', color: 'cyan' },
  'employee.create_account': { label: 'Cấp tài khoản', color: 'purple' },
  'employee.reset_password': { label: 'Reset mật khẩu', color: 'gold' },
  'job_position.create': { label: 'Thêm vị trí công việc', color: 'geekblue' },
};

interface Props {
  data: RecentActivity[];
  onActionFilterChange?: (action: string) => void;
}

export function RecentActivitiesCard({ data, onActionFilterChange }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('all');

  const handleFilterChange = (val: string) => {
    setFilter(val);
    if (onActionFilterChange) onActionFilterChange(val);
  };

  const displayData = data.filter((item) => {
    if (filter === 'employee') return item.action.startsWith('employee.');
    if (filter === 'account') return item.action.includes('account') || item.action.includes('password');
    if (filter === 'job_position') return item.action.startsWith('job_position.');
    return true;
  });

  return (
    <Card
      title={
        <Space size={8}>
          <AuditOutlined style={{ color: '#3b82f6' }} />
          <span>Hoạt động hệ thống gần đây</span>
        </Space>
      }
      extra={
        <Space size={8}>
          <Select
            size="small"
            value={filter}
            onChange={handleFilterChange}
            options={[
              { label: 'Tất cả loại', value: 'all' },
              { label: 'Nhân sự', value: 'employee' },
              { label: 'Tài khoản', value: 'account' },
              { label: 'Vị trí công việc', value: 'job_position' },
            ]}
            style={{ width: 135 }}
          />
          <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate('/audit-logs')}>
            Xem tất cả
          </Button>
        </Space>
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {displayData.length === 0 ? (
        <Empty description="Chưa có nhật ký hoạt động nào" style={{ margin: '30px 0' }} />
      ) : (
        <Timeline
          items={displayData.map((item) => {
            const act = ACTION_MAP[item.action] || { label: item.action, color: 'default' };
            const timeAgo = item.created_at ? dayjs(item.created_at).fromNow() : '';

            return {
              color: item.success ? 'green' : 'red',
              dot: item.success ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <CloseCircleOutlined style={{ color: '#ef4444' }} />,
              children: (
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={6}>
                      <Tag color={act.color} style={{ margin: 0 }}>
                        {act.label}
                      </Tag>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {item.user_name}
                      </Typography.Text>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {timeAgo}
                    </Typography.Text>
                  </div>
                </div>
              ),
            };
          })}
        />
      )}
    </Card>
  );
}
