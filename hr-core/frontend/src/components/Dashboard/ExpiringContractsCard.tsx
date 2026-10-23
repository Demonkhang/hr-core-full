import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, Space, Empty } from 'antd';
import {
  FileTextOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import type { Contract } from '@/types/contract';
import { ROUTES } from '@/utils/constants';

export function ExpiringContractsCard() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contractService
      .list({ expiry_window: '30_days' })
      .then((data) => {
        // Lọc lấy các HĐ sắp hết hạn trong 30 ngày hoặc quá hạn
        const sorted = data
          .filter((c) => c.end_date && (c.status === 'active' || c.status === 'pending_renewal'))
          .sort((a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999))
          .slice(0, 5); // top 5
        setContracts(sorted);
      })
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: 'Nhân viên',
      dataIndex: 'employee_name',
      key: 'employee_name',
      render: (v: string | null, r: Contract) => (
        <div>
          <strong style={{ color: '#0f172a' }}>{v || '-'}</strong>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.department_name || r.job_title || ''}</div>
        </div>
      ),
    },
    {
      title: 'Số hợp đồng',
      dataIndex: 'contract_number',
      key: 'contract_number',
      render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Thời hạn còn lại',
      key: 'days_remaining',
      render: (_: any, r: Contract) => {
        const d = r.days_remaining;
        if (d === undefined || d === null) return '-';
        if (d < 0) {
          return (
            <Tag color="#ef4444" style={{ fontWeight: 700 }}>
              <WarningOutlined style={{ marginRight: 3 }} />
              Quá hạn {Math.abs(d)} ngày
            </Tag>
          );
        }
        if (d <= 15) {
          return (
            <Tag color="#dc2626" style={{ fontWeight: 700 }}>
              <ExclamationCircleOutlined style={{ marginRight: 3 }} />
              Còn {d} ngày
            </Tag>
          );
        }
        return (
          <Tag color="#ea580c" style={{ fontWeight: 600 }}>
            Còn {d} ngày
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'action',
      render: (_: any, r: Contract) => (
        <Button
          size="small"
          type="link"
          onClick={() => navigate(ROUTES.CONTRACTS)}
          style={{ padding: 0, color: '#7c3aed', fontWeight: 500 }}
        >
          Xử lý
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined style={{ color: '#ea580c' }} />
          <span>Hợp đồng sắp hết hạn (30 ngày tới)</span>
          {contracts.length > 0 && (
            <Tag color="error" style={{ borderRadius: 10, fontWeight: 700 }}>
              {contracts.length}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Button
          type="link"
          onClick={() => navigate(ROUTES.CONTRACTS)}
          style={{ padding: 0, color: '#7c3aed' }}
        >
          Xem tất cả <ArrowRightOutlined />
        </Button>
      }
      size="small"
      style={{ borderRadius: 12, height: '100%' }}
    >
      {contracts.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 32, color: '#10b981', marginBottom: 8 }} />
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            Tất cả hợp đồng lao động đều còn hiệu lực an toàn
          </Typography.Paragraph>
        </div>
      ) : (
        <Table
          dataSource={contracts}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      )}
    </Card>
  );
}
