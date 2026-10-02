import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, message, Typography, Modal, Form, Input, Switch, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, LockOutlined, DeleteOutlined } from '@ant-design/icons';
import { userService, type UserListItem, type UserUpdateData } from '@/services/userService';
import { ERROR_MESSAGES, LABELS, PERMISSIONS } from '@/utils/constants';
import { PermGate } from '@/components/Common/PermGate';

/** Trang quản lý người dùng, hiển thị danh sách tài khoản và thao tác sửa/đặt lại mật khẩu/khoá */
export function UserList() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  /** Tải danh sách người dùng */
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await userService.list();
      setUsers(data);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /** Mở modal sửa thông tin người dùng */
  const handleEdit = (record: UserListItem) => {
    setSelectedUser(record);
    editForm.setFieldsValue({
      full_name: record.full_name,
      email: record.email,
      is_super_admin: record.is_super_admin,
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  /** Lưu thay đổi thông tin người dùng */
  const handleEditSave = async () => {
    if (!selectedUser) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await userService.update(selectedUser.id, {
        full_name: values.full_name,
        email: values.email,
        is_super_admin: values.is_super_admin,
        is_active: values.is_active,
      });
      message.success('Cập nhật thông tin thành công');
      setModalOpen(false);
      await fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  /** Mở modal đặt lại mật khẩu cho người dùng */
  const handleResetPassword = (record: UserListItem) => {
    setSelectedUser(record);
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };

  /** Lưu mật khẩu mới cho người dùng */
  const handlePasswordSave = async () => {
    if (!selectedUser) return;
    try {
      const values = await pwdForm.validateFields();
      setSaving(true);
      await userService.resetPassword(selectedUser.id, values.new_password);
      message.success('Đặt lại mật khẩu thành công');
      setPwdModalOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi đặt mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  /** Bật/tắt trạng thái hoạt động của người dùng */
  const handleToggleActive = async (record: UserListItem) => {
    try {
      await userService.update(record.id, { is_active: !record.is_active });
      message.success(record.is_active ? 'Đã ngưng người dùng' : 'Đã kích hoạt người dùng');
      await fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi cập nhật trạng thái');
    }
  };

  const columns = useMemo(() => [
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'username', width: 130, sorter: (a: UserListItem, b: UserListItem) => (a.username || '').localeCompare(b.username || '') },
    { title: 'Họ tên', dataIndex: 'full_name', key: 'full_name', width: 160, sorter: (a: UserListItem, b: UserListItem) => (a.full_name || '').localeCompare(b.full_name || '') },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 190, sorter: (a: UserListItem, b: UserListItem) => (a.email || '').localeCompare(b.email || '') },
    {
      title: 'Quản trị', dataIndex: 'is_super_admin', key: 'is_super_admin', width: 90,
      sorter: (a: UserListItem, b: UserListItem) => Number(a.is_super_admin) - Number(b.is_super_admin),
      render: (v: boolean) => v ? <Tag color="red">Admin</Tag> : <Tag>—</Tag>,
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'active', width: 110,
      sorter: (a: UserListItem, b: UserListItem) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean) => v ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>,
    },
    {
      title: 'Đăng nhập cuối', dataIndex: 'last_login', key: 'last_login', width: 170,
      sorter: (a: UserListItem, b: UserListItem) => (a.last_login || '').localeCompare(b.last_login || ''),
      render: (v: string | null) => v ? new Date(v).toLocaleString('vi-VN') : 'Chưa đăng nhập',
    },
    {
      title: 'Thao tác', key: 'actions', width: 160, fixed: 'right' as const,
      render: (_: any, record: UserListItem) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Đặt lại mật khẩu?" onConfirm={() => handleResetPassword(record)} okText="Đặt lại" cancelText="Huỷ">
            <Button type="link" size="small" icon={<LockOutlined />} />
          </Popconfirm>
          <Popconfirm
            title={record.is_active ? 'Ngưng người dùng này?' : 'Kích hoạt người dùng này?'}
            onConfirm={() => handleToggleActive(record)}
            okText={LABELS.YES}
            cancelText={LABELS.CANCEL}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleEdit, handleResetPassword, handleToggleActive]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      </div>
      <PermGate perms={[PERMISSIONS.CAN_MANAGE_USERS]}>
        <Table dataSource={users} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} />
      </PermGate>

      <Modal
        title={selectedUser ? `Sửa người dùng: ${selectedUser.full_name}` : ''}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleEditSave}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        width={450}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="full_name" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="is_super_admin" label="Quản trị viên" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedUser ? `Đặt lại mật khẩu: ${selectedUser.full_name}` : ''}
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        onOk={handlePasswordSave}
        confirmLoading={saving}
        okText="Đặt lại"
        cancelText="Huỷ"
        width={450}
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="new_password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Nhập lại mật khẩu"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng nhập lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Mật khẩu không khớp'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
