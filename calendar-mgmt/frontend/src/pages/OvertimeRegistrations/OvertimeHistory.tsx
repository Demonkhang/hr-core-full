import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, message, Typography } from 'antd';
import dayjs from 'dayjs';
import { overtimeRegistrationService } from '@/services/overtimeRegistrationService';
import type { OvertimeRegistration } from '@/types/overtimeRegistration';
import { useAuthStore } from '@/store/authStore';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

export function OvertimeHistory() {
  const [registrations, setRegistrations] = useState<OvertimeRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        date_to: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      };
      const canManage = user?.is_super_admin || user?.permissions?.can_manage_overtime;
      if (!canManage && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const data = await overtimeRegistrationService.list(params);
      setRegistrations(data);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = useMemo(() => [
    { title: 'Ngày', dataIndex: 'date', key: 'date', width: 130,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    { title: 'Nhân viên', dataIndex: 'employee_name', key: 'employee_name', width: 180,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      render: (v: string | null) => v || '-',
    },
    { title: 'Phòng ban', dataIndex: 'department_name', key: 'department_name', width: 140,
      render: (v: string | null) => v || '-',
    },
    { title: 'Giờ bắt đầu', dataIndex: 'start_time', key: 'start_time', width: 120,
      render: (v: string | null) => v ? v.substring(0, 5) : '-',
    },
    { title: 'Giờ kết thúc', dataIndex: 'end_time', key: 'end_time', width: 120,
      render: (v: string | null) => v ? v.substring(0, 5) : '-',
    },
    { title: 'Số giờ', dataIndex: 'total_hours', key: 'total_hours', width: 80,
      render: (v: number | null) => v ?? '-',
    },
    { title: 'Lý do', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 100,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: OvertimeRegistration) => record.status === value,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
  ], []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Lịch sử thêm giờ</Typography.Title>
      <Table dataSource={registrations} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </div>
  );
}
