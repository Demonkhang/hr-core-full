import { Row, Col, Card, Typography } from 'antd';
import { TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { DashboardStats } from '@/types/dashboard';

const cards = [
  {
    key: 'total_employees',
    label: 'Tổng nhân viên',
    icon: TeamOutlined,
    bg: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    iconBg: '#a78bfa',
  },
  {
    key: 'active_employees',
    label: 'Đang hoạt động',
    icon: CheckCircleOutlined,
    bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    iconBg: '#34d399',
  },
];

function getValue(stats: DashboardStats, key: string): number | string {
  switch (key) {
    case 'total_employees': return stats.total_employees;
    case 'active_employees': return stats.active_employees;
    default: return 0;
  }
}

interface Props {
  stats: DashboardStats;
}

export function StatsCardGrid({ stats }: Props) {
  return (
    <Row gutter={[16, 16]}>
      {cards.map((c) => {
        const Icon = c.icon;
        const value = getValue(stats, c.key);
        return (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <Card
              style={{ background: c.bg, border: 'none', borderRadius: 16 }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: c.iconBg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  <Icon />
                </div>
                <div>
                  <Typography.Text style={{ color: '#475569', fontSize: 13, display: 'block' }}>
                    {c.label}
                  </Typography.Text>
                  <Typography.Text strong style={{ fontSize: 22, color: '#1e293b', lineHeight: 1.2 }}>
                    {value}
                  </Typography.Text>
                </div>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
