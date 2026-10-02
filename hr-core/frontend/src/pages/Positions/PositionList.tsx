import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Input, Select, Switch, Tag, message, Typography, Space, Popconfirm, Tooltip, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined, CheckOutlined, CloseOutlined, TeamOutlined, SettingOutlined, UserOutlined, BarChartOutlined } from '@ant-design/icons';
import { positionService } from '@/services/positionService';
import type { Position } from '@/types/position';
import { PermGate } from '@/components/Common/PermGate';
import { SCOPE, SCOPE_LABELS, SCOPE_COLORS, SCOPE_OPTIONS, ERROR_MESSAGES, LABELS, FIELD_NAMES, PERMISSIONS, PERMISSION_NAMES } from '@/utils/constants';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import '@/styles/table.css';

interface EditData {
  name: string;
  code: string;
  scope: string;
  description?: string;
  can_manage_employees: boolean;
  can_manage_settings: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
}

const defaultEdit: EditData = {
  name: '', code: '', scope: SCOPE.SELF, description: '',
  can_manage_employees: false, can_manage_settings: false, can_manage_users: false, can_view_reports: false,
};

const PERM_META = [
  { key: 'can_manage_employees' as const, icon: <TeamOutlined />, name: PERMISSION_NAMES[PERMISSIONS.CAN_MANAGE_EMPLOYEES], color: '#1677ff' },
  { key: 'can_manage_settings' as const, icon: <SettingOutlined />, name: PERMISSION_NAMES[PERMISSIONS.CAN_MANAGE_SETTINGS], color: '#fa541c' },
  { key: 'can_manage_users' as const, icon: <UserOutlined />, name: PERMISSION_NAMES[PERMISSIONS.CAN_MANAGE_USERS], color: '#eb2f96' },
  { key: 'can_view_reports' as const, icon: <BarChartOutlined />, name: PERMISSION_NAMES[PERMISSIONS.CAN_VIEW_REPORTS], color: '#52c41a' },
];

