import { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip,
  Popconfirm,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  StopOutlined,
  FilePdfOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractService } from '@/services/contractService';
import { departmentService } from '@/services/departmentService';
import type { Department } from '@/types/department';
import type { Contract, ContractDashboardSummary } from '@/types/contract';
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

export function ContractList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<ContractDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [expiryWindow, setExpiryWindow] = useState<string | undefined>(undefined);

  // Modals
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
      const [contractList, deptList, summaryData] = await Promise.all([
        contractService.list({
          department_id: selectedDept,
          contract_type: selectedType,
          expiry_window: expiryWindow,
          search: search || undefined,
        }),
        departmentService.list(true),
        contractService.getDashboardSummary(),
      ]);
      setContracts(contractList);
      setDepartments(deptList);
      setSummary(summaryData);
    } catch {
      message.error('Không thể tải danh sách hợp đồng lao động');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDept, selectedType, expiryWindow]);

  const handleSearch = () => {
    fetchData();
  };

  const handleDelete = async (id: string) => {
    try {
      await contractService.delete(id);
      message.success('Đã xóa hợp đồng');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể xóa hợp đồng');
    }
  };

  const columns = useMemo(() => [
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
      title: 'Nhân viên',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 180,
      render: (v: string | null, record: Contract) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{v || '-'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.employee_code || '-'}</div>
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 140,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Loại hợp đồng',
      dataIndex: 'contract_type',
      key: 'contract_type',
      width: 180,
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
      width: 160,
      render: (_: any, record: Contract) => {
        if (!record.end_date) {
          return <Tag color="blue">Vô thời hạn</Tag>;
        }
        if (record.status !== 'active' && record.status !== 'pending_renewal') {
          return <Tag color={CONTRACT_STATUS_COLORS[record.status]}>{CONTRACT_STATUS_LABELS[record.status]}</Tag>;
        }

        const days = record.days_remaining;
        if (days === undefined || days === null) return '-';

        if (days < 0) {
          return (
            <Tag color="#ef4444" style={{ fontWeight: 700, borderRadius: 6 }}>
              <WarningOutlined style={{ marginRight: 4 }} />
              Quá hạn {Math.abs(days)} ngày
            </Tag>
          );
        }
        if (days <= 15) {
          return (
            <Tag color="#dc2626" style={{ fontWeight: 700, borderRadius: 6 }}>
              <ExclamationCircleOutlined style={{ marginRight: 4 }} />
              Còn {days} ngày (Khẩn cấp)
            </Tag>
          );
        }
        if (days <= 30) {
          return (
            <Tag color="#ea580c" style={{ fontWeight: 600, borderRadius: 6 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              Còn {days} ngày (Cần tái ký)
            </Tag>
          );
        }
        return (
          <Tag color="#10b981" style={{ borderRadius: 6 }}>
            Còn {days} ngày
          </Tag>
        );
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
        <Tag color={CONTRACT_STATUS_COLORS[v as keyof typeof CONTRACT_STATUS_COLORS]} style={{ fontWeight: 600, borderRadius: 6 }}>
          {CONTRACT_STATUS_LABELS[v as keyof typeof CONTRACT_STATUS_LABELS] || v}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
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
                  <Tooltip title="Tái ký / Gia hạn hợp đồng">
                    <Button
                      type="text"
                      size="small"
                      style={{ color: '#2563eb' }}
                      icon={<SyncOutlined />}
                      onClick={() => setRenewingContract(record)}
                    />
                  </Tooltip>
                  <Tooltip title="Chấm dứt / Thanh lý hợp đồng">
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

              <Tooltip title="Chỉnh sửa hợp đồng">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditingContract(record)}
                />
              </Tooltip>

              <Popconfirm
                title="Xóa hợp đồng này?"
                description="Bạn có chắc chắn muốn xóa bản ghi hợp đồng này không?"
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
  ], [canManage]);

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            Quản lý Hợp đồng lao động
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Theo dõi thời hạn, tái ký, phụ lục và cảnh báo pháp lý theo Bộ luật Lao động 2019
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
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
              fontWeight: 600,
            }}
          >
            Thêm mới hợp đồng
          </Button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              background: expiryWindow === undefined ? '#f5f3ff' : '#fff',
              borderColor: expiryWindow === undefined ? '#8b5cf6' : '#e2e8f0',
              cursor: 'pointer',
            }}
            onClick={() => setExpiryWindow(undefined)}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#6d28d9' }}>Tổng HĐ đang hiệu lực</span>}
              value={summary?.total_active ?? 0}
              valueStyle={{ color: '#7c3aed', fontWeight: 700 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              background: expiryWindow === '15_days' ? '#fef2f2' : '#fff',
              borderColor: expiryWindow === '15_days' ? '#ef4444' : '#e2e8f0',
              cursor: 'pointer',
            }}
            onClick={() => setExpiryWindow(expiryWindow === '15_days' ? undefined : '15_days')}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#b91c1c' }}>Khẩn cấp: Hết hạn ≤ 15 ngày</span>}
              value={summary?.expiring_15_days ?? 0}
              valueStyle={{ color: '#dc2626', fontWeight: 700 }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              background: expiryWindow === '30_days' ? '#fffbeb' : '#fff',
              borderColor: expiryWindow === '30_days' ? '#f59e0b' : '#e2e8f0',
              cursor: 'pointer',
            }}
            onClick={() => setExpiryWindow(expiryWindow === '30_days' ? undefined : '30_days')}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#b45309' }}>Cần xử lý: Hết hạn ≤ 30 ngày</span>}
              value={summary?.expiring_30_days ?? 0}
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              background: expiryWindow === 'overdue' ? '#fef2f2' : '#fff',
              borderColor: expiryWindow === 'overdue' ? '#dc2626' : '#e2e8f0',
              cursor: 'pointer',
            }}
            onClick={() => setExpiryWindow(expiryWindow === 'overdue' ? undefined : 'overdue')}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#7f1d1d' }}>Quá hạn chưa tái ký</span>}
              value={summary?.overdue_count ?? 0}
              valueStyle={{ color: '#991b1b', fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Toolbar */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="Tìm theo số HĐ, tên, mã NV..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          <Col xs={12} sm={8} md={5}>
            <Select
              placeholder="Lọc theo phòng ban"
              style={{ width: '100%' }}
              allowClear
              value={selectedDept}
              onChange={setSelectedDept}
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Col>

          <Col xs={12} sm={8} md={5}>
            <Select
              placeholder="Lọc loại hợp đồng"
              style={{ width: '100%' }}
              allowClear
              value={selectedType}
              onChange={setSelectedType}
              options={Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => ({
                label: v,
                value: k,
              }))}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Khoảng thời hạn cảnh báo"
              style={{ width: '100%' }}
              allowClear
              value={expiryWindow}
              onChange={setExpiryWindow}
              options={[
                { label: 'Tất cả hợp đồng', value: undefined as any },
                { label: '🔴 Khẩn cấp: Hết hạn ≤ 15 ngày', value: '15_days' },
                { label: '🟡 Cần xử lý: Hết hạn ≤ 30 ngày', value: '30_days' },
                { label: '🔵 Nhắc việc: Hết hạn ≤ 60 ngày', value: '60_days' },
                { label: '⛔ Đã quá hạn chưa xử lý', value: 'overdue' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={2}>
            <Button onClick={handleSearch} style={{ width: '100%' }}>
              Lọc
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <Table
        dataSource={contracts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `Tổng cộng ${t} hợp đồng` }}
        scroll={{ x: 1300 }}
      />

      {/* Modal Ký mới / Chỉnh sửa / Tái ký */}
      <ContractModal
        open={createModalOpen || editingContract !== null || renewingContract !== null}
        contract={editingContract}
        renewingContract={renewingContract}
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

      {/* Modal Chấm dứt / Thanh lý hợp đồng */}
      <ContractTerminateModal
        open={terminatingContract !== null}
        contract={terminatingContract}
        onCancel={() => setTerminatingContract(null)}
        onSuccess={() => {
          setTerminatingContract(null);
          fetchData();
        }}
      />

      {/* Modal Xem chi tiết & phụ lục */}
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
