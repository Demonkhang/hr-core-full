import { Card, Avatar, Tag, Typography, Empty, Space, Button } from 'antd';
import { UserOutlined, CalendarOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { RecentHire } from '@/types/dashboard';

interface Props {
  data: RecentHire[];
}

export function RecentHiresCard({ data }: Props) {
  const navigate = useNavigate();

  return (
    <Card
      title={
        <Space size={8}>
          <UserOutlined style={{ color: '#10b981' }} />
          <span>Nhân sự gia nhập mới</span>
        </Space>
      }
      extra={
        <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate('/employees')}>
          Danh sách
        </Button>
      }
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' } }}
    >
      {data.length === 0 ? (
        <Empty description="Chưa có nhân sự mới gia nhập" style={{ margin: '30px 0' }} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {data.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/employees/${emp.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(140, 140, 140, 0.05)',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar style={{ backgroundColor: '#10b981', verticalAlign: 'middle' }}>
                  {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : 'N'}
                </Avatar>
                <div>
                  <Typography.Text strong style={{ fontSize: 13, display: 'block' }}>
                    {emp.full_name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {emp.department_name || 'Chưa phân phòng'} {emp.position_name ? `• ${emp.position_name}` : ''}
                  </Typography.Text>
                </div>
              </div>

              <Space direction="vertical" align="end" size={2}>
                {emp.employee_code && <Tag color="blue" style={{ margin: 0 }}>{emp.employee_code}</Tag>}
                {emp.hire_date && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    {dayjs(emp.hire_date).format('DD/MM/YYYY')}
                  </span>
                )}
              </Space>
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}
