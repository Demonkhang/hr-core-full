import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, message, Typography } from 'antd';
import dayjs from 'dayjs';
import { leaveRegistrationService } from '@/services/leaveRegistrationService';
import type { LeaveRegistration } from '@/types/leave';
import { useAuthStore } from '@/store/authStore';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã huỷ',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#64748b',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Nghỉ phép năm',
  sick: 'Nghỉ ốm',
  personal_unpaid: 'Nghỉ không lương',
  personal_paid: 'Việc riêng có lương',
  maternity: 'Nghỉ thai sản',
};

const SESSION_LABELS: Record<string, string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  full: 'Cả ngày',
};

export function LeaveHistory() {
  const [registrations, setRegistrations] = useState<LeaveRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        date_to: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      };
      const canManage = user?.is_super_admin || user?.permissions?.can_manage_leave;
      if (!canManage && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const data = await leaveRegistrationService.getAll(params);
      setRegistrations(data);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = useMemo(() => [
    { title: 'Nhân viên', dataIndex: 'employee_name', key: 'employee_name', width: 180,
      render: (v: string | null) => v || '-',
    },
    { title: 'Loại phép', dataIndex: 'leave_type', key: 'leave_type', width: 150,
      filters: Object.entries(LEAVE_TYPE_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: LeaveRegistration) => record.leave_type === value,
      render: (v: string) => LEAVE_TYPE_LABELS[v] || v,
    },
    { title: 'Từ ngày', dataIndex: 'start_date', key: 'start_date', width: 170,
      render: (v: string, record: LeaveRegistration) =>
        `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[record.start_session] || record.start_session})`,
    },
    { title: 'Đến ngày', dataIndex: 'end_date', key: 'end_date', width: 170,
      render: (v: string, record: LeaveRegistration) =>
        `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[record.end_session] || record.end_session})`,
    },
    { title: 'Số ngày', dataIndex: 'total_days', key: 'total_days', width: 90,
      render: (v: number) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: 'Lý do', dataIndex: 'reason', key: 'reason', width: 220, ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: LeaveRegistration) => record.status === value,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
  ], []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Lịch sử nghỉ phép</Typography.Title>
      <Table dataSource={registrations} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </div>
  );
}
