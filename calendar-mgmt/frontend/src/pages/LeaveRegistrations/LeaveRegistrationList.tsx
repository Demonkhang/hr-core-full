import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Tag, message, Typography, Space, Popconfirm, Tooltip, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { leaveRegistrationService } from '@/services/leaveRegistrationService';
import { leaveBalanceService } from '@/services/leaveBalanceService';
import { employeeService } from '@/services/employeeService';
import type { LeaveRegistration, LeaveBalance } from '@/types/leave';
import type { Employee } from '@/types/employee';
import { useAuthStore } from '@/store/authStore';
import { PermGate } from '@/components/Common/PermGate';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

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

export function LeaveRegistrationList() {
  const [registrations, setRegistrations] = useState<LeaveRegistration[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myBalance, setMyBalance] = useState<LeaveBalance | null>(null);
  const [balancesMap, setBalancesMap] = useState<Record<string, LeaveBalance>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.is_super_admin || user?.permissions?.can_manage_employees;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dayjs().format('YYYY-MM-DD') };
      if (!canManage && user?.employee_id) {
        params.employee_id = user.employee_id;
      }
      const currentYear = dayjs().year();
      const [data, emps, balances] = await Promise.all([
        leaveRegistrationService.getAll(params),
        employeeService.list({ active_only: true }),
        leaveBalanceService.getAll(0, 1000, currentYear).catch(() => [] as LeaveBalance[]),
      ]);
      setRegistrations(data);
      setEmployees(emps);

      const bMap: Record<string, LeaveBalance> = {};
      for (const b of balances) {
        bMap[b.employee_id] = b;
      }
      setBalancesMap(bMap);

      if (user?.employee_id) {
        const myB = bMap[user.employee_id];
        if (myB) {
          setMyBalance(myB);
        }
      }
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [canManage, user]);

  useEffect(() => { fetchData(); }, []);

  const openAdd = useCallback(() => {
    if (adding) return;
    form.resetFields();
    form.setFieldsValue({
      employee_id: canManage ? undefined : user?.employee_id,
      leave_type: 'annual',
      start_date: dayjs(),
      end_date: dayjs(),
      start_session: 'full',
      end_session: 'full',
      reason: '',
    });
    setAdding(true);
    setEditingId('new');
  }, [adding, canManage, user, form]);

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

  const handleSave = useCallback(async (id: string) => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        employee_id: values.employee_id || user?.employee_id,
        start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? dayjs(values.end_date).format('YYYY-MM-DD') : undefined,
        start_session: values.start_session,
        end_session: values.end_session,
        leave_type: values.leave_type,
        reason: values.reason,
      };

      if (id === 'new') {
        await leaveRegistrationService.create(payload);
        message.success('Đăng ký nghỉ phép thành công');
      } else {
        await leaveRegistrationService.update(id, payload);
        message.success('Cập nhật đăng ký phép thành công');
      }
      setEditingId(null);
      setAdding(false);
      form.resetFields();
      await fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu');
    }
  }, [form, user, fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await leaveRegistrationService.delete(id);
      message.success('Đã huỷ đơn nghỉ phép');
      await fetchData();
    } catch {
      message.error('Không thể huỷ đơn này');
    }
  }, [fetchData]);

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await leaveRegistrationService.bulkApprove(selectedRowKeys);
      message.success(`Đã duyệt ${result.success_count}/${result.total} đơn`);
      if (result.errors.length > 0) message.warning(`${result.errors.length} đơn không thể duyệt`);
      setSelectedRowKeys([]);
      await fetchData();
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
      const result = await leaveRegistrationService.bulkReject(selectedRowKeys, batchRejectReason.trim());
      message.success(`Đã từ chối ${result.success_count}/${result.total} đơn`);
      if (result.errors.length > 0) message.warning(`${result.errors.length} đơn không thể từ chối`);
      setSelectedRowKeys([]);
      setBatchRejectOpen(false);
      setBatchRejectReason('');
      await fetchData();
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

  const startEdit = (record: LeaveRegistration) => {
    form.setFieldsValue({
      employee_id: record.employee_id,
      leave_type: record.leave_type,
      start_date: record.start_date ? dayjs(record.start_date) : undefined,
      end_date: record.end_date ? dayjs(record.end_date) : undefined,
      start_session: record.start_session,
      end_session: record.end_session,
      reason: record.reason,
    });
    setEditingId(record.id);
    setAdding(false);
  };

  const isEditing = (record: LeaveRegistration) => record.id === editingId;

  const columns = useMemo(() => [
    {
      title: 'Nhân viên', dataIndex: 'employee_name', key: 'employee_name', width: 180,
      render: (v: string | null, record: LeaveRegistration) => {
        if (isEditing(record) && canManage) {
          return (
            <Form.Item name="employee_id" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
              <Select
                showSearch
                placeholder="Chọn nhân viên"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={employees.filter(e => e.is_active).map(e => ({ label: e.full_name, value: e.id }))}
              />
            </Form.Item>
          );
        }
        return v || '-';
      },
    },
    {
      title: 'Loại phép', dataIndex: 'leave_type', key: 'leave_type', width: 150,
      filters: Object.entries(LEAVE_TYPE_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: LeaveRegistration) => record.leave_type === value,
      render: (v: string, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="leave_type" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
              <Select style={{ width: '100%' }}>
                {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                  <Option key={key} value={key}>{label}</Option>
                ))}
              </Select>
            </Form.Item>
          );
        }
        return LEAVE_TYPE_LABELS[v] || v;
      },
    },
    {
      title: 'Từ ngày', dataIndex: 'start_date', key: 'start_date', width: 170,
      render: (v: string, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Form.Item name="start_date" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="start_session" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <Select style={{ width: '100%' }}>
                  {Object.entries(SESSION_LABELS).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Space>
          );
        }
        return `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[record.start_session] || record.start_session})`;
      },
    },
    {
      title: 'Đến ngày', dataIndex: 'end_date', key: 'end_date', width: 170,
      render: (v: string, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Form.Item name="end_date" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="end_session" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <Select style={{ width: '100%' }}>
                  {Object.entries(SESSION_LABELS).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Space>
          );
        }
        return `${dayjs(v).format('DD/MM/YYYY')} (${SESSION_LABELS[record.end_session] || record.end_session})`;
      },
    },
    {
      title: 'Số ngày', dataIndex: 'total_days', key: 'total_days', width: 90,
      render: (v: number, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return record.id === 'new' ? (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Tự động</Typography.Text>
          ) : (
            <Typography.Text strong>{v}</Typography.Text>
          );
        }
        return <Typography.Text strong>{v}</Typography.Text>;
      },
    },
    {
      title: 'Ngày phép còn lại', key: 'remaining', width: 130,
      render: (_: any, record: LeaveRegistration) => {
        const balance = balancesMap[record.employee_id];
        if (!balance) return <Typography.Text type="secondary">-</Typography.Text>;
        const remaining = balance.remaining;
        const color = remaining <= 0 ? '#ff4d4f' : remaining <= 3 ? '#faad14' : '#52c41a';
        return <Typography.Text style={{ color, fontWeight: 600 }}>{remaining.toFixed(1)}</Typography.Text>;
      },
    },
    {
      title: 'Lý do', dataIndex: 'reason', key: 'reason', width: 220, ellipsis: true,
      render: (v: string | null, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="reason" style={{ margin: 0 }}>
              <Input.TextArea rows={2} placeholder="Lý do nghỉ..." />
            </Form.Item>
          );
        }
        return v || '-';
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      filters: Object.entries(STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: LeaveRegistration) => record.status === value,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 110,
      render: (_: any, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return null;
        }

        const isOwnerOrAdmin = canManage || record.employee_id === user?.employee_id;
        const canEditOrDelete = record.status === 'pending' && isOwnerOrAdmin;

        return (
          <Space>
            {canEditOrDelete && (
              <>
                <Button type="link" size="small" icon={<EditOutlined />} disabled={editingId !== null} onClick={() => startEdit(record)} />
                <Popconfirm title="Huỷ đơn xin phép này?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingId !== null} />
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ], [editingId, employees, canManage, user, handleSave, cancel, handleDelete, balancesMap]);

  const newRow = {
    id: 'new',
    employee_id: user?.employee_id || '',
    employee_name: '',
    leave_type: 'annual',
    start_date: dayjs().format('YYYY-MM-DD'),
    end_date: dayjs().format('YYYY-MM-DD'),
    start_session: 'full',
    end_session: 'full',
    total_days: 1,
    reason: '',
    status: 'pending',
    created_at: null,
    updated_at: null,
  } as unknown as LeaveRegistration;

  const dataSource = adding ? [newRow, ...registrations] : registrations;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {!canManage && myBalance && (
          <Typography.Text type="secondary" style={{ marginRight: 'auto' }}>
            Phép năm {dayjs().year()}: Tổng <b>{myBalance.total_allocated.toFixed(1)}</b> ngày, đã dùng <b>{myBalance.used.toFixed(1)}</b> ngày, còn lại <b style={{ color: '#1890ff' }}>{myBalance.remaining.toFixed(1)}</b> ngày.
          </Typography.Text>
        )}
        {editingId ? (
          <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleSave(editingId)}>
              Đăng ký
            </Button>
            <Button icon={<CloseOutlined />} onClick={cancel}>
              Huỷ
            </Button>
          </>
        ) : (
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Đăng ký
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
          rowSelection={editingId ? undefined : {
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (record: LeaveRegistration) => ({
              disabled: record.status !== 'pending',
            }),
          }}
        />
      </Form>

      {selectedRowKeys.length > 0 && editingId === null && (
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
    </div>
  );
}
