import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Table, Button, Form, Input, InputRef, Select, Tag, message, Typography, Space, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { departmentService } from '@/services/departmentService';
import { employeeService } from '@/services/employeeService';
import type { Department } from '@/types/department';
import type { Employee } from '@/types/employee';
import { PermGate } from '@/components/Common/PermGate';
import { ERROR_MESSAGES, LABELS, FIELD_NAMES, PERMISSIONS } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import '@/styles/table.css';

/** Trang quản lý phòng ban, hiển thị danh sách và thao tác thêm/sửa/xoá */
export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string>('');
  const [addingNew, setAddingNew] = useState(false);
  const [form] = Form.useForm();
  const inputRef = useRef<InputRef>(null);

  /** Tải danh sách phòng ban và nhân sự (để chọn lãnh đạo) */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [depts, emps] = await Promise.all([
        departmentService.list(false),
        employeeService.list({ active_only: true }),
      ]);
      setDepartments(depts);
      setEmployees(emps);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const isEditing = (record: Department) => record.id === editingKey;

  const employeeOptions = useMemo(
    () => employees.map((e) => ({
      value: e.id,
      label: e.employee_code ? `${e.full_name} (${e.employee_code})` : e.full_name,
    })),
    [employees]
  );

  /** Mở chế độ sửa cho một phòng ban */
  const edit = (record: Department) => {
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description,
      head_id: record.head_id ?? undefined,
    });
    setEditingKey(record.id);
  };

  /** Huỷ thao tác thêm/sửa phòng ban */
  const cancel = () => {
    setEditingKey('');
    setAddingNew(false);
    form.resetFields();
  };

  /** Lưu phòng ban (thêm mới hoặc cập nhật) */
  const save = async (key: string) => {
    try {
      const row = await form.validateFields();
      if (key === '__new__') {
        await departmentService.create(row);
        message.success('Thêm phòng ban thành công');
      } else {
        await departmentService.update(key, row);
        message.success('Cập nhật phòng ban thành công');
      }
      setEditingKey('');
      setAddingNew(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    }
  };

  /** Xoá (ngưng) phòng ban */
  const handleDelete = async (id: string) => {
    try {
      await departmentService.deactivate(id);
      message.success('Đã xoá phòng ban');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể xoá phòng ban');
    }
  };

  /** Mở form thêm phòng ban mới */
  const addNew = () => {
    if (addingNew) return;
    setAddingNew(true);
    setEditingKey('__new__');
    form.resetFields();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useKeyboardShortcut('n', addNew, editingKey === '');

  const columns = useMemo(() => [
    {
      title: 'Mã', dataIndex: 'code', key: 'code', width: 120,
      sorter: (a: Department, b: Department) => (a.code || '').localeCompare(b.code || ''),
      render: (_: any, record: Department) => {
        if (!isEditing(record)) return <span>{record.code}</span>;
        return (
          <Form.Item name="code" rules={[{ required: true, message: 'Nhập mã phòng ban' }]} className="table-form-item">
            <Input placeholder="VD: OFFICE" />
          </Form.Item>
        );
      },
    },
    {
      title: 'Tên phòng ban', dataIndex: 'name', key: 'name',
      sorter: (a: Department, b: Department) => (a.name || '').localeCompare(b.name || ''),
      render: (_: any, record: Department) => {
        if (!isEditing(record)) return <span>{record.name}</span>;
        return (
          <Form.Item name="name" rules={[{ required: true, message: 'Nhập tên phòng ban' }]} className="table-form-item">
            <Input ref={editingKey === '__new__' ? inputRef : undefined} />
          </Form.Item>
        );
      },
    },
    {
      title: 'Mô tả', dataIndex: 'description', key: 'description',
      sorter: (a: Department, b: Department) => (a.description || '').localeCompare(b.description || ''),
      render: (_: any, record: Department) => {
        if (!isEditing(record)) return <span>{record.description || '-'}</span>;
        return (
          <Form.Item name="description" className="table-form-item">
            <Input placeholder="Mô tả (không bắt buộc)" />
          </Form.Item>
        );
      },
    },
    {
      title: 'Nhân viên', dataIndex: 'employee_count', key: 'employee_count', width: 100,
      sorter: (a: Department, b: Department) => (a.employee_count || 0) - (b.employee_count || 0),
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Lãnh đạo', dataIndex: 'head', key: 'head', width: 220,
      render: (_: any, record: Department) => {
        if (!isEditing(record)) {
          return record.head
            ? <span>{record.head.employee_code ? `${record.head.full_name} (${record.head.employee_code})` : record.head.full_name}</span>
            : <span style={{ color: '#94a3b8' }}>-</span>;
        }
        return (
          <Form.Item name="head_id" className="table-form-item">
            <Select
              showSearch
              allowClear
              placeholder="Chọn lãnh đạo"
              optionFilterProp="label"
              options={employeeOptions}
            />
          </Form.Item>
        );
      },
    },
    {
      title: 'Trạng thái', dataIndex: FIELD_NAMES.IS_ACTIVE, key: FIELD_NAMES.IS_ACTIVE, width: 110,
      sorter: (a: Department, b: Department) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean) => v ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 160,
      render: (_: any, record: Department) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => save(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} disabled={editingKey !== ''} onClick={() => edit(record)} />
              {record.is_active && (
                <Popconfirm title="Xoá phòng ban này?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={editingKey !== ''} />
                </Popconfirm>
              )}
            </Space>
          </PermGate>
        );
      },
    },
  ], [editingKey]);

  const dataSource = addingNew
    ? [{ id: '__new__', name: '', code: '', description: '', is_active: true, head_id: null, head: null, employee_count: 0, created_at: null, updated_at: null }, ...departments]
    : departments;

  return (
    <div>
      <div className="page-header">
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={addNew} disabled={editingKey !== ''}>
              Thêm phòng ban
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
