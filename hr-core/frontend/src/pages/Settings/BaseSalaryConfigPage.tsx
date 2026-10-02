import { useEffect, useState, useMemo } from 'react';
import {
  Table, Typography, message, Button, Modal, Form, InputNumber, Popconfirm,
  Space, Tag, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { employeeProcessService } from '@/services/employeeProcessService';
import type { BaseSalaryConfig, BaseSalaryConfigCreate } from '@/types/employeeProcess';
import { ERROR_MESSAGES, PERMISSIONS } from '@/utils/constants';
import { PermGate } from '@/components/Common/PermGate';

/** Trang cấu hình mức lương cơ sở theo năm, hiển thị danh sách và thao tác thêm/sửa/xoá */
export function BaseSalaryConfigPage() {
  const [data, setData] = useState<BaseSalaryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  /** Tải danh sách cấu hình lương cơ sở */
  const fetchData = async () => {
    setLoading(true);
    try {
      const records = await employeeProcessService.getBaseSalaryConfigs();
      setData(records);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /** Mở modal thêm/sửa cấu hình lương cơ sở */
  const openModal = (record?: BaseSalaryConfig) => {
    if (record) {
      setEditing(record.id);
      form.setFieldsValue({
        year: record.year,
        amount: record.amount,
      });
    } else {
      setEditing(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  /** Lưu cấu hình lương cơ sở (thêm mới hoặc cập nhật) */
  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const data: BaseSalaryConfigCreate = {
        year: values.year,
        amount: values.amount,
      };

      if (editing) {
        await employeeProcessService.updateBaseSalaryConfig(editing, data);
        message.success('Cập nhật mức lương cơ sở thành công');
      } else {
        await employeeProcessService.createBaseSalaryConfig(data);
        message.success('Thêm mức lương cơ sở thành công');
      }

      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  /** Xoá cấu hình lương cơ sở */
  const handleDelete = async (id: string) => {
    try {
      await employeeProcessService.deleteBaseSalaryConfig(id);
      message.success('Đã xoá cấu hình lương cơ sở');
      fetchData();
    } catch {
      message.error('Không thể xoá');
    }
  };

  /** Bật/tắt kích hoạt cấu hình lương cơ sở */
  const handleToggleActive = async (record: BaseSalaryConfig) => {
    try {
      await employeeProcessService.updateBaseSalaryConfig(record.id, { is_active: !record.is_active });
      fetchData();
    } catch {
      message.error('Lỗi cập nhật trạng thái');
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Năm', dataIndex: 'year', key: 'year', width: 100,
      sorter: (a: BaseSalaryConfig, b: BaseSalaryConfig) => (a.year || 0) - (b.year || 0),
    },
    {
      title: 'Mức lương cơ sở', dataIndex: 'amount', key: 'amount', width: 200,
      sorter: (a: BaseSalaryConfig, b: BaseSalaryConfig) => (a.amount || 0) - (b.amount || 0),
      render: (v: number) => (
        <span style={{ fontWeight: 500 }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)}
        </span>
      ),
    },
    {
      title: 'Kích hoạt', dataIndex: 'is_active', key: 'is_active', width: 100,
      sorter: (a: BaseSalaryConfig, b: BaseSalaryConfig) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean, record: BaseSalaryConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Switch checked={v} onChange={() => handleToggleActive(record)} />
        </PermGate>
      ),
    },
    {
      title: 'Hành động', key: 'actions', width: 120,
      render: (_: any, record: BaseSalaryConfig) => (
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
            <Popconfirm title="Xoá cấu hình này?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </PermGate>
      ),
    },
  ], [handleToggleActive, openModal, handleDelete]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm mức lương
          </Button>
        </PermGate>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Chưa có cấu hình lương cơ sở nào' }}
      />

      <Modal
        title={editing ? 'Sửa mức lương cơ sở' : 'Thêm mức lương cơ sở'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={save}
        confirmLoading={saving}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="year"
            label="Năm"
            rules={[{ required: true, message: 'Nhập năm' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="VD: 2026"
              min={2000}
              max={2100}
              disabled={!!editing}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Mức lương cơ sở"
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
    </div>
  );
}
