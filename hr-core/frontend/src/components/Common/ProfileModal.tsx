import { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Switch, Button, message, Typography } from 'antd';
import type { UserInfo } from '@/types/auth';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  currentUser?: UserInfo | null;
}

export function ProfileModal({ open, onClose, currentUser }: ProfileModalProps) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('info');
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    if (open) {
      profileForm.setFieldsValue({
        full_name: currentUser?.full_name || '',
        email: currentUser?.email || '',
        is_super_admin: currentUser?.is_super_admin || false,
      });
      pwdForm.resetFields();
      setTab('info');
    }
  }, [open, currentUser, profileForm, pwdForm]);

  const handleSaveInfo = async () => {
    if (!currentUser) return;
    try {
      setSaving(true);
      const values = await profileForm.validateFields();
      await userService.update(currentUser!.id, {
        full_name: values.full_name,
        email: values.email,
      });
      const updated = await authService.getMe();
      useAuthStore.setState({ user: updated });
      message.success('Cập nhật thông tin thành công');
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setSaving(true);
      const values = await pwdForm.validateFields();
      await authService.changePassword(values.old_password, values.new_password);
      message.success('Đổi mật khẩu thành công');
      pwdForm.resetFields();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi đổi mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Thông tin cá nhân" open={open} onCancel={onClose} footer={null} width={480}>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {
          key: 'info',
          label: 'Thông tin cá nhân',
          children: (
            <Form form={profileForm} layout="vertical" style={{ marginTop: 8 }}>
              <Form.Item label="Tên đăng nhập">
                <Typography.Text>{currentUser?.username}</Typography.Text>
              </Form.Item>
              <Form.Item name="full_name" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="is_super_admin" label="Quản trị viên" valuePropName="checked">
                <Switch disabled />
              </Form.Item>
              <Button type="primary" loading={saving} onClick={handleSaveInfo}>
                Lưu thông tin
              </Button>
            </Form>
          ),
        },
        {
          key: 'password',
          label: 'Mật khẩu',
          children: (
            <Form form={pwdForm} layout="vertical" style={{ marginTop: 8 }}>
              <Form.Item name="old_password" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="new_password" label="Mật khẩu mới" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
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
              <Button type="primary" loading={saving} onClick={handleChangePassword}>
                Đổi mật khẩu
              </Button>
            </Form>
          ),
        },
      ]} />
    </Modal>
  );
}
