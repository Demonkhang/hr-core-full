import { Card, Space, Button } from 'antd';
import {
  UserAddOutlined, UploadOutlined, SolutionOutlined,
  ApartmentOutlined, EnvironmentOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface Props {
  onOpenImport?: () => void;
}

export function QuickActionsBar({ onOpenImport }: Props) {
  const navigate = useNavigate();

  return (
    <Card
      title="Thao tác nhanh"
      size="small"
      style={{ borderRadius: 14, marginBottom: 20 }}
      styles={{ header: { borderBottom: '1px solid rgba(140, 140, 140, 0.15)' }, body: { padding: '12px 16px' } }}
    >
      <Space wrap size={[12, 12]}>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate('/employees')}>
          Thêm nhân sự
        </Button>
        {onOpenImport && (
          <Button icon={<UploadOutlined />} onClick={onOpenImport}>
            Nhập file Excel
          </Button>
        )}
        <Button icon={<SolutionOutlined />} onClick={() => navigate('/job-positions')}>
          Định biên Vị trí
        </Button>
        <Button icon={<ApartmentOutlined />} onClick={() => navigate('/departments')}>
          Phòng ban
        </Button>
        <Button icon={<EnvironmentOutlined />} onClick={() => navigate('/workplaces')}>
          Nơi làm việc
        </Button>
        <Button icon={<AuditOutlined />} onClick={() => navigate('/audit-logs')}>
          Nhật ký hệ thống
        </Button>
      </Space>
    </Card>
  );
}
