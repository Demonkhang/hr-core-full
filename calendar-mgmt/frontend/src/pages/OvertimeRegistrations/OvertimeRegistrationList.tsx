import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  InputNumber,
  Tag,
  message,
  Typography,
  Space,
  Popconfirm,
  Tooltip,
  Modal,
  Alert,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { overtimeRegistrationService } from '@/services/overtimeRegistrationService';
import { employeeService } from '@/services/employeeService';
import type { OvertimeRegistration, OvertimeRegistrationCreate } from '@/types/overtimeRegistration';
import type { Employee } from '@/types/employee';
import { useAuthStore } from '@/store/authStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

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

export function OvertimeRegistrationList() {
  const [registrations, setRegistrations] = useState<OvertimeRegistration[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal create/edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OvertimeRegistration | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalForm] = Form.useForm();
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<OvertimeRegistration | null>(null);

  // Batch actions
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Single reject
  const [singleRejectRecord, setSingleRejectRecord] = useState<OvertimeRegistration | null>(null);
  const [singleRejectReason, setSingleRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const user = useAuthStore((s) => s.user);

  // Robust permission checks
  const isAdmin = Boolean(
    user?.is_super_admin ||
    (user as any)?.role === 'admin' ||
    (user as any)?.role === 'superadmin' ||
    (user as any)?.role === 'super_admin'
  );
  const canManage = Boolean(
    isAdmin ||
    user?.permissions?.can_manage_overtime ||
    user?.permissions?.can_approve_overtime
  );
  const canApprove = Boolean(
    isAdmin ||
    user?.permissions?.can_approve_overtime
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dayjs().subtract(7, 'day').format('YYYY-MM-DD') };
      const userScope = user?.permissions?.scope;
      if (!isAdmin && !canApprove && userScope === 'self' && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const [data, emps] = await Promise.all([
        overtimeRegistrationService.list(params),
        employeeService.list({ active_only: true }),
      ]);
      setRegistrations(data);
      setEmployees(emps);
    } catch {
      message.error('Không thể tải dữ liệu đăng ký thêm giờ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Check overlap with official schedule
  const runConflictCheck = async (empId?: string, dt?: any, st?: any, et?: any) => {
    const employee_id = empId || modalForm.getFieldValue('employee_id');
    const dateVal = dt || modalForm.getFieldValue('date');
    const startVal = st || modalForm.getFieldValue('start_time');
    const endVal = et || modalForm.getFieldValue('end_time');

    if (!employee_id || !dateVal || !startVal || !endVal) {
      setConflictWarning(null);
      return;
    }

    setCheckingConflict(true);
    try {
      const res = await overtimeRegistrationService.checkConflict({
        employee_id,
        date: dayjs(dateVal).format('YYYY-MM-DD'),
        start_time: dayjs(startVal).format('HH:mm:ss'),
        end_time: dayjs(endVal).format('HH:mm:ss'),
      });
      if (res.has_conflict && res.conflict) {
        setConflictWarning(res.conflict.message);
      } else {
        setConflictWarning(null);
      }
    } catch {
      setConflictWarning(null);
    } finally {
      setCheckingConflict(false);
    }
  };

  // Open modal to create new overtime registration
  const openCreateModal = useCallback(() => {
    setEditingRecord(null);
    setConflictWarning(null);
    modalForm.resetFields();
    modalForm.setFieldsValue({
      employee_id: canManage ? undefined : user?.employee_id,
      date: dayjs(),
      start_time: dayjs('17:30', 'HH:mm'),
      end_time: dayjs('19:30', 'HH:mm'),
      total_hours: 2,
    });
    setModalOpen(true);
    if (!canManage && user?.employee_id) {
      runConflictCheck(user.employee_id, dayjs(), dayjs('17:30', 'HH:mm'), dayjs('19:30', 'HH:mm'));
    }
  }, [canManage, user, modalForm]);

  useKeyboardShortcut('n', openCreateModal, !modalOpen);

  // Open modal to edit existing pending overtime registration
  const openEditModal = (record: OvertimeRegistration) => {
    setEditingRecord(record);
    setConflictWarning(null);
    modalForm.resetFields();
    const st = record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : undefined;
    const et = record.end_time ? dayjs(record.end_time, 'HH:mm:ss') : undefined;
    const dt = record.date ? dayjs(record.date) : dayjs();

    modalForm.setFieldsValue({
      employee_id: record.employee_id,
      date: dt,
      start_time: st,
      end_time: et,
      total_hours: record.total_hours ?? 1,
      reason: record.reason || '',
    });
    setModalOpen(true);
    if (record.employee_id && dt && st && et) {
      runConflictCheck(record.employee_id, dt, st, et);
    }
  };

  // Auto calculate hours and trigger conflict check on form field change
  const handleModalValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.start_time || changedValues.end_time) {
      const st = allValues.start_time;
      const et = allValues.end_time;
      if (st && et) {
        let diff = et.diff(st, 'minute');
        if (diff < 0) diff += 24 * 60; // overnight
        const hrs = Math.round((diff / 60) * 10) / 10;
        if (hrs > 0) {
          modalForm.setFieldsValue({ total_hours: hrs });
        }
      }
    }

    if (
      changedValues.employee_id !== undefined ||
      changedValues.date !== undefined ||
      changedValues.start_time !== undefined ||
      changedValues.end_time !== undefined
    ) {
      runConflictCheck(allValues.employee_id, allValues.date, allValues.start_time, allValues.end_time);
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await modalForm.validateFields();
      setModalSubmitting(true);
      const payload: OvertimeRegistrationCreate = {
        employee_id: values.employee_id || user?.employee_id,
        date: dayjs(values.date).format('YYYY-MM-DD'),
        start_time: values.start_time ? dayjs(values.start_time).format('HH:mm:ss') : undefined,
        end_time: values.end_time ? dayjs(values.end_time).format('HH:mm:ss') : undefined,
        total_hours: values.total_hours,
        reason: values.reason || undefined,
      };

      if (editingRecord) {
        await overtimeRegistrationService.update(editingRecord.id, payload);
        message.success('Cập nhật yêu cầu đăng ký làm thêm giờ thành công');
      } else {
        await overtimeRegistrationService.create(payload);
        message.success('Đăng ký làm thêm giờ thành công');
      }

      setModalOpen(false);
      setEditingRecord(null);
      modalForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      const detail = err?.response?.data?.detail || 'Lỗi khi lưu đăng ký';
      message.error(detail);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await overtimeRegistrationService.deactivate(id);
      message.success('Đã xóa yêu cầu đăng ký thêm giờ');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể xóa yêu cầu');
    }
  };

  const handleSingleApprove = async (id: string) => {
    try {
      await overtimeRegistrationService.approve(id);
      message.success('Đã duyệt đăng ký thêm giờ');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi duyệt đăng ký');
    }
  };

  const handleSingleReject = async () => {
    if (!singleRejectRecord || !singleRejectReason.trim()) return;
    setActionLoading(true);
    try {
      await overtimeRegistrationService.reject(singleRejectRecord.id, singleRejectReason.trim());
      message.success('Đã từ chối đăng ký thêm giờ');
      setSingleRejectRecord(null);
      setSingleRejectReason('');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi từ chối đăng ký');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await overtimeRegistrationService.bulkApprove(selectedRowKeys);
      message.success(`Đã duyệt ${result.success_count}/${result.total} đơn`);
      if (result.errors?.length > 0) message.warning(`${result.errors.length} đơn không thể duyệt`);
      setSelectedRowKeys([]);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi duyệt hàng loạt');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedRowKeys.length === 0 || !batchRejectReason.trim()) return;
    setBatchLoading(true);
    try {
      const result = await overtimeRegistrationService.bulkReject(selectedRowKeys, batchRejectReason.trim());
      message.success(`Đã từ chối ${result.success_count}/${result.total} đơn`);
      if (result.errors?.length > 0) message.warning(`${result.errors.length} đơn không thể từ chối`);
      setSelectedRowKeys([]);
      setBatchRejectOpen(false);
      setBatchRejectReason('');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi từ chối hàng loạt');
    } finally {
      setBatchLoading(false);
    }
  };

  const deptFilterOptions = useMemo(() => {
    const names = new Set(registrations.map((r) => r.department_name).filter(Boolean) as string[]);
    return Array.from(names).map((name) => ({ text: name, value: name }));
  }, [registrations]);

  const columns = useMemo(() => [
    {
      title: 'NGÀY',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>
            {v ? dayjs(v).format('DD/MM/YYYY') : '-'}
          </span>
          <Tag
            style={{
              margin: 0,
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 6px',
              borderRadius: 4,
              background: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #ffedd5',
              fontWeight: 600,
            }}
          >
            <ThunderboltFilled style={{ fontSize: 9, marginRight: 3, color: '#ea580c' }} />
            Tăng ca
          </Tag>
        </Space>
      ),
    },
    {
      title: 'NHÂN VIÊN',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 180,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      render: (v: string | null) => (
        <span style={{ fontWeight: 500, color: '#0f172a' }}>{v || '-'}</span>
      ),
    },
    {
      title: 'PHÒNG BAN',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 150,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.department_name || '').localeCompare(b.department_name || ''),
      filters: deptFilterOptions,
      onFilter: (value: any, record: OvertimeRegistration) => record.department_name === value,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'GIỜ BẮT ĐẦU',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.start_time || '').localeCompare(b.start_time || ''),
      render: (v: string | null) => (
        v ? (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 600,
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fdba74',
            }}
          >
            {v.substring(0, 5)}
          </Tag>
        ) : '-'
      ),
    },
    {
      title: 'GIỜ KẾT THÚC',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 120,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.end_time || '').localeCompare(b.end_time || ''),
      render: (v: string | null) => (
        v ? (
          <Tag
            style={{
              borderRadius: 6,
              fontWeight: 600,
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fdba74',
            }}
          >
            {v.substring(0, 5)}
          </Tag>
        ) : '-'
      ),
    },
    {
      title: 'SỐ GIỜ',
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
      title: 'LÝ DO',
      dataIndex: 'reason',
      key: 'reason',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: OvertimeRegistration) => record.status === value,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.status || '').localeCompare(b.status || ''),
      render: (v: string, record: OvertimeRegistration) => (
        <Tooltip title={v === 'rejected' && record.rejection_reason ? `Lý do từ chối: ${record.rejection_reason}` : undefined}>
          <Tag color={STATUS_COLORS[v]} style={{ fontWeight: 600, borderRadius: 6 }}>
            {STATUS_LABELS[v] || v}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'HÀNH ĐỘNG',
      key: 'actions',
      width: 150,
      render: (_: any, record: OvertimeRegistration) => {
        const isOwner = record.employee_id === user?.employee_id;
        const isPending = record.status === 'pending';
        // Admin or manager or owner can edit and delete if request is not approved yet (pending)
        const canEditOrDelete = isPending && (isAdmin || canManage || isOwner);

        return (
          <Space size={6}>
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setDetailRecord(record);
                  setDetailOpen(true);
                }}
              />
            </Tooltip>

            {canApprove && isPending && (
              <>
                <Tooltip title="Duyệt đơn">
                  <Button
                    type="link"
                    size="small"
                    style={{ color: '#10b981', padding: '0 4px' }}
                    icon={<CheckOutlined />}
                    onClick={() => handleSingleApprove(record.id)}
                  />
                </Tooltip>
                <Tooltip title="Từ chối đơn">
                  <Button
                    type="link"
                    size="small"
                    danger
                    style={{ padding: '0 4px' }}
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setSingleRejectRecord(record);
                      setSingleRejectReason('');
                    }}
                  />
                </Tooltip>
              </>
            )}

            {canEditOrDelete && (
              <>
                <Tooltip title="Chỉnh sửa yêu cầu">
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: '0 4px', color: '#2563eb' }}
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Xóa yêu cầu đăng ký làm thêm giờ?"
                  description="Bạn có chắc chắn muốn xóa yêu cầu chưa duyệt này không?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Tooltip title="Xóa yêu cầu">
                    <Button
                      type="link"
                      size="small"
                      danger
                      style={{ padding: '0 4px' }}
                      icon={<DeleteOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ], [deptFilterOptions, user, isAdmin, canManage, canApprove]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.15)',
            }}
          >
            <ClockCircleOutlined style={{ fontSize: 20, color: '#ea580c' }} />
          </div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#0f172a' }}>
              Đăng ký làm thêm giờ
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Quản lý danh sách và phê duyệt đơn làm thêm giờ (OT)
            </Typography.Text>
          </div>
        </div>

        <Tooltip title="Alt+N">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              borderColor: '#ea580c',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
              fontWeight: 600,
            }}
          >
            Đăng ký thêm giờ
          </Button>
        </Tooltip>
      </div>

      <Table
        dataSource={registrations}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t: number) => `Tổng cộng ${t} đơn` }}

        rowSelection={!canApprove ? undefined : {
          selectedRowKeys,
          onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
          getCheckboxProps: (record: OvertimeRegistration) => ({
            disabled: record.status !== 'pending',
          }),
        }}
      />

      {/* Floating Batch Action Bar */}
      {canApprove && selectedRowKeys.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 16,
          boxShadow: '0 12px 36px rgba(0,0,0,0.15)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Typography.Text strong style={{ color: '#0f172a' }}>
            Đã chọn {selectedRowKeys.length} đơn chờ duyệt
          </Typography.Text>
          <Button icon={<CheckOutlined />} type="primary" onClick={handleBatchApprove} loading={batchLoading} style={{ background: '#10b981', borderColor: '#10b981' }}>
            Duyệt tất cả
          </Button>
          <Button icon={<CloseOutlined />} danger onClick={() => setBatchRejectOpen(true)} loading={batchLoading}>
            Từ chối
          </Button>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>
            Bỏ chọn
          </Button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#ffedd5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ThunderboltFilled style={{ color: '#ea580c' }} />
            </div>
            <span>{editingRecord ? 'Chỉnh sửa đăng ký làm thêm giờ' : 'Đăng ký làm thêm giờ'}</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRecord(null);
          modalForm.resetFields();
          setConflictWarning(null);
        }}
        onOk={handleModalSubmit}
        confirmLoading={modalSubmitting}
        okText={editingRecord ? 'Lưu cập nhật' : 'Đăng ký ngay'}
        cancelText="Hủy"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
            borderColor: '#ea580c',
          },
        }}
        width={560}
        destroyOnClose
      >
        {/* Real-time Conflict Alert */}
        {conflictWarning && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined style={{ fontSize: 18, color: '#d97706' }} />}
            message={<span style={{ fontWeight: 700, color: '#b45309' }}>Cảnh báo trùng lịch làm việc chính thức!</span>}
            description={
              <div style={{ fontSize: 13, color: '#92400e', marginTop: 4 }}>
                {conflictWarning}
                <div style={{ marginTop: 4, fontStyle: 'italic', fontSize: 12, opacity: 0.9 }}>
                  * Lưu ý: Khung giờ làm thêm giờ bị trùng hoặc giao cắt với lịch làm chính thức đã đăng ký trước đó.
                </div>
              </div>
            }
            style={{
              marginBottom: 16,
              borderRadius: 8,
              border: '1px solid #f59e0b',
              background: '#fffbeb',
            }}
          />
        )}

        <Form
          form={modalForm}
          layout="vertical"
          onValuesChange={handleModalValuesChange}
          style={{ marginTop: 12 }}
        >
          {canManage ? (
            <Form.Item
              name="employee_id"
              label="Nhân viên làm thêm giờ"
              rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
            >
              <Select
                showSearch
                placeholder="Tìm và chọn nhân viên"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={employees.filter((e) => e.is_active).map((e) => ({
                  label: `${e.full_name} (${e.employee_code || e.department_name || 'Nhân viên'})`,
                  value: e.id,
                }))}
              />
            </Form.Item>
          ) : (
            <Form.Item name="employee_id" label="Nhân viên" hidden>
              <Input />
            </Form.Item>
          )}

          <Form.Item
            name="date"
            label="Ngày làm thêm giờ"
            rules={[{ required: true, message: 'Vui lòng chọn ngày làm thêm' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="start_time"
              label="Giờ bắt đầu"
              rules={[{ required: true, message: 'Vui lòng chọn giờ bắt đầu' }]}
            >
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="end_time"
              label="Giờ kết thúc"
              rules={[{ required: true, message: 'Vui lòng chọn giờ kết thúc' }]}
            >
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="total_hours"
            label="Tổng số giờ làm thêm (h)"
            rules={[{ required: true, message: 'Vui lòng nhập số giờ làm thêm' }]}
            tooltip="Tự động tính toán từ giờ bắt đầu và kết thúc, bạn có thể điều chỉnh nếu cần"
          >
            <InputNumber
              min={0.5}
              max={24}
              step={0.5}
              style={{ width: '100%' }}
              addonAfter="giờ"
            />
          </Form.Item>

          <Form.Item name="reason" label="Lý do làm thêm giờ">
            <Input.TextArea
              rows={3}
              placeholder="Ghi rõ nội dung công việc hoặc lý do cần tăng ca..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Record Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EyeOutlined style={{ color: '#ea580c' }} />
            <span>Chi tiết đơn đăng ký làm thêm giờ</span>
          </div>
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={600}
      >
        {detailRecord && (
          <Descriptions bordered column={2} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="Nhân viên" span={2}>
              <strong>{detailRecord.employee_name || '-'}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Phòng ban" span={2}>
              {detailRecord.department_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tăng ca">
              <span style={{ color: '#ea580c', fontWeight: 600 }}>
                {detailRecord.date ? dayjs(detailRecord.date).format('DD/MM/YYYY') : '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Số giờ">
              <Tag color="#ea580c" style={{ color: '#fff', fontWeight: 700 }}>
                {detailRecord.total_hours}h OT
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Giờ bắt đầu">
              {detailRecord.start_time ? detailRecord.start_time.substring(0, 5) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Giờ kết thúc">
              {detailRecord.end_time ? detailRecord.end_time.substring(0, 5) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái" span={2}>
              <Tag color={STATUS_COLORS[detailRecord.status]}>
                {STATUS_LABELS[detailRecord.status] || detailRecord.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Lý do" span={2}>
              {detailRecord.reason || '-'}
            </Descriptions.Item>
            {detailRecord.status === 'rejected' && detailRecord.rejection_reason && (
              <Descriptions.Item label="Lý do từ chối" span={2}>
                <span style={{ color: '#ef4444' }}>{detailRecord.rejection_reason}</span>
              </Descriptions.Item>
            )}
            {detailRecord.approved_at && (
              <Descriptions.Item label="Thời gian duyệt" span={2}>
                {dayjs(detailRecord.approved_at).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Bulk Reject Modal */}
      <Modal
        title={`Từ chối hàng loạt (${selectedRowKeys.length} đơn)`}
        open={batchRejectOpen}
        onCancel={() => {
          setBatchRejectOpen(false);
          setBatchRejectReason('');
        }}
        onOk={handleBatchReject}
        confirmLoading={batchLoading}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !batchRejectReason.trim() }}
      >
        <Input.TextArea
          placeholder="Nhập lý do từ chối (áp dụng cho tất cả đơn đã chọn)"
          rows={3}
          value={batchRejectReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchRejectReason(e.target.value)}
        />
      </Modal>

      {/* Single Reject Modal */}
      <Modal
        title="Từ chối đăng ký làm thêm giờ"
        open={singleRejectRecord !== null}
        onCancel={() => {
          setSingleRejectRecord(null);
          setSingleRejectReason('');
        }}
        onOk={handleSingleReject}
        confirmLoading={actionLoading}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !singleRejectReason.trim() }}
      >
        <Input.TextArea
          placeholder="Nhập lý do từ chối..."
          rows={3}
          value={singleRejectReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSingleRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
