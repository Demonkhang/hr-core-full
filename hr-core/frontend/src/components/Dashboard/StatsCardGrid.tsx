import { Row, Col, Card, Typography, Tag } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, UserDeleteOutlined,
  ApartmentOutlined, EnvironmentOutlined, SolutionOutlined,
} from '@ant-design/icons';
import type { DashboardStats } from '@/types/dashboard';

const cards = [
  {
    key: 'total_employees',
    label: 'Tổng nhân sự',
    icon: TeamOutlined,
    gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(168, 85, 247, 0.06))',
    borderColor: 'rgba(124, 58, 237, 0.25)',
    iconBg: '#7c3aed',
    badge: 'Quy mô',
  },
  {
    key: 'active_employees',
    label: 'Đang làm việc',
    icon: CheckCircleOutlined,
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(52, 211, 153, 0.06))',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    iconBg: '#10b981',
    badge: 'Chính thức',
  },
  {
    key: 'inactive_employees',
    label: 'Đã nghỉ / Ngừng',
    icon: UserDeleteOutlined,
    gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(251, 113, 133, 0.06))',
    borderColor: 'rgba(244, 63, 94, 0.25)',
    iconBg: '#f43f5e',
    badge: 'Đã ngưng',
  },
  {
    key: 'total_departments',
    label: 'Phòng ban',
    icon: ApartmentOutlined,
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(96, 165, 250, 0.06))',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    iconBg: '#3b82f6',
    badge: 'Bộ máy',
  },
  {
    key: 'total_workplaces',
    label: 'Nơi làm việc',
    icon: EnvironmentOutlined,
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(34, 211, 238, 0.06))',
    borderColor: 'rgba(6, 182, 212, 0.25)',
    iconBg: '#06b6d4',
    badge: 'Cơ sở',
  },
  {
    key: 'total_job_positions',
    label: 'Vị trí việc làm',
    icon: SolutionOutlined,
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.06))',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    iconBg: '#f59e0b',
    badge: 'Chức danh',
  },
];

function getValue(stats: DashboardStats, key: string): number | string {
  switch (key) {
    case 'total_employees': return stats.total_employees;
    case 'active_employees': return stats.active_employees;
    case 'inactive_employees': return stats.inactive_employees;
    case 'total_departments': return stats.total_departments;
    case 'total_workplaces': return stats.total_workplaces;
    case 'total_job_positions': return stats.total_job_positions;
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
          <Col xs={12} sm={8} lg={4} key={c.key}>
            <Card
              hoverable
              style={{
                background: c.gradient,
                border: `1px solid ${c.borderColor}`,
                borderRadius: 14,
                backdropFilter: 'blur(12px)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              styles={{ body: { padding: '16px 16px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: c.iconBg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: '#fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  <Icon />
                </div>
                <Tag color="purple" style={{ margin: 0, fontSize: 10, borderRadius: 6, opacity: 0.85 }}>
                  {c.badge}
                </Tag>
              </div>

              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {c.label}
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: 24, lineHeight: 1.1 }}>
                  {value}
                </Typography.Text>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
