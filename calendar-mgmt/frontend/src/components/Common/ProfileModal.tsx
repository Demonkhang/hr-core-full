import { Modal, Descriptions, Tag, Typography } from 'antd';
import type { UserInfo } from '@/types/auth';
import { SCOPE_LABELS, SCOPE_COLORS } from '@/utils/constants';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  currentUser?: UserInfo | null;
}

export function ProfileModal({ open, onClose, currentUser }: ProfileModalProps) {
  return (
    <Modal title="Thông tin cá nhân" open={open} onCancel={onClose} footer={null} width={480}>
      {currentUser && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Tên đăng nhập">{currentUser.username}</Descriptions.Item>
          <Descriptions.Item label="Họ tên">{currentUser.full_name}</Descriptions.Item>
          <Descriptions.Item label="Email">{currentUser.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Phạm vi">
            <Tag color={SCOPE_COLORS[currentUser.permissions?.scope]}>
              {SCOPE_LABELS[currentUser.permissions?.scope] || currentUser.permissions?.scope}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Quản trị viên">
            {currentUser.is_super_admin ? <Tag color="red">Có</Tag> : 'Không'}
          </Descriptions.Item>
        </Descriptions>
      )}
      {!currentUser && (
        <Typography.Text type="secondary">Không có thông tin người dùng</Typography.Text>
      )}
    </Modal>
  );
}
