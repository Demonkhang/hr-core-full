import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Checkbox, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { setAccessToken, setRefreshToken } from '@/store/tokenManager';
import { ROUTES, SUCCESS_MESSAGES, COLORS, ERROR_MESSAGES } from '@/utils/constants';

/** Trang đăng nhập, hiển thị form đăng nhập và modal đổi mật khẩu nếu cần */
export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [loginValues, setLoginValues] = useState<{ username: string; password: string; remember_me: boolean } | null>(null);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  /** Xử lý đăng nhập, kiểm tra must_change_password để chuyển sang modal đổi mật khẩu */
  const handleSubmit = async (values: { username: string; password: string; remember_me: boolean }) => {
    setLoading(true);
    try {
      await login(values.username, values.password, values.remember_me);
      const user = useAuthStore.getState().user;
      if (user?.must_change_password) {
        setLoginValues(values);
        setTempPassword(values.password);
        setPasswordModalOpen(true);
        return;
      }
      message.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
      navigate(ROUTES.HOME);
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Login error response:', err?.response);
      console.error('Login error response data:', err?.response?.data);
      message.error(err?.response?.data?.detail || err?.message || ERROR_MESSAGES.LOGIN_FAILED);
    } finally {
      setLoading(false);
    }
  };

  /** Hủy modal đổi mật khẩu: xóa token và state để user phải đăng nhập lại */
  const handleCancelPasswordModal = async () => {
    setPasswordModalOpen(false);
    setLoginValues(null);
    setTempPassword('');
    // Xóa tokens ngay lập tức (không qua API vì có thể user chưa thay đổi mật khẩu)
    setAccessToken(null);
    setRefreshToken(null);
    // Reset auth store state
    useAuthStore.setState({ user: null, isAuthenticated: false });
    message.info('Bạn cần đổi mật khẩu trước khi sử dụng hệ thống. Vui lòng đăng nhập lại.');
  };

  /** Xử lý đổi mật khẩu bắt buộc khi tài khoản lần đầu đăng nhập */
  const handleForceChangePassword = async (values: { new_password: string }) => {
    if (!loginValues) return;
    setPasswordModalLoading(true);
    try {
      await authService.changePassword(tempPassword, values.new_password);
      message.success('Đã đổi mật khẩu thành công');
      setLoginValues(null);
      setTempPassword('');
      setPasswordModalOpen(false);
      navigate(ROUTES.HOME);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg || detail[0] : detail;
      message.error(msg || 'Đổi mật khẩu thất bại');
    } finally {
      setPasswordModalLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: COLORS.LOGIN_BG,
      }}
    >
      <Card style={{ width: 400 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={3}>HR Core</Typography.Title>
            <Typography.Text type="secondary">Quản lý nhân sự</Typography.Text>
          </div>
          <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
            <Form.Item name="username" rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}>
              <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
            </Form.Item>
            <Form.Item name="remember_me" valuePropName="checked">
              <Checkbox>Duy trì đăng nhập</Checkbox>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>

      <Modal
        title="Yêu cầu đổi mật khẩu"
        open={passwordModalOpen}
        onCancel={handleCancelPasswordModal}
        footer={null}
        destroyOnClose
        maskClosable={false}
      >
        <Typography.Text type="warning" style={{ display: 'block', marginBottom: 16 }}>
          Bạn cần đổi mật khẩu trước khi tiếp tục. Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
        </Typography.Text>
        <Form layout="vertical" onFinish={handleForceChangePassword}>
          <Form.Item
            name="new_password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
              { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/, message: 'Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt' },
            ]}
          >
            <Input.Password placeholder="Mật khẩu mới" size="large" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Xác nhận mật khẩu"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu không khớp'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Xác nhận mật khẩu" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={passwordModalLoading}>
              Đổi mật khẩu
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
