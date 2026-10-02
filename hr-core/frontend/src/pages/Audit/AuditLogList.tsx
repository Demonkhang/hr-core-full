import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Typography, Space, Card, Row, Col, Statistic, DatePicker, Select, Input, Button } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { auditService } from '@/services/auditService';
import type { AuditLog, AuditLogStats } from '@/types/audit';
import { DATE_FORMATS } from '@/utils/constants';

const DEFAULT_ACTIONS = 'create,update,delete,restore,approve,reject,submit,import,login,logout,change_password,create_account,reset_password,deactivate';

const ACTION_COLORS: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', restore: 'purple',
  approve: 'cyan', reject: 'orange', submit: 'geekblue',
  login: 'default', logout: 'default',
  import: 'gold',
};

const RESOURCE_LABELS: Record<string, string> = {
  auth: 'Xác thực', user: 'Người dùng', department: 'Phòng ban',
  position: 'Chức vụ', workplace: 'Nơi làm việc',
  employee: 'Nhân sự',
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return 'default';
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    'create': 'Tạo', 'update': 'Sửa', 'delete': 'Xoá', 'restore': 'Khôi phục',
    'approve': 'Duyệt', 'reject': 'Từ chối', 'submit': 'Gửi duyệt',
    'import': 'Import', 'export': 'Export',
    'login': 'Đăng nhập', 'logout': 'Đăng xuất', 'change_password': 'Đổi mật khẩu',
    'create_account': 'Tạo tài khoản', 'reset_password': 'Reset mật khẩu',
    'deactivate': 'Vô hiệu hoá',
  };
  for (const [key, label] of Object.entries(map)) {
    if (action.includes(key)) return label;
  }
  return action;
}

export function AuditLogList() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [filterAction, setFilterAction] = useState<string | undefined>();
  const [filterResource, setFilterResource] = useState<string | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const commonActions = DEFAULT_ACTIONS;
      const params: Record<string, unknown> = { limit: 100, actions: commonActions };
      if (filterAction) params.action = filterAction;
      if (filterResource) params.resource_type = filterResource;
      if (filterDateRange?.[0]) params.date_from = filterDateRange[0].format('YYYY-MM-DD');
      if (filterDateRange?.[1]) params.date_to = filterDateRange[1].format('YYYY-MM-DD');
      const [data, statsData] = await Promise.all([
        auditService.list(params as any),
        auditService.getStats({
          date_from: filterDateRange?.[0]?.format('YYYY-MM-DD'),
          date_to: filterDateRange?.[1]?.format('YYYY-MM-DD'),
          actions: commonActions,
        }),
      ]);
      setLogs(data);
      setStats(statsData);
    } catch {
      // handled by apiClient interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const actionOptions = useMemo(() => {
    if (!stats) return [];
    const seen = new Set<string>();
    return stats.by_action
      .filter((a) => { const key = a.action.split('.').pop() || a.action; if (seen.has(key)) return false; seen.add(key); return true; })
      .map((a) => ({ label: formatActionLabel(a.action), value: a.action }));
  }, [stats]);

  const resourceOptions = useMemo(() => {
    if (!stats) return [];
    return stats.by_resource.map((r) => ({
      label: RESOURCE_LABELS[r.resource_type] || r.resource_type,
      value: r.resource_type,
    }));
  }, [stats]);

  const handleSearch = () => fetchData();

  const columns = [
    {
      title: 'Thời gian', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-',
      sorter: (a: AuditLog, b: AuditLog) => (a.created_at || '').localeCompare(b.created_at || ''),
    },
    {
      title: 'Người dùng', dataIndex: 'username', key: 'username', width: 140,
      render: (v: string | null) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Hành động', dataIndex: 'action', key: 'action', width: 150,
      render: (v: string) => <Tag color={getActionColor(v)}>{formatActionLabel(v)}</Tag>,
    },
    {
      title: 'Đối tượng', dataIndex: 'resource_type', key: 'resource_type', width: 130,
      render: (v: string) => RESOURCE_LABELS[v] || v,
    },
    {
      title: 'IP', dataIndex: 'ip_address', key: 'ip_address', width: 130,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Trạng thái', dataIndex: 'success', key: 'success', width: 100,
      render: (v: boolean) => v ? <Tag color="green">Thành công</Tag> : <Tag color="red">Thất bại</Tag>,
    },
    {
      title: '', key: 'actions', width: 50,
      render: (_: unknown, record: AuditLog) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedLog(record); setDetailOpen(true); }} />
      ),
    },
  ];

  return (
    <div>
      {stats && (
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={6}>
            <Card size="small"><Statistic title="Tổng số thao tác" value={stats.total} prefix={<ClockCircleOutlined />} /></Card>
          </Col>
          {stats.by_action.slice(0, 3).map((a) => (
            <Col span={6} key={a.action}>
              <Card size="small">
                <Statistic title={formatActionLabel(a.action)} value={a.count} valueStyle={{ fontSize: 20 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card size="small" style={{ marginTop: 16 }}>
        <Space wrap>
          <Select
            allowClear placeholder="Hành động" value={filterAction} onChange={setFilterAction}
            options={actionOptions} style={{ width: 140 }}
          />
          <Select
            allowClear placeholder="Đối tượng" value={filterResource} onChange={setFilterResource}
            options={resourceOptions} style={{ width: 140 }}
          />
          <DatePicker.RangePicker
            value={filterDateRange as any} onChange={(dates) => setFilterDateRange(dates as any)}
            format="DD/MM/YYYY" style={{ width: 240 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>Tìm</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setFilterAction(undefined); setFilterResource(undefined); setFilterDateRange(null); fetchData(); }}>Reset</Button>
        </Space>
      </Card>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `Tổng: ${t}` }}
        scroll={{ x: 900 }}
        style={{ marginTop: 16 }}
        size="middle"
      />
    </div>
  );
}
