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
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string) => (
        <span>
          <span style={{ fontWeight: 600 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '-'}</span>{' '}
          <Tag
            style={{
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 4px',
              borderRadius: 4,
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #ffedd5',
              fontWeight: 600,
            }}
          >
            OT
          </Tag>
        </span>
      ),
    },
    {
      title: 'Nhân viên',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 180,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 140,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Giờ bắt đầu',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      render: (v: string | null) => (
        v ? (
          <Tag style={{ borderRadius: 6, fontWeight: 600, background: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' }}>
            {v.substring(0, 5)}
          </Tag>
        ) : '-'
      ),
    },
    {
      title: 'Giờ kết thúc',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 120,
      render: (v: string | null) => (
        v ? (
          <Tag style={{ borderRadius: 6, fontWeight: 600, background: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' }}>
            {v.substring(0, 5)}
          </Tag>
        ) : '-'
      ),
    },
    {
      title: 'Số giờ',
      dataIndex: 'total_hours',
      key: 'total_hours',
      width: 100,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.total_hours || 0) - (b.total_hours || 0),
      render: (v: number | null) => (
        v != null ? (
          <Tag
            style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
              padding: '1px 8px',
            }}
          >
            {v}h OT
          </Tag>
        ) : '-'
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: OvertimeRegistration) => record.status === value,
      render: (v: string) => <Tag color={STATUS_COLORS[v]} style={{ fontWeight: 600 }}>{STATUS_LABELS[v] || v}</Tag>,
    },
  ], []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Lịch sử thêm giờ</Typography.Title>
      <Table dataSource={registrations} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </div>
  );
}
