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

const PUBLIC_HOLIDAYS_MM_DD = new Set(['01-01', '04-30', '05-01', '09-02', '09-03']);
const SPECIAL_HOLIDAYS_YYYY_MM_DD = new Set([
  '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-04-07',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-04-26', '2026-04-27',
  '2027-02-05', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', '2027-04-16',
]);

function isHolidayOrWeekend(d: dayjs.Dayjs): boolean {
  const dow = d.day();
  if (dow === 0 || dow === 6) return true;
  if (PUBLIC_HOLIDAYS_MM_DD.has(d.format('MM-DD'))) return true;
  if (SPECIAL_HOLIDAYS_YYYY_MM_DD.has(d.format('YYYY-MM-DD'))) return true;
  return false;
}

function calculateLeaveDays(
  startDate?: dayjs.Dayjs | null,
  endDate?: dayjs.Dayjs | null,
  startSession: string = 'full',
  endSession: string = 'full'
): number {
  if (!startDate || !endDate) return 0;
  const start = startDate.startOf('day');
  const end = endDate.startOf('day');
  if (start.isAfter(end)) return 0;

  if (start.isSame(end, 'day')) {
    if (isHolidayOrWeekend(start)) return 0;
    return startSession === 'full' ? 1.0 : 0.5;
  }

  let total = 0;
  let curr = start;
  while (curr.isBefore(end, 'day') || curr.isSame(end, 'day')) {
    if (!isHolidayOrWeekend(curr)) {
      if (curr.isSame(start, 'day')) {
        total += startSession === 'full' ? 1.0 : 0.5;
      } else if (curr.isSame(end, 'day')) {
        total += endSession === 'full' ? 1.0 : 0.5;
      } else {
        total += 1.0;
      }
    }
    curr = curr.add(1, 'day');
  }
  return total;
}

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
  const [singleRejectRecord, setSingleRejectRecord] = useState<LeaveRegistration | null>(null);
  const [singleRejectReason, setSingleRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [form] = Form.useForm();
  const watchedEmployeeId = Form.useWatch('employee_id', form);
  const watchedLeaveType = Form.useWatch('leave_type', form);
  const watchedStartDate = Form.useWatch('start_date', form);
  const watchedEndDate = Form.useWatch('end_date', form);
  const watchedStartSession = Form.useWatch('start_session', form);
  const watchedEndSession = Form.useWatch('end_session', form);

  const user = useAuthStore((s) => s.user);
  const canManage = user?.is_super_admin || user?.permissions?.can_manage_leave;
  const canApprove = user?.is_super_admin || user?.permissions?.can_approve_leave;

  const calculatedDays = useMemo(
    () => calculateLeaveDays(watchedStartDate, watchedEndDate, watchedStartSession, watchedEndSession),
    [watchedStartDate, watchedEndDate, watchedStartSession, watchedEndSession]
  );

  const ensureEmployeeBalance = useCallback(async (empId?: string, year?: number) => {
    if (!empId) return;
    const targetYear = year || dayjs().year();
    try {
      const b = await leaveBalanceService.getByEmployeeAndYear(empId, targetYear);
      setBalancesMap((prev) => ({ ...prev, [empId]: b }));
      if (empId === user?.employee_id) {
        setMyBalance(b);
      }
    } catch {
      // Ignore if employee balance cannot be fetched
    }
  }, [user?.employee_id]);

  useEffect(() => {
    if (!editingId) return;
    const targetEmpId = watchedEmployeeId || user?.employee_id;
    const targetYear = watchedStartDate ? dayjs(watchedStartDate).year() : dayjs().year();
    if (targetEmpId) {
      const existing = balancesMap[targetEmpId];
      if (!existing || existing.year !== targetYear) {
        ensureEmployeeBalance(targetEmpId, targetYear);
      }
    }
  }, [editingId, watchedEmployeeId, watchedStartDate, user?.employee_id, balancesMap, ensureEmployeeBalance]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dayjs().format('YYYY-MM-DD') };
      const userScope = user?.permissions?.scope;
      const isSuperAdmin = user?.is_super_admin;
      if (!isSuperAdmin && !canApprove && userScope === 'self' && user?.employee_id) {
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
        } else {
          ensureEmployeeBalance(user.employee_id, currentYear);
        }
      }
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [canManage, canApprove, user, ensureEmployeeBalance]);

  const handleSingleApprove = async (id: string) => {
    try {
      await leaveRegistrationService.approve(id);
      message.success('Đã duyệt đơn nghỉ phép');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi duyệt đơn');
    }
  };

  const handleSingleReject = async () => {
    if (!singleRejectRecord || !singleRejectReason.trim()) return;
    setActionLoading(true);
    try {
      await leaveRegistrationService.reject(singleRejectRecord.id, singleRejectReason.trim());
      message.success('Đã từ chối đơn nghỉ phép');
      setSingleRejectRecord(null);
      setSingleRejectReason('');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi khi từ chối đơn');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = useCallback(() => {
    if (adding) return;
    form.resetFields();
    const defaultEmpId = user?.employee_id || undefined;
    form.setFieldsValue({
      employee_id: defaultEmpId,
      leave_type: 'annual',
      start_date: dayjs(),
      end_date: dayjs(),
      start_session: 'full',
      end_session: 'full',
      reason: '',
    });
    if (defaultEmpId) {
      ensureEmployeeBalance(defaultEmpId, dayjs().year());
    }
    setAdding(true);
    setEditingId('new');
  }, [adding, user, form, ensureEmployeeBalance]);

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
      const targetEmpId = values.employee_id || user?.employee_id;
      const days = calculateLeaveDays(values.start_date, values.end_date, values.start_session, values.end_session);
      if (days <= 0) {
        message.error('Số ngày nghỉ tính ra phải lớn hơn 0 (không tính Thứ 7, Chủ nhật)');
        return;
      }

      const empBalance = targetEmpId ? balancesMap[targetEmpId] : undefined;
      if (values.leave_type === 'annual' && empBalance && days > empBalance.remaining) {
        message.error(`Không đủ ngày phép năm (Yêu cầu: ${days} ngày, Quỹ phép còn lại: ${empBalance.remaining.toFixed(1)} ngày)`);
        return;
      }
      if (values.leave_type === 'personal_paid' && days > 3) {
        message.error('Theo Khoản 1 Điều 115 Bộ luật Lao động, nghỉ việc riêng hưởng nguyên lương tối đa 03 ngày/lần (Kết hôn: 3 ngày; Con kết hôn: 1 ngày; Tang chế: 3 ngày).');
        return;
      }
      if (values.leave_type === 'sick' && empBalance) {
        const maxSick = empBalance.max_sick_days || 30;
        const remainSick = Math.max(0, maxSick - (empBalance.sick_days || 0));
        if (days > remainSick) {
          message.error(`Vượt quá định mức nghỉ ốm hưởng BHXH trong năm (Còn tối đa: ${remainSick.toFixed(1)}/${maxSick} ngày)`);
          return;
        }
      }

      const payload: any = {
        employee_id: targetEmpId,
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
  }, [form, user, balancesMap, fetchData]);

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
      title: 'Số ngày', dataIndex: 'total_days', key: 'total_days', width: 100,
      render: (v: number, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return (
            <Typography.Text strong style={{ color: calculatedDays > 0 ? '#1890ff' : '#ff4d4f' }}>
              {calculatedDays > 0 ? `${calculatedDays} ngày` : '0 ngày'}
            </Typography.Text>
          );
        }
        return <Typography.Text strong>{v}</Typography.Text>;
      },
    },
    {
      title: 'Ngày phép còn lại', key: 'remaining', width: 195,
      render: (_: any, record: LeaveRegistration) => {
        const editing = isEditing(record);
        const activeType = editing ? (watchedLeaveType || record.leave_type) : record.leave_type;
        const empId = editing ? (watchedEmployeeId || record.employee_id || user?.employee_id) : record.employee_id;
        const balance = empId ? balancesMap[empId] : undefined;

        // 1. Chế độ Nghỉ phép năm (Điều 113, 114 BLLĐ 2019)
        if (activeType === 'annual') {
          if (!balance) return <Typography.Text type="secondary">-</Typography.Text>;
          const remaining = balance.remaining;
          const pending = balance.pending_days || 0;
          const color = remaining <= 0 ? '#ff4d4f' : remaining <= 3 ? '#faad14' : '#52c41a';

          if (editing) {
            const afterDeduct = remaining - calculatedDays;
            const afterColor = afterDeduct < 0 ? '#ff4d4f' : afterDeduct <= 3 ? '#faad14' : '#52c41a';
            return (
              <Space direction="vertical" size={0}>
                <Typography.Text style={{ color, fontWeight: 600 }}>
                  {remaining.toFixed(1)} ngày
                </Typography.Text>
                {calculatedDays > 0 && (
                  <Typography.Text style={{ fontSize: 12, color: afterColor }}>
                    {afterDeduct < 0 ? (
                      <b>Vượt quỹ phép ({afterDeduct.toFixed(1)})!</b>
                    ) : (
                      <>Sau đơn này: <b>{afterDeduct.toFixed(1)}</b></>
                    )}
                  </Typography.Text>
                )}
                {pending > 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    (Chờ duyệt: {pending.toFixed(1)})
                  </Typography.Text>
                )}
              </Space>
            );
          }

          return (
            <Tooltip
              title={`Quỹ phép năm (Điều 113 BLLĐ): Tổng ${(balance.total_allocated + balance.carried_over).toFixed(1)} ngày | Đã nghỉ: ${balance.used.toFixed(1)} ngày${pending > 0 ? ` | Chờ duyệt: ${pending.toFixed(1)} ngày` : ''}`}
            >
              <Typography.Text style={{ color, fontWeight: 600 }}>{remaining.toFixed(1)} ngày</Typography.Text>
            </Tooltip>
          );
        }

        // 2. Chế độ Việc riêng có lương (Khoản 1 Điều 115 BLLĐ 2019)
        if (activeType === 'personal_paid') {
          const usedPersonalPaid = balance?.personal_paid_days || 0;
          const isOverLimit = editing && calculatedDays > 3;
          if (editing) {
            return (
              <Tooltip title="Theo Khoản 1 Điều 115 BLLĐ: Bản thân kết hôn (tối đa 3 ngày); Con kết hôn (tối đa 1 ngày); Tang chế tứ thân phụ mẫu, vợ/chồng, con (tối đa 3 ngày). Hưởng 100% lương, không trừ phép năm.">
                <Space direction="vertical" size={0}>
                  <Tag color={isOverLimit ? 'error' : 'blue'} style={{ margin: 0, fontWeight: 600 }}>
                    Tối đa 3 ngày/lần
                  </Tag>
                  <Typography.Text
                    style={{ fontSize: 11, color: isOverLimit ? '#ff4d4f' : '#64748b' }}
                  >
                    {isOverLimit
                      ? 'Vượt trần 3 ngày (Đ.115 BLLĐ)!'
                      : `Không trừ phép • Đã nghỉ: ${usedPersonalPaid.toFixed(1)} ngày`}
                  </Typography.Text>
                </Space>
              </Tooltip>
            );
          }
          return (
            <Tooltip title="Chế độ việc riêng hưởng nguyên lương (Khoản 1 Điều 115 BLLĐ: Tối đa 1–3 ngày/sự kiện, không trừ quỹ phép năm)">
              <Tag color="blue" style={{ margin: 0 }}>Không trừ phép (Đ.115)</Tag>
            </Tooltip>
          );
        }

        // 3. Chế độ Nghỉ ốm (Điều 26 Luật BHXH)
        if (activeType === 'sick') {
          const maxSick = balance?.max_sick_days || 30;
          const usedSick = balance?.sick_days || 0;
          const remainSick = Math.max(0, maxSick - usedSick);
          const isOverSick = editing && calculatedDays > remainSick;
          if (editing) {
            return (
              <Tooltip title={`Theo Điều 26 Luật BHXH: Tối đa ${maxSick} ngày/năm hưởng BHXH (75% lương đóng BHXH khi có giấy chứng nhận nghỉ hưởng BHXH). Không trừ quỹ phép năm.`}>
                <Space direction="vertical" size={0}>
                  <Tag color={isOverSick ? 'error' : 'cyan'} style={{ margin: 0, fontWeight: 600 }}>
                    Còn {remainSick.toFixed(1)} / {maxSick} ngày (BHXH)
                  </Tag>
                  <Typography.Text style={{ fontSize: 11, color: isOverSick ? '#ff4d4f' : '#64748b' }}>
                    {isOverSick
                      ? 'Vượt định mức ốm BHXH năm!'
                      : `Không trừ phép • Đã nghỉ ốm: ${usedSick.toFixed(1)} ngày`}
                  </Typography.Text>
                </Space>
              </Tooltip>
            );
          }
          return (
            <Tooltip title={`Chế độ ốm đau hưởng BHXH (Điều 26 Luật BHXH: Tối đa ${maxSick} ngày/năm, không trừ quỹ phép năm)`}>
              <Tag color="cyan" style={{ margin: 0 }}>Chế độ BHXH (Ốm)</Tag>
            </Tooltip>
          );
        }

        // 4. Chế độ Nghỉ không lương (Khoản 2, 3 Điều 115 BLLĐ 2019)
        if (activeType === 'personal_unpaid') {
          const usedUnpaid = balance?.personal_unpaid_days || 0;
          if (editing) {
            return (
              <Tooltip title="Theo Khoản 2, 3 Điều 115 BLLĐ: Nghỉ không hưởng lương theo thông báo hoặc thỏa thuận với người sử dụng lao động. Không trừ quỹ phép năm.">
                <Space direction="vertical" size={0}>
                  <Tag color="default" style={{ margin: 0, fontWeight: 600 }}>
                    Theo thỏa thuận
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    Không trừ phép • Đã nghỉ: {usedUnpaid.toFixed(1)} ngày
                  </Typography.Text>
                </Space>
              </Tooltip>
            );
          }
          return (
            <Tooltip title="Nghỉ không hưởng lương theo thỏa thuận (Điều 115 BLLĐ, không trừ quỹ phép năm)">
              <Tag color="default" style={{ margin: 0 }}>Không trừ phép (KL)</Tag>
            </Tooltip>
          );
        }

        // 5. Chế độ Nghỉ thai sản (Điều 139 BLLĐ 2019 & Luật BHXH)
        if (activeType === 'maternity') {
          const usedMaternity = balance?.maternity_days || 0;
          const isOverMaternity = editing && calculatedDays > 240;
          if (editing) {
            return (
              <Tooltip title="Theo Điều 139 BLLĐ & Luật BHXH: Lao động nữ sinh con nghỉ 06 tháng (~180 ngày, thêm 30 ngày/con nếu sinh đôi trở lên); Lao động nam có vợ sinh con nghỉ 5–14 ngày; Khám thai 1–2 ngày/lần. Không trừ quỹ phép năm.">
                <Space direction="vertical" size={0}>
                  <Tag color={isOverMaternity ? 'error' : 'magenta'} style={{ margin: 0, fontWeight: 600 }}>
                    Tối đa 180 ngày (BHXH)
                  </Tag>
                  <Typography.Text style={{ fontSize: 11, color: isOverMaternity ? '#ff4d4f' : '#64748b' }}>
                    {isOverMaternity
                      ? 'Vượt định mức thai sản!'
                      : `Không trừ phép • Đã nghỉ: ${usedMaternity.toFixed(1)} ngày`}
                  </Typography.Text>
                </Space>
              </Tooltip>
            );
          }
          return (
            <Tooltip title="Chế độ Thai sản hưởng BHXH (Điều 139 BLLĐ & Luật BHXH, không trừ quỹ phép năm)">
              <Tag color="magenta" style={{ margin: 0 }}>Chế độ BHXH (Thai sản)</Tag>
            </Tooltip>
          );
        }

        return <Typography.Text type="secondary">-</Typography.Text>;
      },
    },
    {
      title: 'Lý do', dataIndex: 'reason', key: 'reason', width: 220, ellipsis: true,
      render: (v: string | null, record: LeaveRegistration) => {
        if (isEditing(record)) {
          const activeType = watchedLeaveType || record.leave_type;
          const reasonPlaceholders: Record<string, string> = {
            annual: 'Lý do nghỉ phép năm...',
            personal_paid: 'Ghi rõ sự kiện (Kết hôn: 3 ngày, Con kết hôn: 1 ngày, Tang chế: 3 ngày)...',
            sick: 'Ghi rõ lý do khám/chữa bệnh (kèm giấy nghỉ hưởng BHXH)...',
            personal_unpaid: 'Lý do xin nghỉ không hưởng lương...',
            maternity: 'Sinh con (6 tháng) / Vợ sinh con (5-14 ngày) / Khám thai...',
          };
          return (
            <Form.Item name="reason" style={{ margin: 0 }}>
              <Input.TextArea rows={2} placeholder={reasonPlaceholders[activeType] || 'Lý do nghỉ...'} />
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
      render: (v: string, record: LeaveRegistration) => (
        <Tooltip title={v === 'rejected' && record.rejection_reason ? `Lý do từ chối: ${record.rejection_reason}` : undefined}>
          <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: LeaveRegistration) => {
        if (isEditing(record)) {
          return null;
        }

        const isOwnerOrAdmin = canManage || record.employee_id === user?.employee_id;
        const canEditOrDelete = record.status === 'pending' && isOwnerOrAdmin;

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
                <Popconfirm title="Huỷ đơn xin phép này?" onConfirm={() => handleDelete(record.id)}>
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
  ], [editingId, employees, canManage, canApprove, user, handleSave, cancel, handleDelete, balancesMap, handleSingleApprove, calculatedDays, watchedEmployeeId, watchedLeaveType]);

  const activeBannerBalance = useMemo(() => {
    if (editingId) {
      const empId = watchedEmployeeId || user?.employee_id;
      if (empId && balancesMap[empId]) return balancesMap[empId];
    }
    return myBalance;
  }, [editingId, watchedEmployeeId, user?.employee_id, balancesMap, myBalance]);

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
        {activeBannerBalance && (
          <Typography.Text type="secondary" style={{ marginRight: 'auto' }}>
            {(!editingId || !watchedLeaveType || watchedLeaveType === 'annual') && (
              <>
                Quỹ phép năm {activeBannerBalance.employee_name ? `của ${activeBannerBalance.employee_name} ` : ''}({activeBannerBalance.year}): Tổng <b>{(activeBannerBalance.total_allocated + activeBannerBalance.carried_over).toFixed(1)}</b> ngày, đã nghỉ <b>{activeBannerBalance.used.toFixed(1)}</b> ngày
                {(activeBannerBalance.pending_days || 0) > 0 && <>, chờ duyệt <b style={{ color: '#faad14' }}>{(activeBannerBalance.pending_days || 0).toFixed(1)}</b> ngày</>}
                , còn lại <b style={{ color: '#10b981' }}>{activeBannerBalance.remaining.toFixed(1)}</b> ngày.
              </>
            )}
            {editingId && watchedLeaveType === 'personal_paid' && (
              <>
                <b>Chế độ Việc riêng có lương (Khoản 1 Điều 115 BLLĐ):</b> Kết hôn <b>tối đa 03 ngày</b>; Con kết hôn <b>01 ngày</b>; Tang chế (cha/mẹ hai bên, vợ/chồng, con) <b>03 ngày</b>. <span style={{ color: '#2563eb' }}>Không trừ quỹ phép năm</span> (Đã nghỉ năm {activeBannerBalance.year}: <b>{(activeBannerBalance.personal_paid_days || 0).toFixed(1)}</b> ngày).
              </>
            )}
            {editingId && watchedLeaveType === 'sick' && (
              <>
                <b>Chế độ Nghỉ ốm (Điều 26 Luật BHXH):</b> Hưởng BHXH tối đa <b>{activeBannerBalance.max_sick_days || 30} ngày/năm</b> (cần giấy nghỉ hưởng BHXH). <span style={{ color: '#0891b2' }}>Không trừ quỹ phép năm</span> (Đã nghỉ ốm năm {activeBannerBalance.year}: <b>{(activeBannerBalance.sick_days || 0).toFixed(1)}</b> ngày, còn tối đa <b>{Math.max(0, (activeBannerBalance.max_sick_days || 30) - (activeBannerBalance.sick_days || 0)).toFixed(1)}</b> ngày).
              </>
            )}
            {editingId && watchedLeaveType === 'personal_unpaid' && (
              <>
                <b>Chế độ Nghỉ không hưởng lương (Khoản 2, 3 Điều 115 BLLĐ):</b> Nghỉ theo thông báo/thỏa thuận với quản lý, <b>không hưởng lương và không trừ quỹ phép năm</b> (Đã nghỉ năm {activeBannerBalance.year}: <b>{(activeBannerBalance.personal_unpaid_days || 0).toFixed(1)}</b> ngày).
              </>
            )}
            {editingId && watchedLeaveType === 'maternity' && (
              <>
                <b>Chế độ Thai sản (Điều 139 BLLĐ & Luật BHXH):</b> Nữ sinh con nghỉ tối đa <b>06 tháng (~180 ngày)</b>; Nam khi vợ sinh con nghỉ <b>05–14 ngày làm việc</b>; Khám thai <b>1–2 ngày/lần</b>. <span style={{ color: '#db2777' }}>Không trừ quỹ phép năm</span> (Đã nghỉ năm {activeBannerBalance.year}: <b>{(activeBannerBalance.maternity_days || 0).toFixed(1)}</b> ngày).
              </>
            )}
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
        ) : canManage ? (
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Đăng ký
            </Button>
          </Tooltip>
        ) : null}
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
            getCheckboxProps: (record: LeaveRegistration) => ({
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
        title="Từ chối đơn xin nghỉ phép"
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
