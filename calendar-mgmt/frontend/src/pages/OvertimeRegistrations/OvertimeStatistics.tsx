import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Select,
  Input,
  Button,
  Tag,
  Typography,
  Space,
  Tooltip,
  Modal,
  message,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  overtimeRegistrationService,
  type OvertimeStatisticItem,
} from '@/services/overtimeRegistrationService';
import { departmentService } from '@/services/departmentService';
import type { OvertimeRegistration } from '@/types/overtimeRegistration';
import type { Department } from '@/types/department';
import { useAuthStore } from '@/store/authStore';

const { Option } = Select;

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

export function OvertimeStatistics() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const canApprove = isSuperAdmin || Boolean(user?.permissions?.can_approve_overtime);
  const userScope = user?.permissions?.scope || 'self';
  const isSelfOnly = !isSuperAdmin && !canApprove && userScope === 'self';

  const now = dayjs();
  const [year, setYear] = useState<number>(now.year());
  const [month, setMonth] = useState<number>(now.month() + 1);
  const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState<string>('');
  const [stats, setStats] = useState<OvertimeStatisticItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [detailEmp, setDetailEmp] = useState<OvertimeStatisticItem | null>(null);
  const [detailRegistrations, setDetailRegistrations] = useState<OvertimeRegistration[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const yearOptions = useMemo(() => {
    const cur = dayjs().year();
    return [cur - 2, cur - 1, cur, cur + 1];
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const empIdFilter = isSelfOnly && user?.employee_id ? user.employee_id : undefined;
      const deptFilter =
        !isSuperAdmin && userScope === 'department' && user?.department_id
          ? user.department_id
          : selectedDept;

      const [statList, deptList] = await Promise.all([
        overtimeRegistrationService.getStatistics({
          year,
          month,
          employee_id: empIdFilter,
          department_id: deptFilter,
        }),
        !isSelfOnly ? departmentService.list(true).catch(() => [] as Department[]) : Promise.resolve([] as Department[]),
      ]);

      setStats(statList);
      if (!isSelfOnly) {
        setDepartments(deptList);
      }
    } catch {
      message.error('Không thể tải dữ liệu thống kê làm thêm giờ');
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedDept, isSelfOnly, isSuperAdmin, userScope, user?.employee_id, user?.department_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetailModal = async (record: OvertimeStatisticItem) => {
    setDetailEmp(record);
    setDetailLoading(true);
    try {
      const startOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
      const endOfMonth = startOfMonth.endOf('month');
      const regs = await overtimeRegistrationService.list({
        employee_id: record.employee_id,
        date_from: startOfMonth.format('YYYY-MM-DD'),
        date_to: endOfMonth.format('YYYY-MM-DD'),
      });
      setDetailRegistrations(regs);
    } catch {
      message.error('Không thể tải chi tiết đơn làm thêm giờ');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredStats = useMemo(() => {
    if (!searchText.trim()) return stats;
    const q = searchText.trim().toLowerCase();
    return stats.filter(
      (s) =>
        (s.employee_name || '').toLowerCase().includes(q) ||
        (s.employee_code || '').toLowerCase().includes(q) ||
        (s.department_name || '').toLowerCase().includes(q)
    );
  }, [stats, searchText]);

  const summaryTotals = useMemo(() => {
    let totalMonthApproved = 0;
    let totalMonthPending = 0;
    let totalYearApproved = 0;
    let activeOtEmployees = 0;

    for (const s of filteredStats) {
      totalMonthApproved += s.month_approved_hours || 0;
      totalMonthPending += s.month_pending_hours || 0;
      totalYearApproved += s.year_approved_hours || 0;
      if ((s.month_approved_hours || 0) > 0 || (s.month_pending_hours || 0) > 0) {
        activeOtEmployees += 1;
      }
    }

    return {
      employeeCount: filteredStats.length,
      activeOtEmployees,
      totalMonthApproved: totalMonthApproved.toFixed(1),
      totalMonthPending: totalMonthPending.toFixed(1),
      totalYearApproved: totalYearApproved.toFixed(1),
    };
  }, [filteredStats]);

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filteredStats.map((s) => ({
        'Mã NV': s.employee_code || '',
        'Nhân viên': s.employee_name || '',
        'Phòng ban': s.department_name || '',
        [`Số đơn OT (T${month}/${year})`]: s.month_count,
        [`Giờ OT đã duyệt (T${month}/${year})`]: s.month_approved_hours,
        'Hạn mức tháng còn lại (Trần 40h)': s.month_remaining_hours,
        [`Giờ OT chờ duyệt (T${month}/${year})`]: s.month_pending_hours,
        [`Giờ OT tích luỹ năm ${year}`]: s.year_approved_hours,
        [`Hạn mức năm còn lại (Trần 200h)`]: s.year_remaining_hours,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Thong_ke_OT_T${month}_${year}`);
      XLSX.writeFile(wb, `Thong_ke_lam_them_gio_T${month}_${year}.xlsx`);
      message.success('Xuất file Excel thành công');
    } catch {
      message.error('Xuất Excel thất bại');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: 'Nhân viên',
        dataIndex: 'employee_name',
        key: 'employee_name',
        width: 200,
        render: (v: string, record: OvertimeStatisticItem) => (
          <Space direction="vertical" size={0}>
            <Typography.Link strong onClick={() => openDetailModal(record)}>
              {v}
            </Typography.Link>
            {record.employee_code && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Mã NV: {record.employee_code}
              </Typography.Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Phòng ban',
        dataIndex: 'department_name',
        key: 'department_name',
        width: 170,
      },
      {
        title: `Số đơn (T${month})`,
        dataIndex: 'month_count',
        key: 'month_count',
        width: 110,
        align: 'center' as const,
        sorter: (a: OvertimeStatisticItem, b: OvertimeStatisticItem) => a.month_count - b.month_count,
      },
      {
        title: `Giờ OT đã duyệt (T${month})`,
        dataIndex: 'month_approved_hours',
        key: 'month_approved_hours',
        width: 165,
        align: 'center' as const,
        sorter: (a: OvertimeStatisticItem, b: OvertimeStatisticItem) =>
          a.month_approved_hours - b.month_approved_hours,
        render: (v: number) => (
          <Typography.Text strong style={{ color: v > 0 ? '#f97316' : '#64748b' }}>
            {v.toFixed(1)}h / 40h
          </Typography.Text>
        ),
      },
      {
        title: 'Hạn mức tháng còn lại',
        dataIndex: 'month_remaining_hours',
        key: 'month_remaining_hours',
        width: 165,
        align: 'center' as const,
        sorter: (a: OvertimeStatisticItem, b: OvertimeStatisticItem) =>
          a.month_remaining_hours - b.month_remaining_hours,
        render: (rem: number) => {
          const color = rem <= 0 ? 'error' : rem <= 8 ? 'warning' : 'success';
          return (
            <Tooltip title="Theo Điều 107 Bộ luật Lao động 2019: Tối đa 40 giờ làm thêm/tháng">
              <Tag color={color} style={{ margin: 0, fontWeight: 600 }}>
                {rem.toFixed(1)}h
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: `Tích luỹ năm ${year}`,
        dataIndex: 'year_approved_hours',
        key: 'year_approved_hours',
        width: 160,
        align: 'center' as const,
        sorter: (a: OvertimeStatisticItem, b: OvertimeStatisticItem) =>
          a.year_approved_hours - b.year_approved_hours,
        render: (v: number, record: OvertimeStatisticItem) => (
          <Tooltip
            title={`Theo Điều 107 BLLĐ: Tối đa 200h/năm | Còn lại trong năm: ${record.year_remaining_hours.toFixed(1)}h`}
          >
            <Typography.Text strong style={{ color: v >= 180 ? '#ef4444' : '#2563eb' }}>
              {v.toFixed(1)}h / 200h
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: 'Đang chờ duyệt',
        dataIndex: 'month_pending_hours',
        key: 'month_pending_hours',
        width: 135,
        align: 'center' as const,
        sorter: (a: OvertimeStatisticItem, b: OvertimeStatisticItem) =>
          a.month_pending_hours - b.month_pending_hours,
        render: (v: number) =>
          v > 0 ? (
            <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
              {v.toFixed(1)}h
            </Tag>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 90,
        align: 'center' as const,
        render: (_: any, record: OvertimeStatisticItem) => (
          <Tooltip title="Xem chi tiết các đơn OT trong tháng">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetailModal(record)}
            />
          </Tooltip>
        ),
      },
    ],
    [month, year]
  );

  const detailColumns = [
    {
      title: 'Ngày làm thêm',
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khung giờ',
      key: 'time_range',
      render: (_: any, r: OvertimeRegistration) =>
        `${String(r.start_time || '').slice(0, 5)} - ${String(r.end_time || '').slice(0, 5)}`,
    },
    {
      title: 'Số giờ',
      dataIndex: 'total_hours',
      key: 'total_hours',
      align: 'center' as const,
      render: (v: number) => <Typography.Text strong>{v}h</Typography.Text>,
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Thống kê làm thêm giờ (Tháng {month}/{year})
        </Typography.Title>

        <Space wrap>
          <Select value={month} onChange={(val) => setMonth(val)} style={{ width: 115 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <Option key={m} value={m}>
                Tháng {m}
              </Option>
            ))}
          </Select>

          <Select value={year} onChange={(val) => setYear(val)} style={{ width: 115 }}>
            {yearOptions.map((y) => (
              <Option key={y} value={y}>
                Năm {y}
              </Option>
            ))}
          </Select>

          {!isSelfOnly && (isSuperAdmin || userScope !== 'department') && (
            <Select
              allowClear
              placeholder="Tất cả phòng ban"
              value={selectedDept}
              onChange={(val) => setSelectedDept(val)}
              style={{ width: 200 }}
            >
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>
                  {d.name}
                </Option>
              ))}
            </Select>
          )}

          {!isSelfOnly && (
            <Input
              allowClear
              placeholder="Tìm tên hoặc mã nhân viên..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
            />
          )}

          <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Nhân sự có phát sinh OT / Tổng"
              value={summaryTotals.activeOtEmployees}
              suffix={`/ ${summaryTotals.employeeCount} người`}
              prefix={<TeamOutlined style={{ color: '#6366f1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title={`Tổng giờ OT đã duyệt (T${month})`}
              value={summaryTotals.totalMonthApproved}
              suffix="giờ"
              valueStyle={{ color: '#f97316' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title={`Tổng giờ OT tích luỹ năm ${year}`}
              value={summaryTotals.totalYearApproved}
              suffix="giờ"
              valueStyle={{ color: '#2563eb' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title={`Giờ OT đang chờ duyệt (T${month})`}
              value={summaryTotals.totalMonthPending}
              suffix="giờ"
              valueStyle={{ color: '#f59e0b' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={filteredStats}
        columns={columns}
        rowKey="employee_id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1050 }}
      />

      <Modal
        title={`Chi tiết làm thêm giờ Tháng ${month}/${year} - ${detailEmp?.employee_name || ''}`}
        open={detailEmp !== null}
        onCancel={() => {
          setDetailEmp(null);
          setDetailRegistrations([]);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailEmp(null);
              setDetailRegistrations([]);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={760}
      >
        {detailEmp && (
          <div style={{ marginBottom: 12 }}>
            <Space size={16} wrap>
              <Typography.Text>
                Đã duyệt T{month}: <b style={{ color: '#f97316' }}>{detailEmp.month_approved_hours.toFixed(1)}h / 40h</b>
              </Typography.Text>
              <Typography.Text>
                Hạn mức tháng còn lại: <b style={{ color: '#10b981' }}>{detailEmp.month_remaining_hours.toFixed(1)}h</b>
              </Typography.Text>
              <Typography.Text>
                Tích luỹ năm {year}: <b style={{ color: '#2563eb' }}>{detailEmp.year_approved_hours.toFixed(1)}h / 200h</b>
              </Typography.Text>
            </Space>
          </div>
        )}
        <Table
          dataSource={detailRegistrations}
          columns={detailColumns}
          rowKey="id"
          loading={detailLoading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Modal>
    </div>
  );
}

