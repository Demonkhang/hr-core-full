import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Select,
  AutoComplete,
  DatePicker,
  TimePicker,
  Tag,
  message,
  Typography,
  Space,
  Popconfirm,
  Tooltip,
  InputRef,
  Modal,
  Descriptions,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import { employeeService } from '@/services/employeeService';
import { departmentService } from '@/services/departmentService';
import { workplaceService } from '@/services/workplaceService';
import { DepartmentParticipantModal } from '@/components/Meetings/DepartmentParticipantModal';
import type { MeetingSchedule, MeetingParticipant } from '@/types/meetingSchedule';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Workplace } from '@/types/workplace';
import { useAuthStore } from '@/store/authStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import {
  MEETING_TYPE,
  MEETING_TYPE_LABELS,
  MEETING_TYPE_COLORS,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
} from '@/utils/constants';

const PRESET_MEETING_ROOMS = [
  'Phòng họp 1 (Tầng 1 - 8 người)',
  'Phòng họp 2 (Tầng 2 - 15 người)',
  'Phòng Hội trường lớn (50 người)',
  'Họp Online (Google Meet)',
  'Họp Online (Zoom / MS Teams)',
];

export function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean(
    user?.is_super_admin ||
    (user as any)?.role === 'admin' ||
    (user as any)?.role === 'superadmin' ||
    (user as any)?.role === 'super_admin'
  );
  const canManage = Boolean(
    isAdmin ||
    user?.permissions?.can_manage_meetings ||
    user?.permissions?.can_approve_meetings
  );
  const canApprove = Boolean(
    isAdmin ||
    user?.permissions?.can_approve_meetings
  );
  const inputRef = useRef<InputRef>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<MeetingSchedule | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Dedicated Create & Edit Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditingMeeting, setModalEditingMeeting] = useState<MeetingSchedule | null>(null);
  const [modalForm] = Form.useForm();
  const [modalParticipantIds, setModalParticipantIds] = useState<string[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Two-step department participant modal state
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [, setForceRender] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, emps, depts, wps] = await Promise.all([
        meetingScheduleService.getAll({ date_from: dayjs().format('YYYY-MM-DD') }),
        employeeService.list({ active_only: true }),
        departmentService.list(),
        workplaceService.list({ active_only: true }),
      ]);
      setMeetings(data);
      setEmployees(emps);
      setDepartments(depts);
      setWorkplaces(wps);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = useCallback(() => {
    setModalEditingMeeting(null);
    modalForm.resetFields();
    modalForm.setFieldsValue({
      meeting_type: MEETING_TYPE.MEETING,
      date: dayjs(),
      start_time: dayjs().hour(9).minute(0),
      location: '',
      description: '',
    });
    setModalParticipantIds([]);
    setModalOpen(true);
  }, [modalForm]);

  const openEditModal = useCallback((record: MeetingSchedule) => {
    setModalEditingMeeting(record);
    modalForm.resetFields();
    modalForm.setFieldsValue({
      title: record.title,
      meeting_type: record.meeting_type,
      date: record.date ? dayjs(record.date) : dayjs(),
      start_time: record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : dayjs(),
      location: record.location || '',
      description: record.description || '',
    });
    setModalParticipantIds(record.participants?.map((p) => p.employee_id) || []);
    setModalOpen(true);
  }, [modalForm]);

  const handleModalSave = async () => {
    try {
      const values = await modalForm.validateFields();
      setModalSubmitting(true);
      const payload = {
        title: values.title,
        meeting_type: values.meeting_type,
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        start_time: values.start_time ? dayjs(values.start_time).format('HH:mm:ss') : undefined,
        location: values.location || undefined,
        description: values.description || undefined,
        participant_ids: modalParticipantIds,
      };

      if (modalEditingMeeting) {
        await meetingScheduleService.update(modalEditingMeeting.id, payload as any);
        message.success('Cập nhật lịch họp thành công & đã gửi thông báo đến người tham gia');
      } else {
        await meetingScheduleService.create(payload as any);
        message.success(
          canApprove
            ? 'Tạo & tự động duyệt lịch họp thành công, đã gửi thông báo đến người tham gia'
            : 'Tạo lịch họp thành công, đang chờ duyệt'
        );
      }
      setModalOpen(false);
      setModalEditingMeeting(null);
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      const data = err?.response?.data;
      const detail = data?.detail || 'Lỗi khi lưu lịch họp';
      message.error(detail);
    } finally {
      setModalSubmitting(false);
    }
  };

  const openAdd = useCallback(() => {
    openCreateModal();
  }, [openCreateModal]);

  useKeyboardShortcut('n', openCreateModal, !modalOpen);

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

  const buildPayload = useCallback(
    (values: any) => ({
      title: values.title,
      meeting_type: values.meeting_type,
      date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      start_time: values.start_time ? dayjs(values.start_time).format('HH:mm:ss') : undefined,
      location: values.location || undefined,
      description: values.description || undefined,
      department_id: values.department_id || undefined,
      participant_ids: values.participant_ids || [],
    }),
    []
  );

  const handleSave = useCallback(
    async (id: string) => {
      try {
        const values = await form.validateFields();
        const payload = buildPayload(values);
        if (id === 'new') {
          await meetingScheduleService.create(payload as any);
          message.success('Tạo lịch họp thành công & đã gửi thông báo đến người tham gia');
        } else {
          await meetingScheduleService.update(id, payload as any);
          message.success('Cập nhật lịch họp thành công & đã gửi thông báo cập nhật');
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
    },
    [form, fetchData, buildPayload]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await meetingScheduleService.delete(id);
        message.success('Đã huỷ lịch họp & đã thông báo đến người tham gia');
        fetchData();
      } catch {
        message.error('Không thể huỷ lịch họp này');
      }
    },
    [fetchData]
  );

  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await meetingScheduleService.bulkApprove(selectedRowKeys);
      message.success(`Đã duyệt ${result.success_count}/${result.total} lịch họp & đã gửi thông báo`);
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
      message.success(`Đã từ chối ${result.success_count}/${result.total} lịch họp & đã thông báo`);
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
      location: record.location || '',
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

  // AutoComplete / Dropdown options for location (Predefined + Custom)
  const locationOptions = useMemo(() => {
    const list: { label: string; options: { value: string; label: string }[] }[] = [];

    // Group 1: Workplaces from system
    if (workplaces.length > 0) {
      list.push({
        label: '🏢 Cơ sở / Nơi làm việc',
        options: workplaces.map((w) => ({ value: w.name, label: `🏢 ${w.name}` })),
      });
    }

    // Group 2: Meeting rooms & online
    list.push({
      label: '🚪 Phòng họp & Trực tuyến',
      options: PRESET_MEETING_ROOMS.map((room) => ({ value: room, label: room })),
    });

    return list;
  }, [workplaces]);

  const currentParticipantIds: string[] = Form.useWatch('participant_ids', form) || [];

  const columns = useMemo(
    () => [
      {
        title: 'Ngày',
        dataIndex: 'date',
        key: 'date',
        width: 125,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.date || '').localeCompare(b.date || ''),
        render: (v: string, record: MeetingSchedule) => {
          if (isEditing(record)) {
            return (
              <Form.Item name="date" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            );
          }
          return v ? dayjs(v).format('DD/MM/YYYY') : '-';
        },
      },
      {
        title: 'Giờ',
        dataIndex: 'start_time',
        key: 'time',
        width: 95,
        render: (val: string, record: MeetingSchedule) => {
          if (isEditing(record)) {
            return (
              <Form.Item name="start_time" style={{ margin: 0 }}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            );
          }
          return val ? val.substring(0, 5) : '-';
        },
      },
      {
        title: 'Tiêu đề',
        dataIndex: 'title',
        key: 'title',
        width: 180,
        ellipsis: true,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.title || '').localeCompare(b.title || ''),
        render: (v: string, record: MeetingSchedule) => {
          if (isEditing(record)) {
            return (
              <Form.Item name="title" style={{ margin: 0 }} rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
                <Input ref={inputRef} placeholder="Tiêu đề cuộc họp..." />
              </Form.Item>
            );
          }
          return v || '-';
        },
      },
      {
        title: 'Loại',
        dataIndex: 'meeting_type',
        key: 'meeting_type',
        width: 120,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.meeting_type || '').localeCompare(b.meeting_type || ''),
        filters: Object.entries(MEETING_TYPE_LABELS).map(([value, text]) => ({ text, value })),
        onFilter: (value: any, record: MeetingSchedule) => record.meeting_type === value,
        render: (v: string, record: MeetingSchedule) => {
          if (isEditing(record)) {
            return (
              <Form.Item name="meeting_type" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
                <Select style={{ width: '100%' }}>
                  {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
                    <Select.Option key={key} value={key}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            );
          }
          return <Tag color={MEETING_TYPE_COLORS[v]}>{MEETING_TYPE_LABELS[v] || v}</Tag>;
        },
      },
      {
        title: 'Địa điểm',
        dataIndex: 'location',
        key: 'location',
        width: 220,
        ellipsis: true,
        render: (v: string | null, record: MeetingSchedule) => {
          if (isEditing(record)) {
            return (
              <Form.Item name="location" style={{ margin: 0 }}>
                <AutoComplete
                  options={locationOptions}
                  placeholder="Chọn hoặc nhập địa điểm..."
                  filterOption={(inputValue, option: any) =>
                    ((option?.value || '').toUpperCase().indexOf(inputValue.toUpperCase()) !== -1)
                  }
                  allowClear
                  style={{ width: '100%' }}
                />
              </Form.Item>
            );
          }
          return v ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined style={{ color: '#ef4444', fontSize: 12 }} />
              {v}
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>-</span>
          );
        },
      },
      {
        title: 'Mô tả',
        dataIndex: 'description',
        key: 'description',
        width: 180,
        ellipsis: true,
        render: (v: string | null) =>
          v ? (
            <Tooltip title={v}>
              <span style={{ color: '#475569' }}>{v}</span>
            </Tooltip>
          ) : (
            <span style={{ color: '#94a3b8' }}>-</span>
          ),
      },
      {
        title: 'Tham gia',
        key: 'participants',
        width: 250,
        ellipsis: true,
        render: (_: any, record: MeetingSchedule) => {
          if (isEditing(record)) {
            const count = currentParticipantIds.length;
            const names = currentParticipantIds
              .map((id) => employees.find((e) => e.id === id)?.full_name)
              .filter(Boolean);

            return (
              <Form.Item name="participant_ids" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    type={count > 0 ? 'primary' : 'dashed'}
                    ghost={count > 0}
                    size="middle"
                    icon={<TeamOutlined />}
                    onClick={() => setParticipantModalOpen(true)}
                    style={{
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{count > 0 ? `👥 Đã chọn ${count} người` : 'Chọn người theo phòng ban...'}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>➔</span>
                  </Button>
                </div>
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
              <span>
                {displayed}
                {extra}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.status || '').localeCompare(b.status || ''),
        filters: Object.entries(MEETING_STATUS_LABELS).map(([value, text]) => ({ text, value })),
        onFilter: (value: any, record: MeetingSchedule) => record.status === value,
        render: (v: string) => <Tag color={MEETING_STATUS_COLORS[v]}>{MEETING_STATUS_LABELS[v] || v}</Tag>,
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 100,
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
              <Tooltip title="Xem chi tiết">
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
              </Tooltip>
              {canManage && record.status !== 'cancelled' && (
                <>
                  <Tooltip title="Chỉnh sửa lịch họp">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(record)}
                    />
                  </Tooltip>
                  <Popconfirm title="Huỷ lịch họp này?" onConfirm={() => handleDelete(record.id)}>
                    <Tooltip title="Hủy lịch họp">
                      <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </>
              )}
            </Space>
          );
        },
      },
    ],
    [
      editingId,
      canManage,
      handleSave,
      cancel,
      handleDelete,
      employees,
      locationOptions,
      currentParticipantIds,
      openEditModal,
    ]
  );

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
    status: canApprove ? 'approved' : 'pending',
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
        {canManage && (
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Tạo lịch họp
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
          scroll={{ x: 1200 }}
          rowSelection={
            !canApprove || editingId
              ? undefined
              : {
                  selectedRowKeys,
                  onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
                  getCheckboxProps: (record: MeetingSchedule) => ({
                    disabled: record.status !== 'pending',
                  }),
                }
          }
        />
      </Form>

      {/* Two-Step Department & Participant Selection Modal */}
      <DepartmentParticipantModal
        open={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        departments={departments}
        employees={employees}
        selectedIds={modalOpen ? modalParticipantIds : currentParticipantIds}
        onConfirm={(newSelectedIds) => {
          if (modalOpen) {
            setModalParticipantIds(newSelectedIds);
          } else {
            form.setFieldsValue({ participant_ids: newSelectedIds });
          }
          setForceRender((v) => v + 1);
        }}
      />

      {/* Create / Edit Meeting Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: '#2563eb' }} />
            <span>{modalEditingMeeting ? 'Chỉnh sửa lịch họp' : 'Tạo lịch họp mới'}</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setModalEditingMeeting(null);
        }}
        onOk={handleModalSave}
        confirmLoading={modalSubmitting}
        okText={modalEditingMeeting ? 'Lưu thay đổi' : 'Tạo lịch họp'}
        cancelText="Hủy"
        width={680}
        destroyOnClose
      >
        <Form form={modalForm} layout="vertical" style={{ marginTop: 12 }}>
          {modalEditingMeeting?.status === 'approved' && (
            <Alert
              type="success"
              showIcon
              message="Chế độ Quản trị viên"
              description="Cuộc họp này đã được duyệt. Bạn có thể bổ sung thêm người tham gia, chỉnh sửa mô tả và cập nhật thời gian. Sau khi lưu, thông báo cập nhật sẽ tự động gửi đến toàn bộ người tham gia."
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          {!modalEditingMeeting && canApprove && (
            <Alert
              type="info"
              showIcon
              message="Tạo lịch họp Quản trị viên"
              description="Lịch họp do Quản trị viên tạo sẽ được tự động phê duyệt ngay và thông báo đến người tham gia."
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          <Form.Item
            name="title"
            label="Tiêu đề cuộc họp"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' }]}
          >
            <Input placeholder="Ví dụ: Họp giao ban đầu tuần, Họp rà soát tiến độ..." style={{ borderRadius: 6 }} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="meeting_type"
              label="Loại cuộc họp"
              rules={[{ required: true, message: 'Vui lòng chọn loại cuộc họp' }]}
            >
              <Select style={{ borderRadius: 6 }}>
                {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
                  <Select.Option key={key} value={key}>
                    <Tag color={MEETING_TYPE_COLORS[key]} style={{ marginRight: 6 }}>
                      {label}
                    </Tag>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="location"
              label="Địa điểm / Phòng họp"
            >
              <AutoComplete
                options={locationOptions}
                placeholder="Chọn phòng họp hoặc nhập địa điểm..."
                filterOption={(inputValue, option: any) =>
                  ((option?.value || '').toUpperCase().indexOf(inputValue.toUpperCase()) !== -1)
                }
                allowClear
                style={{ width: '100%', borderRadius: 6 }}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="date"
              label="Ngày họp"
              rules={[{ required: true, message: 'Vui lòng chọn ngày họp' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
            </Form.Item>

            <Form.Item
              name="start_time"
              label="Giờ bắt đầu"
              rules={[{ required: true, message: 'Vui lòng chọn giờ bắt đầu' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%', borderRadius: 6 }} />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label="Mô tả / Nội dung chi tiết cuộc họp"
          >
            <Input.TextArea
              rows={3}
              placeholder="Nhập nội dung, chương trình làm việc, mục đích hoặc tài liệu chuẩn bị..."
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Thành viên tham gia</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Đã chọn: <strong style={{ color: '#2563eb' }}>{modalParticipantIds.length}</strong> người
                </span>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Button
                  type="primary"
                  ghost
                  icon={<TeamOutlined />}
                  onClick={() => setParticipantModalOpen(true)}
                  style={{ borderRadius: 6 }}
                >
                  👥 Chọn người tham gia theo phòng ban
                </Button>
              </div>

              {modalParticipantIds.length > 0 ? (
                <div
                  style={{
                    maxHeight: 130,
                    overflowY: 'auto',
                    padding: 10,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {modalParticipantIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    return (
                      <Tag
                        key={id}
                        closable
                        onClose={() => setModalParticipantIds((prev) => prev.filter((p) => p !== id))}
                        color="geekblue"
                        style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
                      >
                        {emp?.full_name || id}
                      </Tag>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                  Chưa có người tham gia nào được chọn. Nhấn nút phía trên để chọn theo phòng ban.
                </div>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {canApprove && selectedRowKeys.length > 0 && editingId === null && (
        <div
          style={{
            position: 'fixed',
            bottom: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Typography.Text strong>Đã chọn {selectedRowKeys.length} lịch họp</Typography.Text>
          <Button icon={<CheckOutlined />} type="primary" onClick={handleBatchApprove} loading={batchLoading}>
            Duyệt
          </Button>
          <Button icon={<CloseOutlined />} danger onClick={() => setBatchRejectOpen(true)} loading={batchLoading}>
            Từ chối
          </Button>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>
            Bỏ chọn
          </Button>
        </div>
      )}

      <Modal
        title={`Từ chối hàng loạt (${selectedRowKeys.length} lịch họp)`}
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
          placeholder="Nhập lý do từ chối (dùng chung cho tất cả)"
          rows={3}
          value={batchRejectReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        title="Chi tiết lịch họp"
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailMeeting(null);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {canManage && detailMeeting && detailMeeting.status !== 'cancelled' && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    const m = detailMeeting;
                    setDetailOpen(false);
                    openEditModal(m);
                  }}
                >
                  Chỉnh sửa cuộc họp
                </Button>
              )}
            </div>
            <Button onClick={() => setDetailOpen(false)}>Đóng</Button>
          </div>
        }
        width={600}
      >
        {detailMeeting && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Tiêu đề">{detailMeeting.title}</Descriptions.Item>
            <Descriptions.Item label="Loại họp">
              <Tag color={MEETING_TYPE_COLORS[detailMeeting.meeting_type]}>
                {MEETING_TYPE_LABELS[detailMeeting.meeting_type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày">
              {detailMeeting.date ? dayjs(detailMeeting.date).format('DD/MM/YYYY') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Giờ">{detailMeeting.start_time?.substring(0, 5) || '-'}</Descriptions.Item>
            <Descriptions.Item label="Địa điểm">{detailMeeting.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{detailMeeting.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{detailMeeting.department_name || 'Tất cả'}</Descriptions.Item>
            <Descriptions.Item label="Người tạo">{detailMeeting.created_by_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={MEETING_STATUS_COLORS[detailMeeting.status]}>
                {MEETING_STATUS_LABELS[detailMeeting.status]}
              </Tag>
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
                    <Tag key={p.id} color="blue">
                      {p.employee_name || 'Unknown'}
                    </Tag>
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
