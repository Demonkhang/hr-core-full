import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Table,
  Tag,
  message,
  Typography,
  Space,
  Tooltip,
  Modal,
  Descriptions,
  Button,
  Card,
  Input,
  Select,
  DatePicker,
  Badge,
} from 'antd';
import {
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  ClearOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { meetingScheduleService } from '@/services/meetingScheduleService';
import { departmentService } from '@/services/departmentService';
import type { MeetingSchedule, MeetingParticipant } from '@/types/meetingSchedule';
import type { Department } from '@/types/department';
import {
  MEETING_TYPE,
  MEETING_TYPE_LABELS,
  MEETING_TYPE_COLORS,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
} from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';

const { RangePicker } = DatePicker;

export function MeetingHistory() {
  const [meetings, setMeetings] = useState<MeetingSchedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<MeetingSchedule | null>(null);
  const user = useAuthStore((s) => s.user);

  // Load initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        active_only: false, // include cancelled/past in history
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_from = dateRange[0].format('YYYY-MM-DD');
        params.date_to = dateRange[1].format('YYYY-MM-DD');
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (typeFilter !== 'all') {
        params.meeting_type = typeFilter;
      }

      if (departmentFilter !== 'all') {
        params.department_id = [departmentFilter];
      }

      const isAdmin = Boolean(
        user?.is_super_admin ||
        (user as any)?.role === 'admin' ||
        (user as any)?.role === 'superadmin' ||
        (user as any)?.role === 'super_admin'
      );
      const canManage = Boolean(
        isAdmin ||
        user?.permissions?.can_manage_meetings ||
        user?.permissions?.can_approve_meetings
      );
      if (!canManage && user?.employee_id) {
        params.employee_id = user.employee_id;
      }

      const [data, depts] = await Promise.all([
        meetingScheduleService.getAll(params),
        departmentService.list(),
      ]);

      setMeetings(data);
      setDepartments(depts);
    } catch {
      message.error('Không thể tải dữ liệu lịch sử lịch họp');
    } finally {
      setLoading(false);
    }
  }, [dateRange, statusFilter, typeFilter, departmentFilter, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side search filter
  const filteredMeetings = useMemo(() => {
    if (!searchTerm.trim()) return meetings;
    const term = searchTerm.toLowerCase();
    return meetings.filter((m) => {
      const matchTitle = m.title?.toLowerCase().includes(term);
      const matchLoc = m.location?.toLowerCase().includes(term);
      const matchDesc = m.description?.toLowerCase().includes(term);
      const matchCreator = m.created_by_name?.toLowerCase().includes(term);
      const matchParticipant = m.participants?.some((p) =>
        p.employee_name?.toLowerCase().includes(term)
      );
      return matchTitle || matchLoc || matchDesc || matchCreator || matchParticipant;
    });
  }, [meetings, searchTerm]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDepartmentFilter('all');
    setDateRange(null);
  };

  const showDetail = (record: MeetingSchedule) => {
    setDetailMeeting(record);
    setDetailOpen(true);
  };

  // Stats calculation
  const stats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let cancelled = 0;

    for (const m of meetings) {
      if (m.status === 'approved') approved++;
      else if (m.status === 'pending') pending++;
      else if (m.status === 'rejected') rejected++;
      else if (m.status === 'cancelled') cancelled++;
    }

    return { total: meetings.length, approved, pending, rejected, cancelled };
  }, [meetings]);

  const columns = useMemo(
    () => [
      {
        title: 'Ngày',
        dataIndex: 'date',
        key: 'date',
        width: 110,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.date || '').localeCompare(b.date || ''),
        render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
      },
      {
        title: 'Giờ',
        dataIndex: 'start_time',
        key: 'time',
        width: 90,
        render: (val: string) => (val ? val.substring(0, 5) : '-'),
      },
      {
        title: 'Tiêu đề',
        dataIndex: 'title',
        key: 'title',
        width: 220,
        ellipsis: true,
        sorter: (a: MeetingSchedule, b: MeetingSchedule) => (a.title || '').localeCompare(b.title || ''),
        render: (text: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{text}</span>,
      },
      {
        title: 'Loại',
        dataIndex: 'meeting_type',
        key: 'meeting_type',
        width: 120,
        render: (v: string) => <Tag color={MEETING_TYPE_COLORS[v]}>{MEETING_TYPE_LABELS[v] || v}</Tag>,
      },
      {
        title: 'Địa điểm',
        dataIndex: 'location',
        key: 'location',
        width: 180,
        ellipsis: true,
        render: (v: string | null) =>
          v ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined style={{ color: '#ef4444', fontSize: 12 }} />
              {v}
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>-</span>
          ),
      },
      {
        title: 'Mô tả',
        dataIndex: 'description',
        key: 'description',
        width: 180,
        ellipsis: true,
        render: (v: string | null) =>
          v ? (
            <Tooltip title={v}>
              <span style={{ color: '#475569' }}>{v}</span>
            </Tooltip>
          ) : (
            <span style={{ color: '#94a3b8' }}>-</span>
          ),
      },
      {
        title: 'Phòng ban',
        dataIndex: 'department_name',
        key: 'department_name',
        width: 150,
        ellipsis: true,
        render: (v: string | null) => (v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#94a3b8' }}>Chung</span>),
      },
      {
        title: 'Tham gia',
        key: 'participants',
        width: 140,
        render: (_: any, record: MeetingSchedule) => {
          const participants = record.participants || [];
          if (participants.length === 0) return <span style={{ color: '#94a3b8' }}>-</span>;
          const names = participants.map((p) => p.employee_name).filter(Boolean);
          return (
            <Tooltip title={names.join(', ')}>
              <Tag color="cyan" icon={<TeamOutlined />}>
                {participants.length} người
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: string) => <Tag color={MEETING_STATUS_COLORS[v]}>{MEETING_STATUS_LABELS[v] || v}</Tag>,
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 80,
        align: 'center' as const,
        render: (_: any, record: MeetingSchedule) => (
          <Tooltip title="Xem chi tiết cuộc họp">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showDetail(record)}
            />
          </Tooltip>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Card */}
      <Card
        size="small"
        styles={{ body: { padding: '16px 20px' } }}
        style={{ borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
              Lịch sử lịch họp
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Tra cứu và theo dõi toàn bộ lịch sử các cuộc họp, hội thảo và khảo sát trong hệ thống.
            </Typography.Text>
          </div>

          <Space size={8} wrap>
            <Tag color="blue" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Tổng số: {stats.total}
            </Tag>
            <Tag color="green" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Đã duyệt: {stats.approved}
            </Tag>
            <Tag color="orange" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Chờ duyệt: {stats.pending}
            </Tag>
            <Tag color="red" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Từ chối/Hủy: {stats.rejected + stats.cancelled}
            </Tag>
          </Space>
        </div>
      </Card>

      {/* Filter Controls Card */}
      <Card
        size="small"
        styles={{ body: { padding: '16px 20px' } }}
        style={{ borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {/* 1. Search text */}
          <div>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo tiêu đề, phòng, người..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              allowClear
              style={{ borderRadius: 6, width: '100%' }}
            />
          </div>

          {/* 2. Date Range */}
          <div>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as any)}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              style={{ width: '100%', borderRadius: 6 }}
            />
          </div>

          {/* 3. Status Filter */}
          <div>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'approved', label: '✅ Đã duyệt' },
                { value: 'pending', label: '⏳ Chờ duyệt' },
                { value: 'rejected', label: '❌ Từ chối' },
                { value: 'cancelled', label: '🚫 Đã hủy' },
              ]}
            />
          </div>

          {/* 4. Type Filter */}
          <div>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'Tất cả loại họp' },
                ...Object.entries(MEETING_TYPE_LABELS).map(([val, lbl]) => ({
                  value: val,
                  label: lbl,
                })),
              ]}
            />
          </div>

          {/* 5. Department Filter */}
          <div>
            <Select
              value={departmentFilter}
              onChange={setDepartmentFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'Tất cả phòng ban' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
        </div>

        {/* Quick Action Bar under filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
          <Space size={6} wrap>
            <span style={{ fontSize: 12, color: '#64748b' }}>Phím chọn nhanh ngày:</span>
            <Button
              size="small"
              onClick={() => setDateRange([dayjs().startOf('day'), dayjs().endOf('day')])}
            >
              Hôm nay
            </Button>
            <Button
              size="small"
              onClick={() => setDateRange([dayjs().startOf('week'), dayjs().endOf('week')])}
            >
              Tuần này
            </Button>
            <Button
              size="small"
              onClick={() => setDateRange([dayjs().startOf('month'), dayjs().endOf('month')])}
            >
              Tháng này
            </Button>
            <Button
              size="small"
              onClick={() => setDateRange([dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')])}
            >
              Tháng trước
            </Button>
            <Button
              size="small"
              onClick={() => setDateRange(null)}
            >
              Tất cả thời gian
            </Button>
          </Space>

          <Space>
            <Button icon={<ClearOutlined />} onClick={handleResetFilters} size="small">
              Đặt lại bộ lọc
            </Button>
            <Button icon={<ReloadOutlined />} type="primary" ghost onClick={fetchData} size="small">
              Làm mới
            </Button>
          </Space>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card
        size="small"
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <Table
          dataSource={filteredMeetings}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (total: number) => `Tổng số ${total} cuộc họp`,
          }}
          scroll={{ x: 1050 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: '#2563eb' }} />
            <span>Chi tiết lịch họp</span>
          </div>
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailMeeting(null);
        }}
        footer={
          <Button onClick={() => setDetailOpen(false)}>
            Đóng
          </Button>
        }
        width={650}
      >
        {detailMeeting && (
          <Descriptions bordered column={1} size="small" style={{ marginTop: 10 }}>
            <Descriptions.Item label="Tiêu đề cuộc họp">
              <Typography.Text strong style={{ fontSize: 15 }}>
                {detailMeeting.title}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Loại cuộc họp">
              <Tag color={MEETING_TYPE_COLORS[detailMeeting.meeting_type]}>
                {MEETING_TYPE_LABELS[detailMeeting.meeting_type] || detailMeeting.meeting_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày diễn ra">
              {detailMeeting.date ? dayjs(detailMeeting.date).format('dddd, DD/MM/YYYY') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian">
              {detailMeeting.start_time?.substring(0, 5) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Địa điểm">
              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                📍 {detailMeeting.location || 'Chưa xác định địa điểm'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Phòng ban">
              {detailMeeting.department_name || 'Tất cả phòng ban'}
            </Descriptions.Item>
            <Descriptions.Item label="Người tạo">
              {detailMeeting.created_by_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={MEETING_STATUS_COLORS[detailMeeting.status]}>
                {MEETING_STATUS_LABELS[detailMeeting.status] || detailMeeting.status}
              </Tag>
            </Descriptions.Item>
            {detailMeeting.approved_by_name && (
              <Descriptions.Item label="Người duyệt">
                {detailMeeting.approved_by_name}
              </Descriptions.Item>
            )}
            {detailMeeting.approved_at && (
              <Descriptions.Item label="Thời gian duyệt">
                {dayjs(detailMeeting.approved_at).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
            )}
            {detailMeeting.rejection_reason && (
              <Descriptions.Item label="Lý do từ chối">
                <span style={{ color: '#dc2626' }}>{detailMeeting.rejection_reason}</span>
              </Descriptions.Item>
            )}
            {detailMeeting.description && (
              <Descriptions.Item label="Mô tả / Ghi chú">
                {detailMeeting.description}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={`Danh sách tham gia (${detailMeeting.participants?.length || 0})`}>
              {detailMeeting.participants && detailMeeting.participants.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {detailMeeting.participants.map((p: MeetingParticipant) => (
                    <Tag key={p.id} color="blue" icon={<TeamOutlined />}>
                      {p.employee_name || 'Nhân viên'}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#94a3b8' }}>Chưa có người tham gia</span>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
