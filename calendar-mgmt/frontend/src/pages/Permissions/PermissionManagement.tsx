import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Switch, Select, Tag, message, Typography, Result } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { permissionService, CalendarPermission } from '@/services/permissionService';
import { SCOPE_OPTIONS } from '@/utils/constants';
import { PermGate } from '@/components/Common/PermGate';
import { PERMISSIONS } from '@/utils/constants';

const SCHEDULE_CRUD_KEYS = ['can_read_schedule', 'can_create_schedule', 'can_update_schedule', 'can_delete_schedule'] as (keyof CalendarPermission)[];
const ALL_KEYS = [...SCHEDULE_CRUD_KEYS, 'can_approve_schedule', 'can_manage_leave', 'can_approve_leave', 'can_manage_overtime', 'can_approve_overtime', 'can_manage_meetings', 'can_approve_meetings'] as (keyof CalendarPermission)[];

export function PermissionManagement() {
  const [positions, setPositions] = useState<CalendarPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, Partial<CalendarPermission>>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionService.listCalendarPermissions();
      setPositions(data.filter((p) => p.is_active));
    } catch {
      message.error('Không thể tải dữ liệu phân quyền');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const setPerm = (posId: string, key: keyof CalendarPermission, value: boolean | string) => {
    setEditMap((prev) => {
      const next = { ...prev, [posId]: { ...prev[posId], [key]: value } };
      return next;
    });
  };

  const setScheduleCrud = (posId: string, value: boolean) => {
    setEditMap((prev) => {
      const updates: Record<string, any> = {};
      for (const k of SCHEDULE_CRUD_KEYS) updates[k] = value;
      return { ...prev, [posId]: { ...prev[posId], ...updates } };
    });
  };

  const isScheduleCrudOn = (pos: CalendarPermission): boolean => {
    return SCHEDULE_CRUD_KEYS.every((k) => getCurrentValue(pos, k));
  };

  const getCurrentValue = (pos: CalendarPermission, key: keyof CalendarPermission): boolean => {
    if (key in (editMap[pos.id] || {})) return !!editMap[pos.id][key];
    return !!pos[key];
  };

  const hasChanges = (pos: CalendarPermission): boolean => {
    const edits = editMap[pos.id];
    if (!edits) return false;
    return ALL_KEYS.some((k) => edits[k] !== undefined && edits[k] !== pos[k]);
  };

  const handleSave = async (pos: CalendarPermission) => {
    const updates = editMap[pos.id];
    if (!updates) return;
    setSavingId(pos.id);
    try {
      const updated = await permissionService.updateCalendarPermission(pos.id, updates);
      setPositions((prev) => prev.map((p) => (p.id === pos.id ? { ...p, ...updated } : p)));
      setEditMap((prev) => { const next = { ...prev }; delete next[pos.id]; return next; });
      message.success(`Đã cập nhật phân quyền cho "${pos.name}"`);
    } catch {
      message.error(`Không thể cập nhật phân quyền cho "${pos.name}"`);
    } finally {
      setSavingId(null);
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Chức vụ', dataIndex: 'name', key: 'name', width: 180, fixed: 'left' as const,
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Phạm vi', dataIndex: 'scope', key: 'scope', width: 150, fixed: 'left' as const,
      render: (_: any, record: CalendarPermission) => (
        <Select
          size="small" style={{ width: 140 }}
          value={editMap[record.id]?.scope ?? record.scope}
          onChange={(val) => setPerm(record.id, 'scope', val)}
          options={SCOPE_OPTIONS}
        />
      ),
    },
    {
      title: 'Lịch', key: 'group_schedule', children: [
        {
          title: 'CRUD', key: 'schedule_crud', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={isScheduleCrudOn(record)} onChange={(v) => setScheduleCrud(record.id, v)} />
          ),
        },
        {
          title: 'Duyệt', dataIndex: 'can_approve_schedule', key: 'can_approve_schedule', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_approve_schedule')} onChange={(v) => setPerm(record.id, 'can_approve_schedule', v)} />
          ),
        },
      ],
    },
    {
      title: 'Nghỉ phép', key: 'group_leave', children: [
        {
          title: 'CRUD', dataIndex: 'can_manage_leave', key: 'can_manage_leave', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_manage_leave')} onChange={(v) => setPerm(record.id, 'can_manage_leave', v)} />
          ),
        },
        {
          title: 'Duyệt', dataIndex: 'can_approve_leave', key: 'can_approve_leave', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_approve_leave')} onChange={(v) => setPerm(record.id, 'can_approve_leave', v)} />
          ),
        },
      ],
    },
    {
      title: 'Thêm giờ', key: 'group_overtime', children: [
        {
          title: 'CRUD', dataIndex: 'can_manage_overtime', key: 'can_manage_overtime', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_manage_overtime')} onChange={(v) => setPerm(record.id, 'can_manage_overtime', v)} />
          ),
        },
        {
          title: 'Duyệt', dataIndex: 'can_approve_overtime', key: 'can_approve_overtime', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_approve_overtime')} onChange={(v) => setPerm(record.id, 'can_approve_overtime', v)} />
          ),
        },
      ],
    },
    {
      title: 'Lịch họp', key: 'group_meeting', children: [
        {
          title: 'CRUD', dataIndex: 'can_manage_meetings', key: 'can_manage_meetings', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_manage_meetings')} onChange={(v) => setPerm(record.id, 'can_manage_meetings', v)} />
          ),
        },
        {
          title: 'Duyệt', dataIndex: 'can_approve_meetings', key: 'can_approve_meetings', width: 80, align: 'center' as const,
          render: (_: any, record: CalendarPermission) => (
            <Switch size="small" checked={getCurrentValue(record, 'can_approve_meetings')} onChange={(v) => setPerm(record.id, 'can_approve_meetings', v)} />
          ),
        },
      ],
    },
    {
      title: 'Số NV', dataIndex: 'employee_count', key: 'employee_count', width: 70, align: 'center' as const,
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: '', key: 'actions', width: 80, align: 'center' as const,
      render: (_: any, record: CalendarPermission) => (
        <Button
          type="primary" size="small" icon={<SaveOutlined />}
          loading={savingId === record.id} disabled={!hasChanges(record)}
          onClick={() => handleSave(record)}
        />
      ),
    },
  ], [editMap, savingId]);

  return (
    <PermGate
      perms={[PERMISSIONS.CAN_MANAGE_SETTINGS]}
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
          <Result
            status="403"
            title="403"
            subTitle="Bạn không có quyền truy cập trang này."
            extra={
              <Button type="primary" onClick={() => window.location.href = '/'}>
                Về trang chủ
              </Button>
            }
          />
        </div>
      }
    >
      <div>
        <Table
          dataSource={positions} columns={columns} rowKey="id"
          loading={loading} pagination={false} scroll={{ x: 'max-content' }} size="small"
        />
      </div>
    </PermGate>
  );
}
