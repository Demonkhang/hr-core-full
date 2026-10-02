import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Input, Switch, message, Typography, Tag, Space, Popconfirm, Tooltip, Form } from 'antd';
import { Link } from 'react-router-dom';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { workplaceService } from '@/services/workplaceService';
import type { Workplace } from '@/types/workplace';
import { useAuthStore } from '@/store/authStore';
import { PermGate } from '@/components/Common/PermGate';
import { ERROR_MESSAGES, LABELS, FIELD_NAMES, PERMISSIONS } from '@/utils/constants';
import { ROUTES } from '@/utils/routes';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import '@/styles/table.css';

interface EditableRow {
  key: string;
  isNew?: boolean;
  id?: string;
  name: string;
  code: string;
  address: string;
  is_office_hours: boolean;
  is_active: boolean;
}

/** Trang quản lý nơi làm việc, hiển thị danh sách và thao tác thêm/sửa/xoá */
export function WorkplaceList() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);

  /** Tải danh sách nơi làm việc */
  const fetchData = async () => {
    setLoading(true);
    try {
      const wps = await workplaceService.list();
      setWorkplaces(wps);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /** Mở form thêm nơi làm việc mới */
  const openAdd = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ name: '', code: '', address: '', is_office_hours: false });
    setAdding(true);
    setEditingId('new');
  }, []);

  useKeyboardShortcut('n', openAdd, !adding);

  /** Lưu nơi làm việc (thêm mới hoặc cập nhật) */
  const handleSave = async (id: string) => {
    try {
      const values = await form.validateFields();
      if (id === 'new') {
        await workplaceService.create(values);
        message.success('Thêm nơi làm việc thành công');
      } else {
        await workplaceService.update(id, values);
        message.success('Cập nhật nơi làm việc thành công');
      }
      setEditingId(null);
      setAdding(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || ERROR_MESSAGES.SAVE_FAILED);
    }
  };

  /** Huỷ thao tác thêm/sửa nơi làm việc */
  const handleCancel = () => {
    setEditingId(null);
    setAdding(false);
    form.resetFields();
  };

  /** Ngưng kích hoạt nơi làm việc */
  const handleDeactivate = async (id: string) => {
    try {
      await workplaceService.deactivate(id);
      message.success('Đã ngưng nơi làm việc');
      fetchData();
    } catch {
      message.error('Không thể ngưng nơi làm việc');
    }
  };

  /** Mở chế độ sửa cho một nơi làm việc */
  const startEdit = (record: Workplace) => {
    form.setFieldsValue(record);
    setEditingId(record.id);
    setAdding(false);
  };

  const isEditing = (id: string) => editingId === id;

  const columns = useMemo(() => [
    {
      title: 'Mã', dataIndex: 'code', key: 'code', width: 100,
      sorter: (a: Workplace, b: Workplace) => (a.code || '').localeCompare(b.code || ''),
      render: (_: string, record: Workplace) => {
        if (isEditing(record.id)) {
          return <Form.Item name="code" className="table-form-item"><Input /></Form.Item>;
        }
        return record.code;
      },
    },
    {
      title: 'Tên nơi làm việc', dataIndex: 'name', key: 'name', width: 200,
      sorter: (a: Workplace, b: Workplace) => (a.name || '').localeCompare(b.name || ''),
      render: (_: string, record: Workplace) => {
        if (isEditing(record.id)) {
          return <Form.Item name="name" className="table-form-item" rules={[{ required: true, message: '' }]}><Input /></Form.Item>;
        }
        return <Link to={ROUTES.WORKPLACE_DETAIL(record.id)}>{record.name}</Link>;
      },
    },
    {
      title: 'Địa chỉ', dataIndex: 'address', key: 'address', width: 250, ellipsis: true,
      sorter: (a: Workplace, b: Workplace) => (a.address || '').localeCompare(b.address || ''),
      render: (_: string, record: Workplace) => {
        if (isEditing(record.id)) {
          return <Form.Item name="address" className="table-form-item"><Input /></Form.Item>;
        }
        return record.address;
      },
    },
    {
      title: 'Làm giờ hành chính', dataIndex: FIELD_NAMES.IS_OFFICE_HOURS, key: 'office', width: 130,
      sorter: (a: Workplace, b: Workplace) => Number(a.is_office_hours) - Number(b.is_office_hours),
      render: (_: boolean, record: Workplace) => {
        if (isEditing(record.id)) {
          return <Form.Item name={FIELD_NAMES.IS_OFFICE_HOURS} className="table-form-item" valuePropName="checked"><Switch /></Form.Item>;
        }
        return record.is_office_hours ? <Tag color="green">{LABELS.YES}</Tag> : <Tag color="red">{LABELS.NO}</Tag>;
      },
    },
    {
      title: 'Trạng thái', dataIndex: FIELD_NAMES.IS_ACTIVE, key: 'active', width: 100,
      sorter: (a: Workplace, b: Workplace) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean) => v ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_: any, record: Workplace) => {
        if (isEditing(record.id)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleSave(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEdit(record)} />
              {record.is_active && (
                <Popconfirm title="Ngưng nơi làm việc này?" onConfirm={() => handleDeactivate(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>
          </PermGate>
        );
      },
    },
  ], [editingId]);

  const newRow: EditableRow = {
    key: 'new',
    id: 'new',
    name: '',
    code: '',
    address: '',
    is_office_hours: false,
    is_active: true,
    isNew: true,
  };

  const dataSource = adding ? [newRow as any, ...workplaces] : workplaces;

  return (
    <div>
      <div className="page-header">
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={adding}>
              Thêm nơi làm việc
            </Button>
          </Tooltip>
        </PermGate>
      </div>

      <Form form={form} component={false}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Form>
    </div>
  );
}
