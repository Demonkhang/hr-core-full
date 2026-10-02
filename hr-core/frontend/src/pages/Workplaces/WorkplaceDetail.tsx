import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, message, Typography, Descriptions, Card } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { workplaceService } from '@/services/workplaceService';
import { departmentService } from '@/services/departmentService';
import type { Workplace } from '@/types/workplace';
import type { Department } from '@/types/department';
import { ERROR_MESSAGES, LABELS } from '@/utils/constants';
import { useSetPageTitle } from '@/components/Layout/AppLayout';

export function WorkplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workplace, setWorkplace] = useState<Workplace | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [wp, depts] = await Promise.all([
        workplaceService.get(id),
        departmentService.list(),
      ]);
      setWorkplace(wp);
      setDepartments(depts.filter((d: Department) => d.is_active));
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useSetPageTitle(workplace ? workplace.name : 'Đang tải...');

  if (loading) {
    return <Typography.Text>Đang tải...</Typography.Text>;
  }

  if (!workplace) {
    return <Typography.Text>Không tìm thấy nơi làm việc</Typography.Text>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workplaces')}>Quay lại</Button>
      </div>

      <Card className="card-mb-16">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Mã">{workplace.code}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{workplace.address || '—'}</Descriptions.Item>
          <Descriptions.Item label="Làm giờ hành chính">
            {workplace.is_office_hours ? <Tag color="green">{LABELS.YES}</Tag> : <Tag color="red">{LABELS.NO}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {workplace.is_active ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
