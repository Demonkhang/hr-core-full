import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Tooltip,
  Popconfirm,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  StopOutlined,
  FilePdfOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import type { Contract } from '@/types/contract';
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
} from '@/types/contract';
import { ContractModal } from '@/components/Contracts/ContractModal';
import { ContractTerminateModal } from '@/components/Contracts/ContractTerminateModal';
import { ContractDetailModal } from '@/components/Contracts/ContractDetailModal';
import { useAuthStore } from '@/store/authStore';

interface ContractsTabProps {
  employeeId: string;
}

export function ContractsTab({ employeeId }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [renewingContract, setRenewingContract] = useState<Contract | null>(null);
  const [terminatingContract, setTerminatingContract] = useState<Contract | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);

  const user = useAuthStore((s) => s.user);
  const canManage = Boolean(user?.is_super_admin || user?.permissions?.can_manage_employees);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await contractService.list({ employee_id: employeeId });
      setContracts(data);
    } catch {
      message.error('Không thể tải lịch sử hợp đồng của nhân viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const handleDelete = async (id: string) => {
    try {
      await contractService.delete(id);
      message.success('Đã xóa hợp đồng');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể xóa hợp đồng');
    }
  };

  const columns = [
    {
      title: 'Số hợp đồng',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 160,
      render: (v: string, record: Contract) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
          {record.file_attachment_url && (
            <a href={record.file_attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#7c3aed' }}>
              <FilePdfOutlined /> Bản scan
            </a>
          )}
        </Space>
      ),
    },
    {
      title: 'Loại hợp đồng',
      dataIndex: 'contract_type',
      key: 'contract_type',
      width: 170,
      render: (v: any, record: Contract) => (
        <Tag color={CONTRACT_TYPE_COLORS[v as keyof typeof CONTRACT_TYPE_COLORS] || 'default'}>
          {CONTRACT_TYPE_LABELS[v as keyof typeof CONTRACT_TYPE_LABELS] || v}
          {record.contract_sequence && record.contract_sequence > 1 ? ` (Lần ${record.contract_sequence})` : ''}
        </Tag>
      ),
    },
    {
      title: 'Ngày hiệu lực',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 130,
      render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : <Tag color="cyan">Vô thời hạn</Tag>),
    },
    {
      title: 'Thời hạn còn lại',
      key: 'countdown',
      width: 150,
      render: (_: any, record: Contract) => {
        if (!record.end_date) return <Tag color="blue">Vô thời hạn</Tag>;
        if (record.status !== 'active' && record.status !== 'pending_renewal') {
          return <Tag color={CONTRACT_STATUS_COLORS[record.status]}>{CONTRACT_STATUS_LABELS[record.status]}</Tag>;
        }
        const days = record.days_remaining;
        if (days === undefined || days === null) return '-';
        if (days < 0) return <Tag color="#ef4444">Quá hạn {Math.abs(days)} ngày</Tag>;
        if (days <= 15) return <Tag color="#dc2626">Còn {days} ngày (Khẩn cấp)</Tag>;
        if (days <= 30) return <Tag color="#ea580c">Còn {days} ngày</Tag>;
        return <Tag color="#10b981">Còn {days} ngày</Tag>;
      },
    },
    {
      title: 'Mức lương',
      dataIndex: 'basic_salary',
      key: 'basic_salary',
      width: 130,
      render: (v: number | null) => (v ? `${Number(v).toLocaleString()} đ` : '-'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: any) => (
        <Tag color={CONTRACT_STATUS_COLORS[v as keyof typeof CONTRACT_STATUS_COLORS]} style={{ fontWeight: 600 }}>
          {CONTRACT_STATUS_LABELS[v as keyof typeof CONTRACT_STATUS_LABELS] || v}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      render: (_: any, record: Contract) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết & phụ lục">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailContract(record)}
            />
          </Tooltip>

          {canManage && (
            <>
              {record.status === 'active' && (
                <>
                  <Tooltip title="Gia hạn / Ký tiếp">
                    <Button
                      type="text"
                      size="small"
                      style={{ color: '#2563eb' }}
                      icon={<SyncOutlined />}
                      onClick={() => setRenewingContract(record)}
                    />
                  </Tooltip>
                  <Tooltip title="Chấm dứt hợp đồng">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setTerminatingContract(record)}
                    />
                  </Tooltip>
                </>
              )}

              <Tooltip title="Sửa">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditingContract(record)}
                />
              </Tooltip>

              <Popconfirm
                title="Xóa hợp đồng này?"
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record.id)}
              >
                <Tooltip title="Xóa">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Lịch sử Hợp đồng lao động
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Danh sách tất cả các hợp đồng và phụ lục đã giao kết với nhân viên này
          </Typography.Text>
        </div>

        {canManage && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingContract(null);
              setRenewingContract(null);
              setCreateModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              borderColor: '#7c3aed',
            }}
          >
            Ký hợp đồng mới
          </Button>
        )}
      </div>

      <Table
        dataSource={contracts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Chưa có hợp đồng nào được thiết lập cho nhân viên này' }}
      />

      <ContractModal
        open={createModalOpen || editingContract !== null || renewingContract !== null}
        contract={editingContract}
        renewingContract={renewingContract}
        presetEmployeeId={employeeId}
        onCancel={() => {
          setCreateModalOpen(false);
          setEditingContract(null);
          setRenewingContract(null);
        }}
        onSuccess={() => {
          setCreateModalOpen(false);
          setEditingContract(null);
          setRenewingContract(null);
          fetchData();
        }}
      />

      <ContractTerminateModal
        open={terminatingContract !== null}
        contract={terminatingContract}
        onCancel={() => setTerminatingContract(null)}
        onSuccess={() => {
          setTerminatingContract(null);
          fetchData();
        }}
      />

      <ContractDetailModal
        open={detailContract !== null}
        contract={detailContract}
        onCancel={() => setDetailContract(null)}
        onRefresh={() => {
          fetchData();
          if (detailContract) {
            contractService.get(detailContract.id).then(setDetailContract);
          }
        }}
        canManage={canManage}
      />
    </div>
  );
}
