import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Input, InputNumber, Select, Tag, message, Space, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons';
import { jobPositionService } from '@/services/jobPositionService';
import type { JobPosition } from '@/types/jobPosition';
import { PermGate } from '@/components/Common/PermGate';
import { ERROR_MESSAGES, LABELS, FIELD_NAMES, PERMISSIONS, QUALIFICATION_LEVELS, PROFESSIONAL_LEVELS } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import '@/styles/table.css';

interface EditData {
  name: string;
  code: string;
  professional_level: number;
  required_qualification_level?: string;
  required_specialty?: string;
  max_headcount: number;
  description?: string;
}

const defaultEdit: EditData = {
  name: '', code: '', professional_level: 1, required_qualification_level: undefined,
  required_specialty: '', max_headcount: 1, description: '',
};

/** Trang quản lý vị trí việc làm (công việc chuyên môn của cơ quan) */
export function JobPositionList() {
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<EditData>({ ...defaultEdit });

  /** Tải danh sách vị trí việc làm */
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await jobPositionService.list(false);
      setJobPositions(data);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /** Mở form thêm vị trí việc làm mới */
  const openAdd = useCallback(() => {
    setEditData({ ...defaultEdit });
    setAdding(true);
    setEditingId('new');
  }, []);

  useKeyboardShortcut('n', openAdd, !adding);

  /** Lưu vị trí việc làm (thêm mới hoặc cập nhật) */
  const handleSave = async (id: string) => {
    if (!editData.name || !editData.code) {
      message.warning('Vui lòng nhập tên và mã vị trí việc làm');
      return;
    }
    try {
      const payload = {
        ...editData,
        professional_level: Number(editData.professional_level),
        max_headcount: Number(editData.max_headcount),
      };
      if (id === 'new') {
        await jobPositionService.create(payload as any);
        message.success('Thêm vị trí việc làm thành công');
      } else {
        await jobPositionService.update(id, payload as any);
        message.success('Cập nhật vị trí việc làm thành công');
      }
      setEditingId(null);
      setAdding(false);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || ERROR_MESSAGES.SAVE_FAILED);
    }
  };

  /** Huỷ thao tác thêm/sửa */
  const handleCancel = () => {
    setEditingId(null);
    setAdding(false);
  };

  /** Ngưng kích hoạt vị trí việc làm */
  const handleDeactivate = async (id: string) => {
    try {
      await jobPositionService.deactivate(id);
      message.success('Đã ngưng vị trí việc làm');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Không thể ngưng vị trí việc làm');
    }
  };

  /** Mở chế độ sửa cho một vị trí việc làm */
  const startEdit = (record: JobPosition) => {
    setEditData({
      name: record.name,
      code: record.code,
      professional_level: record.professional_level,
      required_qualification_level: record.required_qualification_level || undefined,
      required_specialty: record.required_specialty || '',
      max_headcount: record.max_headcount,
      description: record.description || '',
    });
    setEditingId(record.id);
    setAdding(false);
  };

  const updateField = (field: keyof EditData, value: any) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const isEditing = (id: string) => editingId === id;

  const columns = useMemo(() => [
    {
      title: 'Tên vị trí việc làm', dataIndex: 'name', key: 'name', width: 200,
      sorter: (a: JobPosition, b: JobPosition) => (a.name || '').localeCompare(b.name || ''),
      render: (_: string, record: JobPosition) => {
        if (isEditing(record.id)) {
          return <Input value={editData.name} onChange={(e) => updateField('name', e.target.value)} />;
        }
        return record.name;
      },
    },
    {
      title: 'Mã', dataIndex: 'code', key: 'code', width: 100,
      sorter: (a: JobPosition, b: JobPosition) => (a.code || '').localeCompare(b.code || ''),
      render: (_: string, record: JobPosition) => {
        if (isEditing(record.id)) {
          return <Input value={editData.code} onChange={(e) => updateField('code', e.target.value)} />;
        }
        return record.code;
      },
    },
    {
      title: 'Bậc nghề nghiệp', dataIndex: 'professional_level', key: 'professional_level', width: 130,
      sorter: (a: JobPosition, b: JobPosition) => (a.professional_level || 0) - (b.professional_level || 0),
      render: (_: number, record: JobPosition) => {
        if (isEditing(record.id)) {
          return (
            <Select
              value={editData.professional_level}
              onChange={(v) => updateField('professional_level', v)}
              options={PROFESSIONAL_LEVELS}
              style={{ width: '100%' }}
            />
          );
        }
        return <Tag color="blue">Bậc {record.professional_level}</Tag>;
      },
    },
    {
      title: 'Bằng cấp (trình độ)', dataIndex: 'required_qualification_level', key: 'qualification', width: 160,
      render: (_: string, record: JobPosition) => {
        if (isEditing(record.id)) {
          return (
            <Select
              allowClear
              placeholder="Chọn trình độ"
              value={editData.required_qualification_level}
              onChange={(v) => updateField('required_qualification_level', v)}
              options={QUALIFICATION_LEVELS}
              style={{ width: '100%' }}
            />
          );
        }
        return record.required_qualification_level ? <Tag color="purple">{record.required_qualification_level}</Tag> : <span style={{ color: '#94a3b8' }}>-</span>;
      },
    },
    {
      title: 'Chuyên môn', dataIndex: 'required_specialty', key: 'specialty', width: 150,
      render: (_: string, record: JobPosition) => {
        if (isEditing(record.id)) {
          return <Input placeholder="VD: Kế toán, Luật..." value={editData.required_specialty} onChange={(e) => updateField('required_specialty', e.target.value)} />;
        }
        return record.required_specialty || <span style={{ color: '#94a3b8' }}>-</span>;
      },
    },
    {
      title: 'Số lượng (hiện tại / tối đa)', key: 'headcount', width: 170,
      sorter: (a: JobPosition, b: JobPosition) => (a.current_headcount || 0) - (b.current_headcount || 0),
      render: (_: any, record: JobPosition) => {
        const over = (record.current_headcount || 0) > (record.max_headcount || 0);
        return (
          <Space>
            <Tag color={over ? 'red' : 'green'}>
              {record.current_headcount || 0} / {record.max_headcount || 0}
            </Tag>
            {over && <Tooltip title="Vượt quá số lượng tối đa theo quy hoạch"><WarningOutlined style={{ color: '#ff4d4f' }} /></Tooltip>}
          </Space>
        );
      },
    },
    {
      title: 'Trạng thái', dataIndex: FIELD_NAMES.IS_ACTIVE, key: 'active', width: 110,
      sorter: (a: JobPosition, b: JobPosition) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean) => v ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_: any, record: JobPosition) => {
        if (isEditing(record.id)) {
          return (
            <Space>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleSave(record.id)} />
              <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
            </Space>
          );
        }
        return (
          <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
            <Space>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEdit(record)} />
              {record.is_active && (
                <Popconfirm title="Ngưng vị trí việc làm này?" onConfirm={() => handleDeactivate(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>
          </PermGate>
        );
      },
    },
  ], [editingId, editData]);

  const newRow = {
    id: 'new',
    ...defaultEdit,
    current_headcount: 0,
    is_active: true,
  } as unknown as JobPosition;

  const dataSource = adding ? [newRow, ...jobPositions] : jobPositions;

  return (
    <div>
      <div className="page-header">
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={adding}>
              Thêm vị trí việc làm
            </Button>
          </Tooltip>
        </PermGate>
      </div>

      <Table dataSource={dataSource} columns={columns} rowKey="id" loading={loading} pagination={false} scroll={{ x: 1100 }} />
    </div>
  );
}
