import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, TimePicker, InputNumber, Tag, message, Typography, Space, Popconfirm, Tooltip, InputRef, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { overtimeRegistrationService } from '@/services/overtimeRegistrationService';
import { employeeService } from '@/services/employeeService';
import type { OvertimeRegistration } from '@/types/overtimeRegistration';
import type { Employee } from '@/types/employee';
import { useAuthStore } from '@/store/authStore';
import { PermGate } from '@/components/Common/PermGate';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { DATE_FORMATS } from '@/utils/constants';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.is_super_admin || user?.permissions?.can_manage_overtime;
  const canApprove = user?.is_super_admin || user?.permissions?.can_approve_overtime;
  const inputRef = useRef<InputRef>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [singleRejectRecord, setSingleRejectRecord] = useState<OvertimeRegistration | null>(null);
  const [singleRejectReason, setSingleRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dayjs().format('YYYY-MM-DD') };
      const userScope = user?.permissions?.scope;
      const isSuperAdmin = user?.is_super_admin;
      if (!isSuperAdmin && !canApprove && userScope === 'self' && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const [data, emps] = await Promise.all([
        overtimeRegistrationService.list(params),
        employeeService.list({ active_only: true }),
      ]);
      setRegistrations(data);
      setEmployees(emps);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
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

  useEffect(() => { fetchData(); }, []);

  const openAdd = useCallback(() => {
    if (adding) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), total_hours: 1 });
    setAdding(true);
    setEditingId('new');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [adding, form]);

  useKeyboardShortcut('n', openAdd, !adding);

  const cancel = useCallback(() => {
    setEditingId(null);
    setAdding(false);
    form.resetFields();
  }, [form]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId) cancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingId, cancel]);

  const handleSave = async (id: string) => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        employee_id: values.employee_id || user?.employee_id,
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined,
        start_time: values.start_time ? dayjs(values.start_time).format('HH:mm:ss') : undefined,
        end_time: values.end_time ? dayjs(values.end_time).format('HH:mm:ss') : undefined,
        total_hours: values.total_hours,
        reason: values.reason || undefined,
      };
      if (id === 'new') {
        await overtimeRegistrationService.create(payload);
        message.success('Đăng ký thêm giờ thành công');
      } else {
        const updatePayload: any = {
          start_time: payload.start_time,
          end_time: payload.end_time,
          total_hours: payload.total_hours,
          reason: payload.reason,
        };
        await overtimeRegistrationService.update(id, updatePayload);
        message.success('Cập nhật đăng ký thêm giờ thành công');
      }
      setEditingId(null);
      setAdding(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      const data = err?.response?.data;
      const detail = data?.detail || 'Lỗi khi lưu';
      const errors = data?.errors;
      if (errors && errors.length > 0) {
        message.error(`${detail} [${errors.map((e: any) => `${e.field}=${e.message}`).join('; ')}]`);
      } else {
        message.error(`${detail} (status=${err?.response?.status})`);
      }
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await overtimeRegistrationService.deactivate(id);
      message.success('Đã xoá đăng ký');
      fetchData();
    } catch {
      message.error('Không thể xoá');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await overtimeRegistrationService.bulkApprove(selectedRowKeys);
      message.success(`Đã duyệt ${result.success_count}/${result.total} đơn`);
      if (result.errors.length > 0) message.warning(`${result.errors.length} đơn không thể duyệt`);
      setSelectedRowKeys([]);
      fetchData();
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail || 'Lỗi khi duyệt hàng loạt';
      const errors = data?.errors;
      if (errors?.length) {
        message.error(`${detail} [${errors.map((e: any) => `${e.field}=${e.message}`).join('; ')}]`);
      } else {
        message.error(`${detail} (status=${err?.response?.status})`);
      }
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
      if (result.errors.length > 0) message.warning(`${result.errors.length} đơn không thể từ chối`);
      setSelectedRowKeys([]);
      setBatchRejectOpen(false);
      setBatchRejectReason('');
      fetchData();
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = data?.detail || 'Lỗi khi từ chối hàng loạt';
      const errors = data?.errors;
      if (errors?.length) {
        message.error(`${detail} [${errors.map((e: any) => `${e.field}=${e.message}`).join('; ')}]`);
      } else {
        message.error(`${detail} (status=${err?.response?.status})`);
      }
    } finally {
      setBatchLoading(false);
    }
  };

  const startEdit = (reg: OvertimeRegistration) => {
    form.setFieldsValue({
      ...reg,
      employee_id: reg.employee_id || user?.employee_id,
      date: reg.date ? dayjs(reg.date) : undefined,
      start_time: reg.start_time ? dayjs(reg.start_time, 'HH:mm:ss') : undefined,
      end_time: reg.end_time ? dayjs(reg.end_time, 'HH:mm:ss') : undefined,
    });
    setEditingId(reg.id);
    setAdding(false);
  };

  const isEditing = (record: OvertimeRegistration) => record.id === editingId;

  const deptFilterOptions = useMemo(() => {
    const names = new Set(registrations.map((r) => r.department_name).filter(Boolean) as string[]);
    return Array.from(names).map((name) => ({ text: name, value: name }));
  }, [registrations]);

  const columns = useMemo(() => [
    {
      title: 'Ngày', dataIndex: 'date', key: 'date', width: 130,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return <Form.Item name="date" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>;
        }
        return v ? dayjs(v).format('DD/MM/YYYY') : '-';
      },
    },
    {
      title: 'Nhân viên', dataIndex: 'employee_name', key: 'employee_name', width: 180,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.employee_name || '').localeCompare(b.employee_name || ''),
      render: (v: string | null, record: OvertimeRegistration) => {
        if (isEditing(record) && canManage) {
          return (
            <Form.Item name="employee_id" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
              <Select
                showSearch
                placeholder="Chọn nhân viên"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={employees.filter((e) => e.is_active).map((e) => ({ label: e.full_name, value: e.id }))}
              />
            </Form.Item>
          );
        }
        return v || '-';
      },
    },
    {
      title: 'Phòng ban', dataIndex: 'department_name', key: 'department_name', width: 140,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.department_name || '').localeCompare(b.department_name || ''),
      filters: deptFilterOptions,
      onFilter: (value: any, record: OvertimeRegistration) => record.department_name === value,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Giờ bắt đầu', dataIndex: 'start_time', key: 'start_time', width: 120,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.start_time || '').localeCompare(b.start_time || ''),
      render: (v: string | null, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return <Form.Item name="start_time" style={{ margin: 0 }}><TimePicker format="HH:mm" style={{ width: '100%' }} /></Form.Item>;
        }
        return v ? v.substring(0, 5) : '-';
      },
    },
    {
      title: 'Giờ kết thúc', dataIndex: 'end_time', key: 'end_time', width: 120,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.end_time || '').localeCompare(b.end_time || ''),
      render: (v: string | null, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return <Form.Item name="end_time" style={{ margin: 0 }}><TimePicker format="HH:mm" style={{ width: '100%' }} /></Form.Item>;
        }
        return v ? v.substring(0, 5) : '-';
      },
    },
    {
      title: 'Số giờ', dataIndex: 'total_hours', key: 'total_hours', width: 80,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.total_hours || 0) - (b.total_hours || 0),
      render: (v: number | null, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return <Form.Item name="total_hours" style={{ margin: 0 }}><InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} /></Form.Item>;
        }
        return v ?? '-';
      },
    },
    {
      title: 'Lý do', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.reason || '').localeCompare(b.reason || ''),
      render: (v: string | null, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return <Form.Item name="reason" style={{ margin: 0 }}><Input /></Form.Item>;
        }
        return v || '-';
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: OvertimeRegistration) => record.status === value,
      sorter: (a: OvertimeRegistration, b: OvertimeRegistration) => (a.status || '').localeCompare(b.status || ''),
      render: (v: string, record: OvertimeRegistration) => (
        <Tooltip title={v === 'rejected' && record.rejection_reason ? `Lý do từ chối: ${record.rejection_reason}` : undefined}>
          <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: OvertimeRegistration) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleSave(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
            </Space>
          );
        }

        const isOwner = record.employee_id === user?.employee_id;
        const canEditOrDelete = record.status === 'pending' && (isOwner || canManage);

        return (
          <Space size={4}>
            {canApprove && record.status === 'pending' && (
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
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: '0 4px' }}
                    icon={<EditOutlined />}
                    disabled={editingId !== null}
                    onClick={() => startEdit(record)}
                  />
                </Tooltip>
                <Popconfirm title="Huỷ đăng ký này?" onConfirm={() => handleDeactivate(record.id)}>
                  <Tooltip title="Huỷ đơn">
                    <Button
                      type="link"
                      size="small"
                      danger
                      style={{ padding: '0 4px' }}
                      icon={<DeleteOutlined />}
                      disabled={editingId !== null}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ], [editingId, employees, canManage, canApprove, user, handleSave, cancel, startEdit, handleDeactivate, handleSingleApprove]);

  const newRow = {
    id: 'new',
    employee_id: user?.employee_id || '',
    employee_name: '',
    department_name: null,
    date: dayjs().format('YYYY-MM-DD'),
    start_time: null,
    end_time: null,
    total_hours: 1,
    reason: null,
    status: 'pending',
    is_active: true,
    created_at: null,
    updated_at: null,
  } as unknown as OvertimeRegistration;

  const dataSource = adding ? [newRow, ...registrations] : registrations;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, alignItems: 'center' }}>
        {canManage && (
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={editingId !== null}>
              Đăng ký thêm giờ
            </Button>
          </Tooltip>
        )}
      </div>

      <Form form={form} component={false}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          rowSelection={(!canApprove || editingId) ? undefined : {
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (record: OvertimeRegistration) => ({
              disabled: record.status !== 'pending',
            }),
          }}
        />
      </Form>

      {canApprove && selectedRowKeys.length > 0 && editingId === null && (
        <div style={{
          position: 'fixed', bottom: 5, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.6)', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Typography.Text strong>Đã chọn {selectedRowKeys.length} đơn</Typography.Text>
          <Button icon={<CheckOutlined />} type="primary" onClick={handleBatchApprove} loading={batchLoading}>Duyệt</Button>
          <Button icon={<CloseOutlined />} danger onClick={() => setBatchRejectOpen(true)} loading={batchLoading}>Từ chối</Button>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      <Modal
        title={`Từ chối hàng loạt (${selectedRowKeys.length} đơn)`}
        open={batchRejectOpen}
        onCancel={() => { setBatchRejectOpen(false); setBatchRejectReason(''); }}
        onOk={handleBatchReject}
        confirmLoading={batchLoading}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !batchRejectReason.trim() }}
      >
        <Input.TextArea
          placeholder="Nhập lý do từ chối (dùng chung cho tất cả)"
          rows={3}
          value={batchRejectReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        title="Từ chối đăng ký thêm giờ"
        open={singleRejectRecord !== null}
        onCancel={() => { setSingleRejectRecord(null); setSingleRejectReason(''); }}
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
