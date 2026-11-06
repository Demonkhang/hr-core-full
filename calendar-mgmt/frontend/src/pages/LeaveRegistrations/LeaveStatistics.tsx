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
  Form,
  InputNumber,
  message,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  SyncOutlined,
  EditOutlined,
  EyeOutlined,
  TeamOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveBalanceService } from '@/services/leaveBalanceService';
import { leaveRegistrationService } from '@/services/leaveRegistrationService';
import { departmentService } from '@/services/departmentService';
import type { LeaveBalance, LeaveRegistration } from '@/types/leave';
import type { Department } from '@/types/department';
import { useAuthStore } from '@/store/authStore';

const { Option } = Select;

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

export function LeaveStatistics() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const canManage = isSuperAdmin || Boolean(user?.permissions?.can_manage_leave);
  const canApprove = isSuperAdmin || Boolean(user?.permissions?.can_approve_leave);
  const userScope = user?.permissions?.scope || 'self';
  const isSelfOnly = !isSuperAdmin && !canApprove && userScope === 'self';

  const currentYear = dayjs().year();
  const [year, setYear] = useState<number>(currentYear);
  const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState<string>('');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Edit Balance Modal state
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [savingBalance, setSavingBalance] = useState<boolean>(false);
  const [editForm] = Form.useForm();

  // Detail Modal state
  const [detailEmployee, setDetailEmployee] = useState<LeaveBalance | null>(null);
  const [detailRegistrations, setDetailRegistrations] = useState<LeaveRegistration[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const yearOptions = useMemo(() => {
    const yrs: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      yrs.push(y);
    }
    return yrs;
  }, [currentYear]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const empIdFilter = isSelfOnly && user?.employee_id ? user.employee_id : undefined;
      const deptFilter =
        !isSuperAdmin && userScope === 'department' && user?.department_id
          ? user.department_id
          : selectedDept;

      const [balanceList, deptList] = await Promise.all([
        leaveBalanceService.getAll(0, 1000, year, empIdFilter, deptFilter),
        !isSelfOnly ? departmentService.list(true).catch(() => [] as Department[]) : Promise.resolve([] as Department[]),
      ]);

      setBalances(balanceList);
      if (!isSelfOnly) {
        setDepartments(deptList);
      }
    } catch {
      message.error('Không thể tải dữ liệu thống kê nghỉ phép');
    } finally {
      setLoading(false);
    }
  }, [year, selectedDept, isSelfOnly, isSuperAdmin, userScope, user?.employee_id, user?.department_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncBalances = async () => {
    setSyncing(true);
    try {
      const res = await leaveBalanceService.initForYear(year);
      message.success(res.message || `Đã đồng bộ quỹ phép năm ${year}`);
      await fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể đồng bộ quỹ phép');
    } finally {
      setSyncing(false);
    }
  };

  const handleCarryOver = async () => {
    setSyncing(true);
    try {
      const res = await leaveBalanceService.carryOverForYear(year, 5);
      message.success(res.message || `Đã kết chuyển phép tồn sang năm ${year}`);
      await fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể kết chuyển phép tồn');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filteredBalances.map((b) => ({
        'Mã NV': b.employee_code || '',
        'Nhân viên': b.employee_name || '',
        'Phòng ban': b.department_name || '',
        'Phép năm được cấp': b.total_allocated,
        'Phép tồn năm trước': b.carried_over,
        'Tổng quỹ phép năm': (b.total_allocated || 0) + (b.carried_over || 0),
        'Phép năm đã nghỉ': b.used,
        'Nghỉ ốm (BHXH)': b.sick_days || 0,
        'Việc riêng có lương (Đ.115)': b.personal_paid_days || 0,
        'Nghỉ không lương': b.personal_unpaid_days || 0,
        'Nghỉ thai sản (BHXH)': b.maternity_days || 0,
        'Tổng ngày đã nghỉ': b.total_taken_days ?? (b.used || 0) + (b.other_leave_days || 0),
        'Đang chờ duyệt': (b.pending_days || 0) + (b.other_pending_days || 0),
        'Phép năm còn lại': b.remaining,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Thong_ke_phep_${year}`);
      XLSX.writeFile(wb, `Thong_ke_nghi_phep_${year}.xlsx`);
      message.success('Xuất file Excel thành công');
    } catch {
      message.error('Xuất Excel thất bại');
    }
  };

  const openEditModal = (record: LeaveBalance) => {
    setEditingBalance(record);
    editForm.setFieldsValue({
      total_allocated: record.total_allocated,
      carried_over: record.carried_over,
    });
  };

  const handleSaveBalance = async () => {
    if (!editingBalance) return;
    try {
      const values = await editForm.validateFields();
      setSavingBalance(true);
      await leaveBalanceService.update(editingBalance.id, {
        total_allocated: values.total_allocated,
        carried_over: values.carried_over,
      });
      message.success('Đã cập nhật định mức phép năm');
      setEditingBalance(null);
      await fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi cập nhật quỹ phép');
    } finally {
      setSavingBalance(false);
    }
  };

  const openDetailModal = async (record: LeaveBalance) => {
    setDetailEmployee(record);
    setDetailLoading(true);
    try {
      const regs = await leaveRegistrationService.getAll({
        employee_id: record.employee_id,
        date_from: `${year}-01-01`,
        date_to: `${year}-12-31`,
      });
      setDetailRegistrations(regs);
    } catch {
      message.error('Không thể tải lịch sử đơn nghỉ của nhân viên');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredBalances = useMemo(() => {
    if (!searchText.trim()) return balances;
    const q = searchText.trim().toLowerCase();
    return balances.filter(
      (b) =>
        (b.employee_name || '').toLowerCase().includes(q) ||
        (b.employee_code || '').toLowerCase().includes(q) ||
        (b.department_name || '').toLowerCase().includes(q)
    );
  }, [balances, searchText]);

  const summaryStats = useMemo(() => {
    let totalAnnualAllocated = 0;
    let totalAnnualUsed = 0;
    let totalAnnualRemaining = 0;
    let totalPending = 0;
    let totalOtherUsed = 0;
    let totalAllTaken = 0;

    for (const b of filteredBalances) {
      totalAnnualAllocated += (b.total_allocated || 0) + (b.carried_over || 0);
      totalAnnualUsed += b.used || 0;
      totalAnnualRemaining += b.remaining || 0;
      totalPending += (b.pending_days || 0) + (b.other_pending_days || 0);
      totalOtherUsed += b.other_leave_days || 0;
      totalAllTaken += b.total_taken_days ?? (b.used || 0) + (b.other_leave_days || 0);
    }

    return {
      employeeCount: filteredBalances.length,
      totalAnnualAllocated: totalAnnualAllocated.toFixed(1),
      totalAnnualUsed: totalAnnualUsed.toFixed(1),
      totalAnnualRemaining: totalAnnualRemaining.toFixed(1),
      totalPending: totalPending.toFixed(1),
      totalOtherUsed: totalOtherUsed.toFixed(1),
      totalAllTaken: totalAllTaken.toFixed(1),
    };
  }, [filteredBalances]);

  const columns = useMemo(
    () => [
      {
        title: 'Nhân viên',
        dataIndex: 'employee_name',
        key: 'employee_name',
        width: 200,
        render: (v: string | undefined, record: LeaveBalance) => (
          <Space direction="vertical" size={0}>
            <Typography.Link strong onClick={() => openDetailModal(record)}>
              {v || `Nhân viên (${record.employee_id.slice(0, 8)})`}
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
        render: (v: string | undefined) => v || '-',
      },
      {
        title: 'Tổng quỹ phép năm',
        key: 'total_quota',
        width: 150,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) =>
          a.total_allocated + a.carried_over - (b.total_allocated + b.carried_over),
        render: (_: any, record: LeaveBalance) => {
          const total = (record.total_allocated || 0) + (record.carried_over || 0);
          return (
            <Tooltip
              title={`Phép chuẩn năm ${record.year}: ${record.total_allocated.toFixed(1)} ngày${
                record.carried_over > 0 ? ` + Phép tồn chuyển sang: ${record.carried_over.toFixed(1)} ngày` : ''
              }`}
            >
              <Typography.Text strong>{total.toFixed(1)}</Typography.Text>
            </Tooltip>
          );
        },
      },
      {
        title: 'Phép năm đã nghỉ',
        dataIndex: 'used',
        key: 'used',
        width: 145,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) => a.used - b.used,
        render: (v: number) => (
          <Typography.Text strong style={{ color: v > 0 ? '#2563eb' : '#64748b' }}>
            {(v || 0).toFixed(1)}
          </Typography.Text>
        ),
      },
      {
        title: 'Nghỉ loại khác',
        dataIndex: 'other_leave_days',
        key: 'other_leave_days',
        width: 135,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) => (a.other_leave_days || 0) - (b.other_leave_days || 0),
        render: (v: number | undefined, record: LeaveBalance) => {
          const val = v || 0;
          if (val <= 0) return <Typography.Text type="secondary">0.0</Typography.Text>;
          const details: string[] = [];
          if (record.sick_days)
            details.push(`Nghỉ ốm: ${record.sick_days.toFixed(1)}/${record.max_sick_days || 30} ngày (BHXH)`);
          if (record.personal_paid_days)
            details.push(`Việc riêng có lương (Đ.115): ${record.personal_paid_days.toFixed(1)} ngày`);
          if (record.personal_unpaid_days)
            details.push(`Nghỉ không lương: ${record.personal_unpaid_days.toFixed(1)} ngày`);
          if (record.maternity_days) details.push(`Thai sản (BHXH): ${record.maternity_days.toFixed(1)} ngày`);
          return (
            <Tooltip title={details.join(' | ') || 'Nghỉ loại khác'}>
              <Tag color="purple" style={{ margin: 0, fontWeight: 600 }}>
                {val.toFixed(1)}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Tổng ngày đã nghỉ',
        dataIndex: 'total_taken_days',
        key: 'total_taken_days',
        width: 150,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) =>
          (a.total_taken_days ?? a.used) - (b.total_taken_days ?? b.used),
        render: (_: any, record: LeaveBalance) => {
          const totalTaken = record.total_taken_days ?? (record.used || 0) + (record.other_leave_days || 0);
          return (
            <Typography.Text strong style={{ fontSize: 14 }}>
              {totalTaken.toFixed(1)}
            </Typography.Text>
          );
        },
      },
      {
        title: 'Đang chờ duyệt',
        key: 'pending_days',
        width: 135,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) =>
          (a.pending_days || 0) + (a.other_pending_days || 0) - ((b.pending_days || 0) + (b.other_pending_days || 0)),
        render: (_: any, record: LeaveBalance) => {
          const annualPending = record.pending_days || 0;
          const otherPending = record.other_pending_days || 0;
          const totalPending = annualPending + otherPending;
          if (totalPending <= 0) return <Typography.Text type="secondary">-</Typography.Text>;
          return (
            <Tooltip
              title={`Phép năm chờ duyệt: ${annualPending.toFixed(1)} ngày${
                otherPending > 0 ? ` | Loại khác chờ duyệt: ${otherPending.toFixed(1)} ngày` : ''
              }`}
            >
              <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                {totalPending.toFixed(1)}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Phép năm còn lại',
        dataIndex: 'remaining',
        key: 'remaining',
        width: 150,
        align: 'center' as const,
        sorter: (a: LeaveBalance, b: LeaveBalance) => a.remaining - b.remaining,
        render: (remaining: number) => {
          const color = remaining <= 0 ? 'error' : remaining <= 3 ? 'warning' : 'success';
          return (
            <Tag color={color} style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', margin: 0 }}>
              {(remaining || 0).toFixed(1)} ngày
            </Tag>
          );
        },
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 110,
        align: 'center' as const,
        render: (_: any, record: LeaveBalance) => (
          <Space size={4}>
            <Tooltip title="Xem chi tiết các đơn nghỉ">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openDetailModal(record)}
              />
            </Tooltip>
            {canManage && (
              <Tooltip title="Điều chỉnh quỹ phép năm">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    [canManage, year]
  );

  const detailColumns = [
    {
      title: 'Loại phép',
      dataIndex: 'leave_type',
      key: 'leave_type',
      render: (v: string) => LEAVE_TYPE_LABELS[v] || v,
    },
    {
      title: 'Từ ngày',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (v: string, r: LeaveRegistration) =>
        `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[r.start_session] || r.start_session})`,
    },
    {
      title: 'Đến ngày',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (v: string, r: LeaveRegistration) =>
        `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[r.end_session] || r.end_session})`,
    },
    {
      title: 'Số ngày',
      dataIndex: 'total_days',
      key: 'total_days',
      align: 'center' as const,
      render: (v: number) => <Typography.Text strong>{v}</Typography.Text>,
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
          Thống kê nghỉ phép năm {year}
        </Typography.Title>

        <Space wrap>
          <Select value={year} onChange={(val) => setYear(val)} style={{ width: 120 }}>
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
              style={{ width: 230 }}
            />
          )}

          {canManage && (
            <>
              <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSyncBalances} loading={syncing}>
                Đồng bộ quỹ phép
              </Button>
              <Tooltip title={`Chuyển số ngày phép năm ${year - 1} còn dư sang năm ${year} (Tối đa 5 ngày/người)`}>
                <Button icon={<SwapOutlined />} onClick={handleCarryOver} loading={syncing}>
                  Kết chuyển phép tồn
                </Button>
              </Tooltip>
            </>
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
              title="Nhân sự thống kê"
              value={summaryStats.employeeCount}
              suffix="người"
              prefix={<TeamOutlined style={{ color: '#6366f1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Phép năm đã nghỉ / Tổng cấp"
              value={summaryStats.totalAnnualUsed}
              suffix={`/ ${summaryStats.totalAnnualAllocated} ngày`}
              valueStyle={{ color: '#2563eb' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Tổng phép năm còn lại"
              value={summaryStats.totalAnnualRemaining}
              suffix="ngày"
              valueStyle={{ color: '#10b981' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Tổng ngày nghỉ (Tất cả loại)"
              value={summaryStats.totalAllTaken}
              suffix={`ngày (Chờ duyệt: ${summaryStats.totalPending})`}
              valueStyle={{ color: '#f59e0b' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={filteredBalances}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1100 }}
      />

      {/* Modal điều chỉnh quỹ phép */}
      <Modal
        title={`Điều chỉnh quỹ phép năm ${year} - ${editingBalance?.employee_name || ''}`}
        open={editingBalance !== null}
        onCancel={() => setEditingBalance(null)}
        onOk={handleSaveBalance}
        confirmLoading={savingBalance}
        okText="Lưu thay đổi"
        cancelText="Huỷ"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="total_allocated"
            label="Số ngày phép năm được cấp"
            rules={[{ required: true, message: 'Vui lòng nhập định mức phép năm' }]}
          >
            <InputNumber min={0} max={365} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="carried_over"
            label="Số ngày phép tồn năm trước chuyển sang"
            rules={[{ required: true, message: 'Vui lòng nhập số phép chuyển sang' }]}
          >
            <InputNumber min={0} max={365} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết các đơn nghỉ của nhân viên trong năm */}
      <Modal
        title={`Chi tiết nghỉ phép năm ${year} - ${detailEmployee?.employee_name || ''}`}
        open={detailEmployee !== null}
        onCancel={() => {
          setDetailEmployee(null);
          setDetailRegistrations([]);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailEmployee(null);
              setDetailRegistrations([]);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={820}
      >
        {detailEmployee && (
          <div style={{ marginBottom: 12 }}>
            <Space size={16} wrap>
              <Typography.Text>
                Tổng phép năm: <b>{(detailEmployee.total_allocated + detailEmployee.carried_over).toFixed(1)} ngày</b>
              </Typography.Text>
              <Typography.Text>
                Phép năm đã nghỉ: <b style={{ color: '#2563eb' }}>{detailEmployee.used.toFixed(1)} ngày</b>
              </Typography.Text>
              <Typography.Text>
                Nghỉ loại khác: <b style={{ color: '#7c3aed' }}>{(detailEmployee.other_leave_days || 0).toFixed(1)} ngày</b>
              </Typography.Text>
              <Typography.Text>
                Phép năm còn lại: <b style={{ color: '#10b981' }}>{detailEmployee.remaining.toFixed(1)} ngày</b>
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

