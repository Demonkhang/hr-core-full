import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, TimePicker, Tag, message, Typography, Space, Popconfirm, Tooltip, InputRef, Modal, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, EyeOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import type { MeetingSchedule, MeetingParticipant } from '@/types/meetingSchedule';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import { useAuthStore } from '@/store/authStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import {
  MEETING_TYPE, MEETING_TYPE_LABELS, MEETING_TYPE_COLORS,
  MEETING_STATUS_LABELS, MEETING_STATUS_COLORS,
} from '@/utils/constants';

export function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.is_super_admin || user?.permissions?.can_manage_employees;
  const inputRef = useRef<InputRef>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<MeetingSchedule | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, emps, depts] = await Promise.all([
        meetingScheduleService.getAll({ date_from: dayjs().format('YYYY-MM-DD') }),
        employeeService.list({ active_only: true }),
        departmentService.list(),
      ]);
      setMeetings(data);
      setEmployees(emps);
      setDepartments(depts);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = useCallback(() => {
    if (adding) return;
    form.resetFields();
    form.setFieldsValue({
      meeting_type: MEETING_TYPE.MEETING,
      date: dayjs(),
      start_time: dayjs().hour(8).minute(0),
      participant_ids: [],
    });
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

  const buildPayload = useCallback((values: any) => ({
    title: values.title,
    meeting_type: values.meeting_type,
    date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    start_time: values.start_time ? dayjs(values.start_time).format('HH:mm:ss') : undefined,
    location: values.location || undefined,
    description: values.description || undefined,
    department_id: values.department_id || undefined,
    participant_ids: values.participant_ids || [],
  }), []);

  const handleSave = useCallback(async (id: string) => {
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values);
      if (id === 'new') {
        await meetingScheduleService.create(payload as any);
        message.success('Tạo lịch họp thành công');
      } else {
        await meetingScheduleService.update(id, payload as any);
        message.success('Cập nhật lịch họp thành công');
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
  }, [form, fetchData, buildPayload]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await meetingScheduleService.delete(id);
      message.success('Đã huỷ lịch họp');
      fetchData();
    } catch {
      message.error('Không thể huỷ lịch họp này');
    }
  }, [fetchData]);

  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await meetingScheduleService.bulkApprove(selectedRowKeys);
      message.success(`Đã duyệt ${result.success_count}/${result.total} lịch họp`);
      if (result.errors.length > 0) message.warning(`${result.errors.length} lịch không thể duyệt`);
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
  }, [selectedRowKeys, fetchData]);

  const handleBatchReject = useCallback(async () => {
    if (selectedRowKeys.length === 0 || !batchRejectReason.trim()) return;
    setBatchLoading(true);
    try {
      const result = await meetingScheduleService.bulkReject(selectedRowKeys, batchRejectReason.trim());
      message.success(`Đã từ chối ${result.success_count}/${result.total} lịch họp`);
      if (result.errors.length > 0) message.warning(`${result.errors.length} lịch không thể từ chối`);
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
  }, [selectedRowKeys, batchRejectReason, fetchData]);

  const startEdit = (record: MeetingSchedule) => {
    form.setFieldsValue({
      title: record.title,
      meeting_type: record.meeting_type,
      date: record.date ? dayjs(record.date) : undefined,
      start_time: record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : undefined,
      location: record.location,
      description: record.description,
      department_id: record.department_id,
      participant_ids: record.participants?.map((p) => p.employee_id) || [],
    });
    setEditingId(record.id);
    setAdding(false);
  };

  const showDetail = (record: MeetingSchedule) => {
    setDetailMeeting(record);
    setDetailOpen(true);
  };

  const isEditing = (record: MeetingSchedule) => record.id === editingId;

  const getEmployeeName = (id: string) => employees.find((e) => e.id === id)?.full_name || '';

  const columns = useMemo(() => [
    {
      title: 'Ngày', dataIndex: 'date', key: 'date', width: 110,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.date || '').localeCompare(b.date || ''),
      render: (v: string, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return <Form.Item name="date" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>;
        }
        return v ? dayjs(v).format('DD/MM/YYYY') : '-';
      },
    },
    {
      title: 'Giờ', dataIndex: 'start_time', key: 'time', width: 100,
      render: (val: string, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return <Form.Item name="start_time" style={{ margin: 0 }}><TimePicker format="HH:mm" style={{ width: 80 }} /></Form.Item>;
        }
        return val ? val.substring(0, 5) : '-';
      },
    },
    {
      title: 'Tiêu đề', dataIndex: 'title', key: 'title', width: 180, ellipsis: true,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.title || '').localeCompare(b.title || ''),
      render: (v: string, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return <Form.Item name="title" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><Input ref={inputRef} /></Form.Item>;
        }
        return v || '-';
      },
    },
    {
      title: 'Loại', dataIndex: 'meeting_type', key: 'meeting_type', width: 130,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.meeting_type || '').localeCompare(b.meeting_type || ''),
      filters: Object.entries(MEETING_TYPE_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: MeetingSchedule) => record.meeting_type === value,
      render: (v: string, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="meeting_type" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
              <Select style={{ width: '100%' }}>
                {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
                  <Select.Option key={key} value={key}>{label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          );
        }
        return <Tag color={MEETING_TYPE_COLORS[v]}>{MEETING_TYPE_LABELS[v] || v}</Tag>;
      },
    },
    {
      title: 'Địa điểm', dataIndex: 'location', key: 'location', width: 120, ellipsis: true,
      render: (v: string | null, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return <Form.Item name="location" style={{ margin: 0 }}><Input /></Form.Item>;
        }
        return v || '-';
      },
    },
    {
      title: 'Tham gia', key: 'participants', width: 250, ellipsis: true,
      render: (_: any, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="participant_ids" style={{ margin: 0 }}>
              <Select
                mode="multiple"
                showSearch
                placeholder="Chọn người tham gia"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={employees.filter((e) => e.is_active).map((e) => ({ label: `${e.full_name}${e.department_name ? ` (${e.department_name})` : ''}`, value: e.id }))}
                maxTagCount={2}
                maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        }
        const participants = record.participants || [];
        if (participants.length === 0) return <span style={{ color: '#999' }}>Chưa chọn</span>;
        const names = participants.map((p) => p.employee_name || getEmployeeName(p.employee_id)).filter(Boolean);
        const displayed = names.slice(0, 3).join(', ');
        const extra = names.length > 3 ? ` +${names.length - 3}` : '';
        return (
          <Tooltip title={names.join(', ')}>
            <span>{displayed}{extra}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 100,
      sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.status || '').localeCompare(b.status || ''),
      filters: Object.entries(MEETING_STATUS_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value: any, record: MeetingSchedule) => record.status === value,
      render: (v: string) => <Tag color={MEETING_STATUS_COLORS[v]}>{MEETING_STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_: any, record: MeetingSchedule) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleSave(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
            </Space>
          );
        }
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
            {record.status === 'pending' && canManage && (
              <>
                <Button type="link" size="small" icon={<EditOutlined />} disabled={editingId !== null} onClick={() => startEdit(record)} />
                <Popconfirm title="Huỷ lịch họp này?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingId !== null} />
                </Popconfirm>
              </>
            )}
          </Space>
        );
      },
    },
  ], [editingId, canManage, handleSave, cancel, handleDelete, employees, form]);

  const newRow = {
    id: 'new',
    title: '',
    meeting_type: MEETING_TYPE.MEETING,
    date: dayjs().format('YYYY-MM-DD'),
    start_time: dayjs().hour(8).minute(0).format('HH:mm:ss'),
    location: '',
    description: '',
    department_id: null,
    created_by_name: user?.full_name || '',
    status: 'pending',
    is_active: true,
    participants: [],
    participant_count: 0,
    created_at: null,
    updated_at: null,
  } as unknown as MeetingSchedule;

  const dataSource = adding ? [newRow, ...meetings] : meetings;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, alignItems: 'center' }}>
        <Tooltip title="Alt+N">
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={editingId !== null}>
            Tạo lịch họp
          </Button>
        </Tooltip>
      </div>

      <Form form={form} component={false}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          rowSelection={editingId ? undefined : {
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (record: MeetingSchedule) => ({
              disabled: record.status !== 'pending',
            }),
          }}
        />
      </Form>

      {selectedRowKeys.length > 0 && editingId === null && (
        <div style={{
          position: 'fixed',
          bottom: 5,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <Typography.Text strong>Đã chọn {selectedRowKeys.length} lịch họp</Typography.Text>
          <Button icon={<CheckOutlined />} type="primary" onClick={handleBatchApprove} loading={batchLoading}>Duyệt</Button>
          <Button icon={<CloseOutlined />} danger onClick={() => setBatchRejectOpen(true)} loading={batchLoading}>Từ chối</Button>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      <Modal
        title={`Từ chối hàng loạt (${selectedRowKeys.length} lịch họp)`}
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
        title="Chi tiết lịch họp"
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailMeeting(null); }}
        footer={null}
        width={600}
      >
        {detailMeeting && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Tiêu đề">{detailMeeting.title}</Descriptions.Item>
            <Descriptions.Item label="Loại họp">
              <Tag color={MEETING_TYPE_COLORS[detailMeeting.meeting_type]}>{MEETING_TYPE_LABELS[detailMeeting.meeting_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày">{detailMeeting.date ? dayjs(detailMeeting.date).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
            <Descriptions.Item label="Giờ">{detailMeeting.start_time?.substring(0, 5) || '-'}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{detailMeeting.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{detailMeeting.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{detailMeeting.department_name || 'Tất cả'}</Descriptions.Item>
            <Descriptions.Item label="Người tạo">{detailMeeting.created_by_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={MEETING_STATUS_COLORS[detailMeeting.status]}>{MEETING_STATUS_LABELS[detailMeeting.status]}</Tag>
            </Descriptions.Item>
            {detailMeeting.approved_by_name && (
              <Descriptions.Item label="Duyệt bởi">{detailMeeting.approved_by_name}</Descriptions.Item>
            )}
            {detailMeeting.rejection_reason && (
              <Descriptions.Item label="Lý do từ chối">{detailMeeting.rejection_reason}</Descriptions.Item>
            )}
            <Descriptions.Item label={`Tham gia (${detailMeeting.participants?.length || 0})`}>
              {detailMeeting.participants && detailMeeting.participants.length > 0 ? (
                <Space wrap>
                  {detailMeeting.participants.map((p: MeetingParticipant) => (
                    <Tag key={p.id} color="blue">{p.employee_name || 'Unknown'}</Tag>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#999' }}>Chưa có người tham gia</span>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
