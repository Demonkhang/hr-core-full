import { useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Button,
  Table,
  Space,
  Popconfirm,
  Typography,
  Divider,
  message,
} from 'antd';
import {
  FilePdfOutlined,
  PaperClipOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import type { Contract, ContractAppendix } from '@/types/contract';
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  APPENDIX_CHANGE_TYPE_LABELS,
} from '@/types/contract';
import { ContractAppendixModal } from './ContractAppendixModal';

interface ContractDetailModalProps {
  open: boolean;
  contract: Contract | null;
  onCancel: () => void;
  onRefresh: () => void;
  canManage?: boolean;
}

export function ContractDetailModal({
  open,
  contract,
  onCancel,
  onRefresh,
  canManage = true,
}: ContractDetailModalProps) {
  const [appendixModalOpen, setAppendixModalOpen] = useState(false);

  if (!contract) return null;

  const handleDeleteAppendix = async (appendixId: string) => {
    try {
      await contractService.deleteAppendix(contract.id, appendixId);
      message.success('Đã xóa phụ lục hợp đồng');
      onRefresh();
    } catch {
      message.error('Không thể xóa phụ lục');
    }
  };

  const appendixColumns = [
    {
      title: 'Số phụ lục',
      dataIndex: 'appendix_number',
      key: 'appendix_number',
      width: 140,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Ngày hiệu lực',
      dataIndex: 'effective_date',
      key: 'effective_date',
      width: 110,
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Loại điều chỉnh',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 180,
      render: (v: any) => <Tag color="blue">{APPENDIX_CHANGE_TYPE_LABELS[v as keyof typeof APPENDIX_CHANGE_TYPE_LABELS] || v}</Tag>,
    },
    {
      title: 'Nội dung thay đổi',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: 'Tệp đính kèm',
      dataIndex: 'file_attachment_url',
      key: 'file_attachment_url',
      width: 120,
      render: (v: string | null) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer" style={{ color: '#7c3aed' }}>
            <FilePdfOutlined /> Xem file
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: ContractAppendix) =>
        canManage ? (
          <Popconfirm
            title="Xóa phụ lục này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteAppendix(record.id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilePdfOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
            <span>Hợp đồng lao động: {contract.contract_number}</span>
          </div>
        }
        open={open}
        onCancel={onCancel}
        width={800}
        footer={[
          <Button key="close" onClick={onCancel}>
            Đóng
          </Button>,
        ]}
      >
        <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Nhân viên" span={2}>
            <strong style={{ fontSize: 14 }}>{contract.employee_name || '-'}</strong>{' '}
            <Tag color="geekblue">{contract.employee_code || 'Không có mã'}</Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Số hợp đồng">{contract.contract_number}</Descriptions.Item>
          <Descriptions.Item label="Loại hợp đồng">
            <Tag color={CONTRACT_TYPE_COLORS[contract.contract_type]}>
              {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type} (Lần {contract.contract_sequence || 1})
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Phòng ban">{contract.department_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Nơi làm việc">{contract.workplace_name || '-'}</Descriptions.Item>

          <Descriptions.Item label="Chức danh công việc">{contract.job_title || '-'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={CONTRACT_STATUS_COLORS[contract.status]} style={{ fontWeight: 600 }}>
              {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Ngày ký">
            {contract.signing_date ? dayjs(contract.signing_date).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày bắt đầu">
            {contract.start_date ? dayjs(contract.start_date).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>

          <Descriptions.Item label="Ngày hết hạn">
            {contract.end_date ? (
              <Space>
                <span>{dayjs(contract.end_date).format('DD/MM/YYYY')}</span>
                {contract.days_remaining !== undefined && contract.days_remaining !== null && (
                  <Tag
                    color={
                      contract.days_remaining < 0
                        ? 'error'
                        : contract.days_remaining <= 15
                        ? '#dc2626'
                        : contract.days_remaining <= 30
                        ? '#ea580c'
                        : 'success'
                    }
                  >
                    {contract.days_remaining < 0
                      ? `Quá hạn ${Math.abs(contract.days_remaining)} ngày`
                      : `Còn ${contract.days_remaining} ngày`}
                  </Tag>
                )}
              </Space>
            ) : (
              <Tag color="cyan">Không xác định thời hạn</Tag>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Mức lương chính thức">
            <strong style={{ color: '#16a34a' }}>
              {contract.basic_salary ? `${Number(contract.basic_salary).toLocaleString()} đ` : '-'}
            </strong>{' '}
            {contract.salary_rate && contract.salary_rate < 100 && (
              <Tag color="orange">{contract.salary_rate}%</Tag>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Phụ cấp">
            {contract.allowance_amount ? `${Number(contract.allowance_amount).toLocaleString()} đ` : '0 đ'}
          </Descriptions.Item>

          <Descriptions.Item label="Người đại diện ký" span={2}>
            {contract.signatory_name || '-'} ({contract.signatory_title || 'Đại diện NSDLĐ'})
          </Descriptions.Item>

          {contract.file_attachment_url && (
            <Descriptions.Item label="Bản scan đính kèm" span={2}>
              <a href={contract.file_attachment_url} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontWeight: 600 }}>
                <FilePdfOutlined style={{ marginRight: 6 }} />
                Xem tệp đính kèm hợp đồng có chữ ký
              </a>
            </Descriptions.Item>
          )}

          {contract.status === 'terminated' && (
            <>
              <Descriptions.Item label="Ngày chấm dứt">
                {contract.termination_date ? dayjs(contract.termination_date).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do chấm dứt">
                <span style={{ color: '#dc2626' }}>{contract.termination_reason || '-'}</span>
              </Descriptions.Item>
            </>
          )}

          {contract.notes && (
            <Descriptions.Item label="Ghi chú" span={2}>
              {contract.notes}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider style={{ margin: '16px 0 12px 0' }} />

        {/* Danh sách phụ lục hợp đồng */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            <PaperClipOutlined style={{ marginRight: 6, color: '#2563eb' }} />
            Phụ lục hợp đồng ({contract.appendices?.length || 0})
          </Typography.Text>
          {canManage && contract.status === 'active' && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAppendixModalOpen(true)}
            >
              Thêm phụ lục
            </Button>
          )}
        </div>

        <Table
          dataSource={contract.appendices || []}
          columns={appendixColumns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: 'Chưa có phụ lục điều chỉnh nào' }}
        />
      </Modal>

      {/* Modal thêm phụ lục */}
      <ContractAppendixModal
        open={appendixModalOpen}
        contract={contract}
        onCancel={() => setAppendixModalOpen(false)}
        onSuccess={() => {
          setAppendixModalOpen(false);
          onRefresh();
        }}
      />
    </>
  );
}