/** Trang quản lý chức vụ, hiển thị danh sách và cấu hình quyền cho từng chức vụ */
export function PositionList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<EditData>({ ...defaultEdit });

  /** Tải danh sách chức vụ */
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await positionService.list();
      setPositions(data);
    } catch {
      message.error(ERROR_MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /** Mở form thêm chức vụ mới */
  const openAdd = useCallback(() => {
    setEditData({ ...defaultEdit });
    setAdding(true);
    setEditingId('new');
  }, []);

  useKeyboardShortcut('n', openAdd, !adding);

  /** Lưu chức vụ (thêm mới hoặc cập nhật) */
  const handleSave = async (id: string) => {
    if (!editData.name || !editData.code) {
      message.warning('Vui lòng nhập tên và mã chức vụ');
      return;
    }
    try {
      if (id === 'new') {
        await positionService.create(editData as any);
        message.success('Thêm chức vụ thành công');
      } else {
        await positionService.update(id, editData as any);
        message.success('Cập nhật chức vụ thành công');
      }
      setEditingId(null);
      setAdding(false);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || ERROR_MESSAGES.SAVE_FAILED);
    }
  };

  /** Huỷ thao tác thêm/sửa chức vụ */
  const handleCancel = () => {
    setEditingId(null);
    setAdding(false);
  };

  /** Ngưng kích hoạt chức vụ */
  const handleDeactivate = async (id: string) => {
    try {
      await positionService.deactivate(id);
      message.success('Đã ngưng chức vụ');
      fetchData();
    } catch {
      message.error('Không thể ngưng chức vụ');
    }
  };

  /** Mở chế độ sửa cho một chức vụ */
  const startEdit = (record: Position) => {
    setEditData({
      name: record.name,
      code: record.code,
      scope: record.scope,
      description: record.description || '',
      can_manage_employees: record.can_manage_employees,
      can_manage_settings: record.can_manage_settings,
      can_manage_users: record.can_manage_users,
      can_view_reports: record.can_view_reports,
    });
    setEditingId(record.id);
    setAdding(false);
  };

  /** Cập nhật một trường dữ liệu trong form chỉnh sửa chức vụ */
  const updateField = (field: keyof EditData, value: any) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const isEditing = (id: string) => editingId === id;

  const columns = useMemo(() => [
    {
      title: 'Tên chức vụ', dataIndex: 'name', key: 'name', width: 180,
      sorter: (a: Position, b: Position) => (a.name || '').localeCompare(b.name || ''),
      render: (_: string, record: Position) => {
        if (isEditing(record.id)) {
          return <Input value={editData.name} onChange={(e) => updateField('name', e.target.value)} />;
        }
        return record.name;
      },
    },
    {
      title: 'Mã', dataIndex: 'code', key: 'code', width: 100,
      sorter: (a: Position, b: Position) => (a.code || '').localeCompare(b.code || ''),
      render: (_: string, record: Position) => {
        if (isEditing(record.id)) {
          return <Input value={editData.code} onChange={(e) => updateField('code', e.target.value)} />;
        }
        return record.code;
      },
    },
    {
      title: 'Phạm vi quyền', dataIndex: 'scope', key: 'scope', width: 150,
      sorter: (a: Position, b: Position) => (a.scope || '').localeCompare(b.scope || ''),
      render: (_: string, record: Position) => {
        if (isEditing(record.id)) {
          return <Select value={editData.scope} onChange={(v) => updateField('scope', v)} options={SCOPE_OPTIONS} style={{ width: '100%' }} />;
        }
        return <Tag color={SCOPE_COLORS[record.scope] || 'default'}>{SCOPE_LABELS[record.scope] || record.scope}</Tag>;
      },
    },
    {
      title: 'Quyền khác', key: 'perm_other', width: 250,
      render: (_: any, record: Position) => {
        if (isEditing(record.id)) {
          return (
            <Row gutter={[4, 4]} style={{ minWidth: 220 }}>
              {([
                { key: 'can_manage_employees', label: 'NV' },
                { key: 'can_manage_settings', label: 'Cài đặt' },
                { key: 'can_manage_users', label: 'Người dùng' },
                { key: 'can_view_reports', label: 'Báo cáo' },
              ] as const).map(({ key, label }) => (
                <Col key={key} span={12} style={{ fontSize: 12, lineHeight: '28px', whiteSpace: 'nowrap' }}>
                  <Switch size="small" checked={editData[key]} onChange={(v) => updateField(key, v)} />
                  <span style={{ marginLeft: 4 }}>{label}</span>
                </Col>
              ))}
            </Row>
          );
        }
        return (
          <Space size={8} wrap>
            {PERM_META.filter((p) => (record as any)[p.key]).map((p) => (
              <Tooltip key={p.key} title={p.name}>
                <span style={{ fontSize: 16, color: p.color, cursor: 'default' }}>{p.icon}</span>
              </Tooltip>
            ))}
            {PERM_META.every((p) => !(record as any)[p.key]) && <Tag>Không</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Số NV', dataIndex: 'employee_count', key: 'emp_count', width: 60,
      sorter: (a: Position, b: Position) => (a.employee_count || 0) - (b.employee_count || 0),
    },
    {
      title: 'Trạng thái', dataIndex: FIELD_NAMES.IS_ACTIVE, key: 'active', width: 100,
      sorter: (a: Position, b: Position) => Number(a.is_active) - Number(b.is_active),
      render: (v: boolean) => v ? <Tag color="green">{LABELS.ACTIVE}</Tag> : <Tag color="red">{LABELS.INACTIVE}</Tag>,
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_: any, record: Position) => {
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
                <Popconfirm title="Ngưng chức vụ này?" onConfirm={() => handleDeactivate(record.id)}>
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
    employee_count: 0,
    is_active: true,
  } as unknown as Position;

  const dataSource = adding ? [newRow, ...positions] : positions;

  return (
    <div>
      <div className="page-header">
        <PermGate perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}>
          <Tooltip title="Alt+N">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={adding}>
              Thêm chức vụ
            </Button>
          </Tooltip>
        </PermGate>
      </div>

      <Table dataSource={dataSource} columns={columns} rowKey="id" loading={loading} pagination={false} scroll={{ x: 1200 }} />
    </div>
  );
}
