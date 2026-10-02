import { Modal, Button, Tag, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

interface AccountModalProps {
  open: boolean;
  employeeName: string;
  username: string;
  password?: string;
  isReset?: boolean;
  onClose: () => void;
}

export function AccountModal({ open, employeeName, username, password, isReset, onClose }: AccountModalProps) {
  return (
    <Modal
      title={isReset ? 'Đã reset mật khẩu' : 'Tài khoản đã được tạo'}
      open={open}
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>Đóng</Button>}
    >
      <p><strong>Nhân viên:</strong> {employeeName}</p>
      <p><strong>Tên đăng nhập:</strong> <Tag color="blue">{username}</Tag></p>
      {password && (
        <p>
          <strong>{isReset ? 'Mật khẩu mới:' : 'Mật khẩu:'}</strong>{' '}
          <Tag color="red">••••••••</Tag>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(password || '');
              message.success('Đã sao chép mật khẩu');
            }}
          >
            Sao chép
          </Button>
        </p>
      )}
      <p style={{ color: '#999', fontSize: 12 }}>Vui lòng sao chép thông tin này và gửi cho nhân viên.</p>
    </Modal>
  );
}
