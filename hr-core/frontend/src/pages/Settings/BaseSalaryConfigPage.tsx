import { useEffect, useState, useMemo } from 'react';
import {
  Table, Typography, message, Button, Modal, Form, InputNumber, Popconfirm,
  Space, Tag, Switch, Tabs, Card, Descriptions, Input, Row, Col, Badge, Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, ClockCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { employeeProcessService } from '@/services/employeeProcessService';
import type { BaseSalaryConfig, BaseSalaryConfigCreate, ShiftRateConfig, ShiftRateConfigCreate } from '@/types/employeeProcess';
import { ERROR_MESSAGES, PERMISSIONS } from '@/utils/constants';
import { PermGate } from '@/components/Common/PermGate';

const { Title, Text } = Typography;

export function BaseSalaryConfigPage() {
  const [activeTab, setActiveTab] = useState<string>('base_salary');
  
  // Base Salary State
  const [baseSalaries, setBaseSalaries] = useState<BaseSalaryConfig[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseModalOpen, setBaseModalOpen] = useState(false);
  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [savingBase, setSavingBase] = useState(false);
  const [baseForm] = Form.useForm();

  // Shift Rates State
  const [shiftRates, setShiftRates] = useState<ShiftRateConfig[]>([]);
  const [loadingShift, setLoadingShift] = useState(true);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [savingShift, setSavingShift] = useState(false);
  const [shiftForm] = Form.useForm();

  const fetchBaseSalaryData = async () => {
    setLoadingBase(true);
    try {
      const records = await employeeProcessService.getBaseSalaryConfigs();
      setBaseSalaries(records);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoadingBase(false);
    }
  };

  const fetchShiftRateData = async () => {
    setLoadingShift(true);
    try {
      const records = await employeeProcessService.getShiftRateConfigs();
      setShiftRates(records);
    } catch {
      message.error('Không thể tải danh sách cấu hình ca trực');
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    fetchBaseSalaryData();
    fetchShiftRateData();
  }, []);

  // Base Salary Handlers
  const openBaseModal = (record?: BaseSalaryConfig) => {
    if (record) {
      setEditingBaseId(record.id);
      baseForm.setFieldsValue({
        year: record.year,
        amount: record.amount,
      });
    } else {
      setEditingBaseId(null);
      baseForm.resetFields();
    }
    setBaseModalOpen(true);
  };

  const saveBaseSalary = async () => {
    try {
      const values = await baseForm.validateFields();
      setSavingBase(true);

      const payload: BaseSalaryConfigCreate = {
        year: values.year,
        amount: values.amount,
      };

      if (editingBaseId) {
        await employeeProcessService.updateBaseSalaryConfig(editingBaseId, payload);
        message.success('Cập nhật mức lương cơ sở thành công');
      } else {
        await employeeProcessService.createBaseSalaryConfig(payload);
        message.success('Thêm mức lương cơ sở thành công');
      }

      setBaseModalOpen(false);
      baseForm.resetFields();
      fetchBaseSalaryData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu lương cơ sở');
    } finally {
      setSavingBase(false);
    }
  };

  const handleDeleteBaseSalary = async (id: string) => {
    try {
      await employeeProcessService.deleteBaseSalaryConfig(id);
      message.success('Đã xoá cấu hình lương cơ sở');
      fetchBaseSalaryData();
    } catch {
      message.error('Không thể xoá');
    }
  };

  const handleToggleBaseActive = async (record: BaseSalaryConfig) => {
    try {
      await employeeProcessService.updateBaseSalaryConfig(record.id, { is_active: !record.is_active });
      fetchBaseSalaryData();
    } catch {
      message.error('Lỗi cập nhật trạng thái');
    }
  };

  // Shift Rate Handlers
  const openShiftModal = (record?: ShiftRateConfig) => {
    if (record) {
      setEditingShiftId(record.id);
      shiftForm.setFieldsValue({
        code: record.code,
        name: record.name,
        multiplier: record.multiplier,
        allowance_amount: record.allowance_amount,
        description: record.description,
        is_active: record.is_active,
      });
    } else {
      setEditingShiftId(null);
      shiftForm.resetFields();
      shiftForm.setFieldsValue({ multiplier: 1.0, allowance_amount: 0, is_active: true });
    }
    setShiftModalOpen(true);
  };

  const saveShiftRate = async () => {
    try {
      const values = await shiftForm.validateFields();
      setSavingShift(true);

      const payload: ShiftRateConfigCreate = {
        code: values.code,
        name: values.name,
        multiplier: values.multiplier,
        allowance_amount: values.allowance_amount,
        description: values.description,
        is_active: values.is_active ?? true,
      };

      if (editingShiftId) {
        await employeeProcessService.updateShiftRateConfig(editingShiftId, payload);
        message.success('Cập nhật cấu hình ca trực thành công');
      } else {
        await employeeProcessService.createShiftRateConfig(payload);
        message.success('Thêm cấu hình ca trực thành công');
      }

      setShiftModalOpen(false);
      shiftForm.resetFields();
      fetchShiftRateData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu cấu hình ca trực');
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShiftRate = async (id: string) => {
    try {
      await employeeProcessService.deleteShiftRateConfig(id);
      message.success('Đã xoá cấu hình ca trực');
      fetchShiftRateData();
    } catch {
      message.error('Không thể xoá cấu hình ca trực');
    }
  };

  const handleToggleShiftActive = async (record: ShiftRateConfig) => {
    try {
      await employeeProcessService.updateShiftRateConfig(record.id, { is_active: !record.is_active });
      fetchShiftRateData();
    } catch {
      message.error('Lỗi cập nhật trạng thái ca trực');
    }
  };

  // Base Salary Columns
  const baseSalaryColumns = useMemo(() => [
    {
      title: 'Năm', dataIndex: 'year', key: 'year', width: 100,
      sorter: (a: BaseSalaryConfig, b: BaseSalaryConfig) => (a.year || 0) - (b.year || 0),
    },
    {
      title: 'Mức lương cơ sở', dataIndex: 'amount', key: 'amount', width: 220,
      sorter: (a: BaseSalaryConfig, b: BaseSalaryConfig) => (a.amount || 0) - (b.amount || 0),
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#1677ff' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)}
        </span>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', width: 140,
      render: (v: boolean, record: BaseSalaryConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Space>
            <Switch checked={v} onChange={() => handleToggleBaseActive(record)} />
            <Tag color={v ? 'success' : 'default'}>{v ? 'Đang áp dụng' : 'Không áp dụng'}</Tag>
          </Space>
        </PermGate>
      ),
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: BaseSalaryConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openBaseModal(record)} />
            <Popconfirm title="Xoá cấu hình này?" onConfirm={() => handleDeleteBaseSalary(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </PermGate>
      ),
    },
  ], [handleToggleBaseActive, openBaseModal, handleDeleteBaseSalary]);

  // Shift Rate Columns
  const shiftRateColumns = useMemo(() => [
    {
      title: 'Mã ca', dataIndex: 'code', key: 'code', width: 120,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Tên ca / Loại hình', dataIndex: 'name', key: 'name', width: 200,
      render: (name: string, record: ShiftRateConfig) => (
        <div>
          <Text strong>{name}</Text>
          {record.description && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.description}</div>}
        </div>
      ),
    },
    {
      title: 'Hệ số lương ca', dataIndex: 'multiplier', key: 'multiplier', width: 140,
      render: (mult: number) => <Tag color="purple">x{mult}</Tag>,
    },
    {
      title: 'Phụ cấp ca trực (VND)', dataIndex: 'allowance_amount', key: 'allowance_amount', width: 180,
      render: (val: number) => (
        <span style={{ fontWeight: 500, color: '#52c41a' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)}
        </span>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', width: 140,
      render: (v: boolean, record: ShiftRateConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Space>
            <Switch checked={v} onChange={() => handleToggleShiftActive(record)} />
            <Tag color={v ? 'processing' : 'default'}>{v ? 'Kích hoạt' : 'Tắt'}</Tag>
          </Space>
        </PermGate>
      ),
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: ShiftRateConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openShiftModal(record)} />
            <Popconfirm title="Xoá cấu hình ca trực này?" onConfirm={() => handleDeleteShiftRate(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </PermGate>
      ),
    },
  ], [handleToggleShiftActive, openShiftModal, handleDeleteShiftRate]);

  const activeBaseSalary = baseSalaries.find(b => b.is_active) || baseSalaries[0];

  return (
    <div style={{ padding: 16 }}>
      {/* Header alert showing current decree status */}
      <Alert
        message="Hệ thống Tiền lương Khối Hành chính Sự nghiệp & Doanh nghiệp Nhà nước"
        description={
          <div>
            Theo <b>Nghị định 73/2024/NĐ-CP</b>, Mức lương cơ sở từ ngày 01/07/2024 là <b>2.340.000 VNĐ/tháng</b>.
            Áp dụng công thức tính lương ngạch bậc = <i>Hệ số lương x 2.340.000đ</i>.
            Trần đóng Bảo hiểm xã hội tối đa = 20 lần Lương cơ sở (<b>46.800.000 VNĐ</b>).
          </div>
        }
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined style={{ fontSize: 24 }} />}
        style={{ marginBottom: 20 }}
      />

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary">Lương cơ sở áp dụng (2026)</Text>
            <Title level={4} style={{ margin: '4px 0 0 0', color: '#1677ff' }}>
              {activeBaseSalary
                ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(activeBaseSalary.amount)
                : '2.340.000 ₫'}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary">Số ngày công chuẩn / tháng</Text>
            <Title level={4} style={{ margin: '4px 0 0 0', color: '#52c41a' }}>22 Ngày</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary">Trần bảo hiểm (20x Mức cơ sở)</Text>
            <Title level={4} style={{ margin: '4px 0 0 0', color: '#fa8c16' }}>46.800.000 ₫</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary">Giảm trừ Thuế TNCN (Bản thân)</Text>
            <Title level={4} style={{ margin: '4px 0 0 0', color: '#722ed1' }}>11.000.000 ₫</Title>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'base_salary',
              label: (
                <span>
                  <DollarOutlined /> Cấu hình Lương cơ sở
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openBaseModal()}>
                        Thêm mức lương cơ sở
                      </Button>
                    </PermGate>
                  </div>
                  <Table
                    dataSource={baseSalaries}
                    columns={baseSalaryColumns}
                    rowKey="id"
                    loading={loadingBase}
                    pagination={false}
                    locale={{ emptyText: 'Chưa có cấu hình lương cơ sở nào' }}
                  />
                </div>
              ),
            },
            {
              key: 'shift_rates',
              label: (
                <span>
                  <ClockCircleOutlined /> Cấu hình Ca trực & Phụ cấp Ca (Calendar Integration)
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openShiftModal()}>
                        Thêm loại ca trực
                      </Button>
                    </PermGate>
                  </div>
                  <Table
                    dataSource={shiftRates}
                    columns={shiftRateColumns}
                    rowKey="id"
                    loading={loadingShift}
                    pagination={false}
                    locale={{ emptyText: 'Chưa có cấu hình ca trực nào' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Cấu hình Lương Cơ Sở */}
      <Modal
        title={editingBaseId ? 'Sửa mức lương cơ sở' : 'Thêm mức lương cơ sở'}
        open={baseModalOpen}
        onCancel={() => { setBaseModalOpen(false); baseForm.resetFields(); }}
        onOk={saveBaseSalary}
        confirmLoading={savingBase}
        width={500}
      >
        <Form form={baseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="year"
            label="Năm áp dụng"
            rules={[{ required: true, message: 'Nhập năm áp dụng' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="VD: 2026"
              min={2000}
              max={2100}
              disabled={!!editingBaseId}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Mức lương cơ sở (Nghị định quy định)"
            rules={[{ required: true, message: 'Nhập mức lương cơ sở' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/,/g, '') as any}
              placeholder="VD: 2340000"
              min={0}
              addonAfter="VND"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Cấu hình Ca trực & Phụ cấp */}
      <Modal
        title={editingShiftId ? 'Sửa cấu hình ca trực' : 'Thêm loại ca trực mới'}
        open={shiftModalOpen}
        onCancel={() => { setShiftModalOpen(false); shiftForm.resetFields(); }}
        onOk={saveShiftRate}
        confirmLoading={savingShift}
        width={550}
      >
        <Form form={shiftForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã ca trực (Hệ thống)"
                rules={[{ required: true, message: 'Nhập mã ca trực (VD: NIGHT)' }]}
              >
                <Input placeholder="VD: NIGHT, WEEKEND, HOLIDAY" disabled={!!editingShiftId} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên hiển thị ca trực"
                rules={[{ required: true, message: 'Nhập tên hiển thị' }]}
              >
                <Input placeholder="VD: Ca đêm, Ca cuối tuần" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="multiplier"
                label="Hệ số nhân lương công"
                rules={[{ required: true, message: 'Nhập hệ số' }]}
              >
                <InputNumber style={{ width: '100%' }} step={0.1} min={0.5} max={10.0} placeholder="VD: 1.3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="allowance_amount"
                label="Tiền phụ cấp ca cố định (VND)"
                rules={[{ required: true, message: 'Nhập số tiền phụ cấp' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/,/g, '') as any}
                  min={0}
                  placeholder="VD: 50000"
                  addonAfter="VND"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Mô tả & Căn cứ pháp lý">
            <Input.TextArea rows={2} placeholder="Căn cứ Nghị định 145/2020/NĐ-CP hoặc QĐ 73/2011/QĐ-TTg..." />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái kích hoạt" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
