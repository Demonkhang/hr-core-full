import { Row, Card, Typography } from 'antd';
import { SafeCol } from '@/components/Common/SafeCol';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  WarningOutlined,
  FieldTimeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
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
  {
    key: 'today_approved',
    label: 'Trực hôm nay',
    icon: ScheduleOutlined,
    bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    iconBg: '#60a5fa',
  },
  {
    key: 'pending_schedules',
    label: 'Chờ duyệt lịch',
    icon: WarningOutlined,
    bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    iconBg: '#f59e0b',
  },
  {
    key: 'month_total_hours',
    label: 'Tổng giờ tháng này',
    icon: FieldTimeOutlined,
    bg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
    iconBg: '#6366f1',
  },
  {
    key: 'month_ot_hours',
    label: 'OT tháng này',
    icon: ClockCircleOutlined,
    bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    iconBg: '#ec4899',
  },
];

function getValue(stats: DashboardStats, key: string): number | string {
  switch (key) {
    case 'total_employees': return stats.total_employees;
    case 'active_employees': return stats.active_employees;
    case 'today_approved': return stats.today_schedules?.approved ?? 0;
    case 'pending_schedules': return `L:${stats.pending_approvals?.schedules ?? 0} OT:${stats.pending_approvals?.overtime ?? 0}`;
    case 'month_total_hours': return (stats.month_summary?.total_hours ?? 0).toFixed(0);
    case 'month_ot_hours': return (stats.month_summary?.overtime_hours ?? 0).toFixed(0);
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
          <SafeCol xs={24} sm={12} lg={4} key={c.key}>
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
          </SafeCol>
        );
      })}
    </Row>
  );
}
