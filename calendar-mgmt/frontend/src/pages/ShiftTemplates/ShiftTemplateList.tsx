import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Input, Select, TimePicker, Switch, Tag, message, Typography, ColorPicker, Space, Popconfirm, Tooltip, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { workplaceService } from '@/services/workplaceService';
import { shiftTemplateService } from '@/services/shiftTemplateService';
import type { ShiftTemplate } from '@/types/schedule';
import type { Workplace } from '@/types/workplace';
import type { Department } from '@/types/department';
import { PermGate } from '@/components/Common/PermGate';
import dayjs from 'dayjs';
import { ERROR_MESSAGES, DATE_FORMATS, COLORS, LABELS, PERMISSIONS } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

export function ShiftTemplateList() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [temps, wps, depts] = await Promise.all([
        shiftTemplateService.list(),
        workplaceService.list(),
        departmentService.list(),
      ]);
      setTemplates(temps);
      setWorkplaces(wps);
      setDepartments(depts);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const addNew = useCallback(() => {
    if (addingNew || editingId) return;
    form.resetFields();
    form.setFieldsValue({
      workplace_id: undefined,
      department_ids: [],
      name: '',
      start_time: dayjs('08:00', DATE_FORMATS.TIME_HH_MM),
      end_time: dayjs('17:00', DATE_FORMATS.TIME_HH_MM),
      is_overnight: false,
      color: COLORS.PRIMARY_BLUE,
    });
    setAddingNew(true);
    setEditingId('__new__');
  }, [addingNew, editingId, form]);

  useKeyboardShortcut('n', addNew, !addingNew && !editingId);

  const cancel = () => {
    setEditingId(null);
    setAddingNew(false);
    form.resetFields();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId) cancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingId, cancel]);

  const startEdit = (record: ShiftTemplate) => {
    if (addingNew || editingId) return;
    form.setFieldsValue({
      workplace_id: record.workplace_id,
      department_ids: record.department_ids,
      name: record.name,
      start_time: dayjs(record.start_time, DATE_FORMATS.TIME_HH_MM_SS),
      end_time: dayjs(record.end_time, DATE_FORMATS.TIME_HH_MM_SS),
      is_overnight: record.is_overnight,
      color: record.color,
    });
    setEditingId(record.id);
    setAddingNew(false);
  };

  const handleSave = async (id: string) => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        start_time: values.start_time.format(DATE_FORMATS.TIME_HH_MM_SS),
        end_time: values.end_time.format(DATE_FORMATS.TIME_HH_MM_SS),
        color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || COLORS.PRIMARY_BLUE,
      };
      if (id === '__new__') {
        await shiftTemplateService.create(payload);
        message.success('Thêm ca mẫu thành công');
      } else {
        await shiftTemplateService.update(id, payload);
        message.success('Cập nhật ca mẫu thành công');
      }
      setEditingId(null);
      setAddingNew(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || ERROR_MESSAGES.SAVE_FAILED);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await shiftTemplateService.deactivate(id);
      message.success('Đã ngưng ca mẫu');
      fetchData();
    } catch {
      message.error('Không thể ngưng ca mẫu');
    }
  };

  const isEditing = (record: ShiftTemplate) => record.id === editingId;

  const columns = useMemo(() => [
    {
      title: 'Tên ca', dataIndex: 'name', key: 'name', width: 150,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => (a.name || '').localeCompare(b.name || ''),
      render: (_: string, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return <Form.Item name="name" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><Input /></Form.Item>;
        }
        return record.name;
      },
    },
    {
      title: 'Nơi làm việc', dataIndex: 'workplace_name', key: 'wp', width: 160,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => (a.workplace_name || '').localeCompare(b.workplace_name || ''),
      render: (_: string, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="workplace_id" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}>
              <Select options={workplaces.filter((w) => w.is_active).map((w) => ({ label: w.name, value: w.id }))} />
            </Form.Item>
          );
        }
        return record.workplace_name;
      },
    },
    {
      title: 'Phòng ban', dataIndex: 'department_names', key: 'dept', width: 200,
      render: (_: string[], record: ShiftTemplate) => {
        if (isEditing(record)) {
          return (
            <Form.Item name="department_ids" style={{ margin: 0 }}>
              <Select mode="multiple" placeholder="Chọn phòng ban" maxTagCount="responsive"
                options={departments.filter((d) => d.is_active).map((d) => ({ label: d.name, value: d.id }))}
              />
            </Form.Item>
          );
        }
        const names = record.department_names?.filter(Boolean);
        return names?.length ? names.join(', ') : <span style={{ color: '#999' }}>Tất cả</span>;
      },
    },
    {
      title: 'Giờ bắt đầu', dataIndex: 'start_time', key: 'start', width: 120,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => (a.start_time || '').localeCompare(b.start_time || ''),
      render: (v: string, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return <Form.Item name="start_time" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><TimePicker format={DATE_FORMATS.TIME_HH_MM} style={{ width: '100%' }} /></Form.Item>;
        }
        return v?.slice(0, 5);
      },
    },
    {
      title: 'Giờ kết thúc', dataIndex: 'end_time', key: 'end', width: 120,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => (a.end_time || '').localeCompare(b.end_time || ''),
      render: (v: string, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return <Form.Item name="end_time" style={{ margin: 0 }} rules={[{ required: true, message: '' }]}><TimePicker format={DATE_FORMATS.TIME_HH_MM} style={{ width: '100%' }} /></Form.Item>;
        }
        return v?.slice(0, 5);
      },
    },
    {
      title: 'Qua đêm', dataIndex: 'is_overnight', key: 'overnight', width: 100,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => Number(a.is_overnight) - Number(b.is_overnight),
      render: (v: boolean, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return <Form.Item name="is_overnight" style={{ margin: 0 }} valuePropName="checked"><Switch /></Form.Item>;
        }
        return v ? <Tag color="purple">{LABELS.YES}</Tag> : <Tag>{LABELS.NO}</Tag>;
      },
    },
    {
      title: 'Màu', dataIndex: 'color', key: 'color', width: 80,
      sorter: (a: ShiftTemplate, b: ShiftTemplate) => (a.color || '').localeCompare(b.color || ''),
      render: (c: string, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return <Form.Item name="color" style={{ margin: 0 }}><ColorPicker size="small" /></Form.Item>;
        }
        return <div style={{ width: 24, height: 24, background: c, borderRadius: 4, border: '1px solid #d9d9d9' }} />;
      },
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_: any, record: ShiftTemplate) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleSave(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} disabled={editingId !== null} onClick={() => startEdit(record)} />
              {record.is_active && (
                <Popconfirm title="Ngưng ca mẫu này?" onConfirm={() => handleDeactivate(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingId !== null} />
                </Popconfirm>
              )}
            </Space>
          </PermGate>
        );
      },
    },
  ], [editingId, workplaces]);

  const newRow: ShiftTemplate = {
    id: '__new__',
    workplace_id: '',
    department_ids: [],
    name: '',
    start_time: '',
    end_time: '',
    is_overnight: false,
    color: COLORS.PRIMARY_BLUE,
    is_active: true,
    workplace_name: null,
    department_names: [],
    created_at: null,
    updated_at: null,
  };

  const dataSource = addingNew ? [newRow, ...templates] : templates;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={addNew} disabled={editingId !== null}>
              Thêm ca mẫu
            </Button>
          </Tooltip>
        </PermGate>
      </div>

      <Form form={form} component={false}>
        <Table dataSource={dataSource} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Form>
    </div>
  );
}
